import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Message, MessageDocument } from '../database/schemas/message.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { Lead, LeadDocument } from '../database/schemas/lead.schema';
import { ChatService, ChatMessage } from '../ai/chat.service';
import { SlotProvider } from '../ai/slot-provider';
import { Slot } from '../ai/interfaces/slot.interface';
import { selectSlots, selectLatestSlots, buildSlotPromptSection, buildDayAvailabilitySection, formatSlotDisplay } from '../ai/slot-formatter';
import { buildContextFromDb } from './context-builder';
import { detectSlotSelection, detectDateRangePreference, normaliseTime, SlotSelectionResult } from '../ai/slot-selector';
import { AppointmentsService, BookingResult } from '../appointments/appointments.service';
import { UrgencyLevel } from '../ai/urgency-detector.types';
import { UrgencyPipeline } from '../ai/urgency-pipeline';
import { EscalationService } from '../ai/escalation.service';
import { PATIENT_EMERGENCY_FOLLOWUP } from '../ai/urgency-messages';
import { AbuseHandlerService } from './abuse-handler.service';
import { FALLBACK_AI_UNAVAILABLE, FALLBACK_APPOINTMENT_FAILED, FALLBACK_CALENDAR_UNAVAILABLE } from '../orchestrator/orchestrator.types';

/** Day names indexed by Date.getDay() */
const DAYS_LOWER = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

/** Fetches slots and optionally filters by the lead's expressed preference. */
async function buildSlotContext(
  provider: SlotProvider,
  clinicId: string,
  urgency: 'urgent' | 'routine' | 'flexible',
  selectionResult: SlotSelectionResult | null,
  previouslyOfferedSlots?: { dateTime: any; displayText: string }[],
): Promise<{ selected: Slot[]; slotSection: string }> {
  // When the lead requested a specific date range, pass it to the provider
  let requestedStart = selectionResult?.requestedStartDate
    ? new Date(selectionResult.requestedStartDate)
    : undefined;
  let requestedEnd = selectionResult?.requestedEndDate
    ? new Date(selectionResult.requestedEndDate)
    : undefined;

  // For FURTHER_DATE, search backwards from the 4-month GHL booking limit until
  // we find a month with actual availability. GHL only allows ~31-day query
  // windows, so we check month-by-month starting from the furthest out.
  if (selectionResult?.intent === 'FURTHER_DATE' && !requestedStart) {
    const now = new Date();
    let furthestSlots: Slot[] = [];
    // Try months 3, 2, 1 ahead (4-month GHL limit) — stop as soon as we find slots
    for (let offset = 3; offset >= 1; offset--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
      const found = await provider.getAvailableSlots(clinicId, monthStart, monthEnd);
      if (found.length > 0) {
        furthestSlots = found;
        break;
      }
    }
    if (furthestSlots.length > 0) {
      const selected = selectLatestSlots(furthestSlots);
      return { selected, slotSection: buildSlotPromptSection(selected, urgency) };
    }
    // If nothing found in months 1-5 ahead, fall through to the default 31-day fetch
  }

  const allSlots = await provider.getAvailableSlots(clinicId, requestedStart, requestedEnd);
  let slots: Slot[];

  /** Filters slots by time-of-day preference (morning/afternoon/evening) */
  const applyTimePref = (input: Slot[], pref: string): Slot[] => {
    return input.filter(s => {
      const hour = parseInt(s.startTime.split(':')[0], 10);
      if (pref === 'morning')   return hour < 12;
      if (pref === 'afternoon') return hour >= 12 && hour < 17;
      if (pref === 'evening')   return hour >= 17;
      return true; // 'earlier' / 'later' — let AI decide from all slots
    });
  };

  if (selectionResult?.intent === 'FURTHER_DATE') {
    // Fallback: if the backward search above didn't return early,
    // pick latest from whatever the default range returned
    slots = selectLatestSlots(allSlots);
  } else if (selectionResult?.intent === 'DIFFERENT_DATE' && selectionResult.requestedDate) {
    // Lead asked for a specific day name — filter by that day
    const day = selectionResult.requestedDate.toLowerCase();
    slots = allSlots.filter(s => DAYS_LOWER[new Date(`${s.date}T${s.startTime}:00`).getDay()] === day);
    // Apply time-of-day preference if present (e.g. "other times in the afternoon")
    if (selectionResult.timePreference) {
      const timePrefSlots = applyTimePref(slots, selectionResult.timePreference);
      if (timePrefSlots.length > 0) slots = timePrefSlots;
    }
    // Exclude slots that were already offered (so "other times on Thursday"
    // doesn't re-offer the same Thursday slot)
    if (previouslyOfferedSlots?.length) {
      const offeredKeys = new Set(
        previouslyOfferedSlots.map(o => {
          const dt = new Date(o.dateTime);
          return `${dt.toISOString().split('T')[0]}_${dt.toTimeString().substring(0, 5)}`;
        }),
      );
      const fresh = slots.filter(s => !offeredKeys.has(`${s.date}_${s.startTime}`));
      if (fresh.length > 0) slots = fresh;
      // If all slots on that day were already offered, keep them so the AI
      // can tell the lead there are no other options on that day
    }
    // Pick up to 3 slots
    slots = slots.slice(0, 3);
  } else if (selectionResult?.intent === 'DIFFERENT_DATE' && selectionResult.requestedStartDate) {
    // Check if this is a single-day request (start and end are 1 day apart)
    const rangeMs = selectionResult.requestedEndDate
      ? new Date(selectionResult.requestedEndDate).getTime() - new Date(selectionResult.requestedStartDate).getTime()
      : 0;
    const isSingleDay = rangeMs > 0 && rangeMs <= 24 * 60 * 60 * 1000;

    if (isSingleDay) {
      // Specific day request (e.g. "Monday 6th July") — return multiple slots
      // for that exact day rather than spreading across different days
      let daySlots = allSlots;
      if (selectionResult.timePreference) {
        const timePrefSlots = applyTimePref(daySlots, selectionResult.timePreference);
        if (timePrefSlots.length > 0) daySlots = timePrefSlots;
      }
      slots = daySlots.slice(0, 3);
    } else {
      // Multi-day range (e.g. "this week") — spread across the range
      slots = selectSlots(allSlots, urgency);
      // Apply time-of-day preference if present
      if (selectionResult.timePreference) {
        const timePrefSlots = applyTimePref(slots, selectionResult.timePreference);
        if (timePrefSlots.length > 0) slots = timePrefSlots;
      }
    }
  } else if (selectionResult?.intent === 'DIFFERENT_TIME' && selectionResult.timePreference) {
    let base = allSlots;
    // If we know which day the lead was asking about, scope to that day
    if (selectionResult.requestedDate) {
      const day = selectionResult.requestedDate.toLowerCase();
      base = allSlots.filter(s => DAYS_LOWER[new Date(`${s.date}T${s.startTime}:00`).getDay()] === day);
    }

    // For 'earlier'/'later' preferences, exclude previously offered slots
    // and pick slots that are earlier/later than what was already shown
    if ((selectionResult.timePreference === 'later' || selectionResult.timePreference === 'earlier') && previouslyOfferedSlots?.length) {
      const offeredKeys = new Set(
        previouslyOfferedSlots.map(o => {
          const dt = new Date(o.dateTime);
          return `${dt.toISOString().split('T')[0]}_${dt.toTimeString().substring(0, 5)}`;
        }),
      );
      // Find the latest/earliest offered time to use as a boundary
      const offeredTimes = previouslyOfferedSlots.map(o => new Date(o.dateTime).getTime());
      const boundary = selectionResult.timePreference === 'later'
        ? Math.max(...offeredTimes)
        : Math.min(...offeredTimes);

      const fresh = base.filter(s => {
        const key = `${s.date}_${s.startTime}`;
        if (offeredKeys.has(key)) return false;
        const slotTime = new Date(`${s.date}T${s.startTime}:00`).getTime();
        return selectionResult!.timePreference === 'later'
          ? slotTime > boundary
          : slotTime < boundary;
      });
      slots = selectSlots(fresh.length > 0 ? fresh : base, urgency);
    } else {
      const filtered = applyTimePref(base, selectionResult.timePreference);
      slots = selectSlots(filtered.length > 0 ? filtered : base, urgency);
    }
  } else {
    slots = selectSlots(allSlots, urgency);
  }

  return { selected: slots, slotSection: buildSlotPromptSection(slots, urgency) };
}

/**
 * Manages live conversations persisted in MongoDB.
 * Orchestrates the AI chat flow, slot offering, slot-selection detection,
 * and automatic booking when a lead confirms a slot (US-15 integration).
 */
@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Clinic.name) private clinicModel: Model<ClinicDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    private readonly chatService: ChatService,
    private readonly slotProvider: SlotProvider,
    private readonly appointmentsService: AppointmentsService,
    private readonly urgencyPipeline: UrgencyPipeline,
    private readonly escalationService: EscalationService,
    private readonly abuseHandler: AbuseHandlerService,
  ) {}

  /** Retrieves a conversation with its messages and related clinic/lead data. */
  async getConversation(conversationId: string) {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    const [messages, clinic, lead] = await Promise.all([
      this.messageModel.find({ conversationId: conversation._id }).sort({ createdAt: 1 }),
      this.clinicModel.findById(conversation.clinicId),
      this.leadModel.findById(conversation.leadId),
    ]);
    return { conversation, messages, clinic, lead };
  }

  /** Lists all conversations with basic lead/clinic info. */
  async listConversations() {
    return this.conversationModel
      .find()
      .populate('clinicId', 'name')
      .populate('leadId', 'firstName lastName phone')
      .sort({ lastMessageAt: -1 });
  }

  /**
   * Generates the AI greeting for a conversation and saves it as the first message.
   * @returns The greeting message content, or null on failure
   */
  async startConversation(conversationId: string): Promise<string | null> {
    const { conversation, clinic, lead } = await this.getConversation(conversationId);
    if (!clinic || !lead) throw new NotFoundException('Clinic or lead not found');

    // Pre-detect urgency from the lead's form submission issue field
    if (lead.issue && lead.urgency === 'unknown') {
      const { resolved } = this.urgencyPipeline.assessFormData(lead.issue);
      if (resolved !== 'routine') {
        await this.leadModel.findByIdAndUpdate(lead._id, { urgency: resolved });
        (lead as any).urgency = resolved;
      }
    }

    const { leadInfo, clinicConfig } = buildContextFromDb(lead, clinic);
    const greeting = await this.chatService.startConversation(leadInfo, clinicConfig);
    const finalGreeting = greeting ?? FALLBACK_AI_UNAVAILABLE;
    if (!greeting) this.logger.warn('Greeting generation failed — using fallback');
    await this.saveMessage(conversation, clinic, lead, 'ai', finalGreeting);
    await this.updateConversationMeta(conversation, 'ai', 'greeting');
    return finalGreeting;
  }

  /**
   * Processes a lead's message, runs slot-selection detection, and generates
   * an AI reply. When the lead confirms a slot (SLOT_SELECTED), the appointment
   * is automatically booked via AppointmentsService and the confirmation
   * message is sent. Both messages are persisted to MongoDB.
   * @returns Object with the AI reply, offered slots, selection result, and booking result
   */
  async sendMessage(conversationId: string, userMessage: string) {
    const { conversation, messages, clinic, lead } = await this.getConversation(conversationId);
    if (!clinic || !lead) throw new NotFoundException('Clinic or lead not found');

    // ── Urgency detection (delegated to UrgencyPipeline) ──
    const { resolved: resolvedUrgency, assessment: urgencyAssessment } =
      await this.urgencyPipeline.assessMessage(
        userMessage,
        (lead.urgency as UrgencyLevel | 'unknown') ?? 'unknown',
        lead.issue,
      );

    // Save lead message with urgency audit trail
    await this.saveMessage(conversation, clinic, lead, 'lead', userMessage, {
      level: urgencyAssessment.level, score: urgencyAssessment.score,
    });

    await this.saveMessage(conversation, clinic, lead, 'lead', userMessage);

    const abuseHandled = await this.abuseHandler.handle(
      conversation, clinic, lead, userMessage,
    );
    if (abuseHandled) {
      // If the lead accepted the human offer, signal to the caller so the
      // US-20 escalation service can take over (phase change, GHL tags, etc.)
      return abuseHandled;
    }
    
    const history: ChatMessage[] = [
      ...messages.map(m => ({
        role: m.sender === 'ai' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const { leadInfo, clinicConfig } = buildContextFromDb(lead, clinic);

    // Update lead urgency if it changed
    if (resolvedUrgency !== lead.urgency) {
      await this.leadModel.findByIdAndUpdate(lead._id, { urgency: resolvedUrgency });
      this.escalationService.updateGhlTags(lead, resolvedUrgency).catch(
        (err) => this.logger.warn(`GHL tag update failed: ${err.message}`),
      );
    }

    // Emergency: escalate and return early
    if (resolvedUrgency === 'emergency') {
      // Already escalated — send a softer follow-up instead of repeating the full escalation
      if (conversation.phase === 'escalated') {
        await this.saveMessage(conversation, clinic, lead, 'ai', PATIENT_EMERGENCY_FOLLOWUP);
        await this.updateConversationMeta(conversation, 'ai', undefined);
        return { reply: PATIENT_EMERGENCY_FOLLOWUP, offeredSlots: [], slotSelection: null, bookingResult: null };
      }
      const result = await this.escalationService.escalateEmergency(
        conversation, lead, clinic, urgencyAssessment,
      );
      await this.saveMessage(conversation, clinic, lead, 'ai', result.aiMessage);
      await this.updateConversationMeta(conversation, 'ai', 'escalated');
      return { reply: result.aiMessage, offeredSlots: [], slotSelection: null, bookingResult: null };
    }

    const urgency: 'urgent' | 'routine' | 'flexible' =
      resolvedUrgency === 'urgent' ? 'urgent'
        : resolvedUrgency === 'routine' ? 'routine'
          : 'flexible';

    // Detect what the lead meant — week-range phrases like "this week" always
    // trigger the day-overview flow regardless of whether slots were previously offered.
    let selectionResult: SlotSelectionResult | null = null;
    const lowerMsg = userMessage.toLowerCase();

    // Patterns that indicate the lead is asking about a whole week range
    const weekPatterns = [
      /\bthis\s+week\b/,
      /\bnext\s+week\b/,
      /\bduring\s+(?:the\s+)?week\b/,
      /\bwithin\s+(?:the\s+)?week\b/,
      /\bover\s+(?:the\s+)?(?:next\s+)?week\b/,
      /\bin\s+(?:the\s+)?(?:next\s+)?week\b/,
      /\bany\s+day\s+(?:this|next)\s+week\b/,
      /\bsometime\s+(?:this|next)\s+week\b/,
      /\blater\s+(?:this|in\s+the)\s+week\b/,
      /\bearlier\s+(?:this|in\s+the)\s+week\b/,
      /\b(?:the\s+)?coming\s+week\b/,
      /\bweekday\b/,
      /\bin\s+(?:two|2|three|3)\s+weeks?\b/,
    ];
    const isWeekRange = weekPatterns.some(p => p.test(lowerMsg));

    if (isWeekRange) {
      // Week-range request — always use day-overview flow
      const dateRange = detectDateRangePreference(userMessage);
      if (dateRange) {
        // Check if the lead also mentioned a specific time (e.g. "12pm slot next week")
        const weekTimeMatch = lowerMsg.match(
          /\b(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))\b/i,
        ) || lowerMsg.match(
          /\b(\d{1,2}[.:]\d{2})\b/,
        ) || lowerMsg.match(
          /(?:at|around|for)\s+(\d{1,2}(?:[.:]\d{2})?(?:\s*(?:am|pm))?)\b/i,
        );
        const weekTimePref = weekTimeMatch ? normaliseTime(weekTimeMatch[1].trim()) : undefined;

        selectionResult = {
          intent: 'DAY_OVERVIEW',
          requestedStartDate: dateRange.startDate,
          requestedEndDate: dateRange.endDate,
          ...(weekTimePref ? { timePreference: weekTimePref } : {}),
        };
      }
    } else if (conversation.awaitingDaySelection) {
      // We showed a day overview and the lead picks a day — offer time slots for it
      const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
      const pickedDay = dayNames.find(d => lowerMsg.includes(d));
      if (pickedDay) {
        // Prefer the saved date range from the DAY_OVERVIEW that triggered this state,
        // since the lead may have asked about "next week" but now just says "Wednesday"
        // — detectDateRangePreference("Wednesday") would not know about "next week".
        const savedStart = conversation.lastRequestedDateStart
          ? new Date(conversation.lastRequestedDateStart) : undefined;
        const savedEnd = conversation.lastRequestedDateEnd
          ? new Date(conversation.lastRequestedDateEnd) : undefined;
        const dateRange = savedStart
          ? { startDate: savedStart, endDate: savedEnd! }
          : (detectDateRangePreference(userMessage) ?? detectDateRangePreference('this week'));
        selectionResult = {
          intent: 'DIFFERENT_DATE',
          requestedDate: pickedDay.charAt(0).toUpperCase() + pickedDay.slice(1),
          requestedStartDate: dateRange?.startDate,
          requestedEndDate: dateRange?.endDate,
        };
        await this.conversationModel.findByIdAndUpdate(conversation._id, {
          awaitingDaySelection: false,
          lastRequestedDay: pickedDay,
        });
      } else {
        // No day name picked — check if the lead is asking about a specific time
        // across the current date range (e.g. "what days have 12pm free?",
        // "any slots at 2pm?", "which days have a 9am appointment?").
        // Detect a time reference and re-run the day overview filtered by that time.
        const timeInMsg = lowerMsg.match(
          /\b(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))\b/i,                       // "12pm", "2:30pm", "9am"
        ) || lowerMsg.match(
          /\b(\d{1,2}[.:]\d{2})\b/,                                          // "14:00", "9.30" (24h or dot-separated)
        ) || lowerMsg.match(
          /\b(\d{1,2}(?:[.:]\d{2})?)\s*(?:o'?clock|slots?|free|available|appointment)/i, // "12 o'clock", "2 free"
        ) || lowerMsg.match(
          /(?:at|around|for|have)\s+(\d{1,2}(?:[.:]\d{2})?(?:\s*(?:am|pm))?)\b/i, // "at 2", "around 3pm", "have 12"
        );
        if (timeInMsg && conversation.lastRequestedDateStart) {
          // The lead is asking about a specific time across the current range
          const normTime = normaliseTime(timeInMsg[1].trim());
          selectionResult = {
            intent: 'DAY_OVERVIEW',
            requestedStartDate: new Date(conversation.lastRequestedDateStart),
            requestedEndDate: conversation.lastRequestedDateEnd
              ? new Date(conversation.lastRequestedDateEnd)
              : undefined,
            timePreference: normTime,
          };
        } else {
          // The lead may have changed their mind entirely
          // (e.g. "first week of June", "in April", "tomorrow"). Detect the new
          // date preference so it doesn't fall through to the default 31-day fetch.
          const dateRange = detectDateRangePreference(userMessage);
          if (dateRange) {
            selectionResult = {
              intent: 'DIFFERENT_DATE',
              requestedStartDate: dateRange.startDate,
              requestedEndDate: dateRange.endDate,
            };
            await this.conversationModel.findByIdAndUpdate(conversation._id, {
              awaitingDaySelection: false,
            });
          } else if (conversation.lastRequestedDateStart) {
            // No day name, no time, no date range detected — the user may be
            // giving an affirmative reply (e.g. "yes", "yes please", "ok") or
            // any other response to the AI's question. Transition OUT of the
            // day-overview by offering concrete slots from the saved date range
            // so the booking flow can proceed. This prevents the conversation
            // from getting stuck in the day-overview loop with no bookable slots.
            selectionResult = {
              intent: 'DIFFERENT_DATE',
              requestedStartDate: new Date(conversation.lastRequestedDateStart),
              requestedEndDate: conversation.lastRequestedDateEnd
                ? new Date(conversation.lastRequestedDateEnd)
                : undefined,
            };
            await this.conversationModel.findByIdAndUpdate(conversation._id, {
              awaitingDaySelection: false,
            });
          }
        }
      }
    } else if (conversation.offeredSlots?.length > 0) {
      try {
        selectionResult = detectSlotSelection(userMessage, conversation.offeredSlots);
      } catch (error) {
        this.logger.error('Slot detection failed, continuing without selection', error);
      }

      // Detect time-of-day preference from the message.
      // Covers natural phrasing: "after 12pm", "around 3", "past noon",
      // "anything in the morning", "something later in the day", etc.
      // Patterns are ordered most-specific first so longer matches win.
      const timePrefPatterns: { pattern: RegExp; pref: string }[] = [
        // Morning patterns
        { pattern: /\b(?:anything|something|any\s*(?:thing|time)?s?)\s+(?:in\s+the\s+)?morning\b/i, pref: 'morning' },
        { pattern: /\b(?:before|around|from)\s+12\s*(?:pm|noon)?\b/i, pref: 'morning' },
        { pattern: /\b(?:before|around)\s+\d{1,2}\s*am\b/i, pref: 'morning' },
        { pattern: /\b(?:before|around)\s+(?:noon|midday|lunch)\b/i, pref: 'morning' },
        { pattern: /\bearly\s+(?:in\s+the\s+)?(?:day|morning)\b/i, pref: 'morning' },
        { pattern: /\bfirst\s+thing\b/i, pref: 'morning' },
        { pattern: /\bmorning\b/i, pref: 'morning' },
        // Afternoon patterns
        { pattern: /\b(?:anything|something|any\s*(?:thing|time)?s?)\s+(?:in\s+the\s+)?afternoon\b/i, pref: 'afternoon' },
        { pattern: /\b(?:after|around|past|from)\s+12\s*(?:pm|noon)?\b/i, pref: 'afternoon' },
        { pattern: /\b(?:after|around|past|from)\s+\d{1,2}\s*(?:pm)?\b/i, pref: 'afternoon' },
        { pattern: /\b(?:after|past|from)\s+(?:noon|midday|lunch)\b/i, pref: 'afternoon' },
        { pattern: /\blater\s+(?:in\s+the\s+)?(?:day|afternoon)\b/i, pref: 'afternoon' },
        { pattern: /\bpm\s+(?:slots?|times?|appointments?)\b/i, pref: 'afternoon' },
        { pattern: /\bafternoon\b/i, pref: 'afternoon' },
        { pattern: /\bmidday\b/i, pref: 'afternoon' },
        // Evening patterns
        { pattern: /\b(?:anything|something|any\s*(?:thing|time)?s?)\s+(?:in\s+the\s+)?evening\b/i, pref: 'evening' },
        { pattern: /\b(?:after|around|past|from)\s+(?:5|6|7)\s*(?:pm)?\b/i, pref: 'evening' },
        { pattern: /\blate\s+(?:in\s+the\s+)?(?:day|afternoon|evening)\b/i, pref: 'evening' },
        { pattern: /\bevening\b/i, pref: 'evening' },
        { pattern: /\bend\s+of\s+(?:the\s+)?day\b/i, pref: 'evening' },
      ];
      const detectedTimePref = timePrefPatterns.find(tp => tp.pattern.test(lowerMsg))?.pref;

      // If the slot selector returned AMBIGUOUS but the lead is actually asking
      // for a different time (e.g. "anytime after 12pm?"), override to DIFFERENT_TIME
      if (selectionResult?.intent === 'AMBIGUOUS' && detectedTimePref) {
        selectionResult = {
          intent: 'DIFFERENT_TIME',
          timePreference: detectedTimePref,
        };
      }

      // If DIFFERENT_DATE was detected (e.g. "afternoon slots on thursday") and the
      // message also contains a time preference, attach it so slots get filtered
      if (selectionResult?.intent === 'DIFFERENT_DATE' && detectedTimePref && !selectionResult.timePreference) {
        selectionResult.timePreference = detectedTimePref;
      }

      // If DIFFERENT_DATE has only a day name but no date range (e.g. "that Tuesday",
      // "times on Tuesday"), carry forward the saved date context from the previous
      // turn so slots are fetched from the correct month — not the default 31-day window.
      if (
        selectionResult?.intent === 'DIFFERENT_DATE' &&
        selectionResult.requestedDate &&
        !selectionResult.requestedStartDate &&
        conversation.lastRequestedDateStart
      ) {
        selectionResult.requestedStartDate = new Date(conversation.lastRequestedDateStart);
        selectionResult.requestedEndDate = conversation.lastRequestedDateEnd
          ? new Date(conversation.lastRequestedDateEnd)
          : undefined;
      }

      // If the lead asks for a different time, scope the fetch to the correct
      // day and/or date range from the previous turn
      if (selectionResult?.intent === 'DIFFERENT_TIME') {
        if (conversation.lastRequestedDay) {
          selectionResult.requestedDate = conversation.lastRequestedDay.charAt(0).toUpperCase() + conversation.lastRequestedDay.slice(1);
        }
        // Use the saved date range so slots are fetched from the correct month/date
        if (conversation.lastRequestedDateStart) {
          selectionResult.requestedStartDate = new Date(conversation.lastRequestedDateStart);
          selectionResult.requestedEndDate = conversation.lastRequestedDateEnd
            ? new Date(conversation.lastRequestedDateEnd)
            : undefined;
        }
      }
    } else {
      // No slots offered yet — detect date-range preferences and furthest-date requests
      const furtherPhrases = [
        'furthest date', 'furthest available', 'furthest availability',
        'latest date', 'latest available', 'latest availability',
        'further date', 'further dates', 'furthest', 'latest',
      ];
      if (furtherPhrases.some(p => lowerMsg.includes(p))) {
        selectionResult = { intent: 'FURTHER_DATE' };
      } else {
        const dateRange = detectDateRangePreference(userMessage);
        if (dateRange) {
          selectionResult = {
            intent: 'DIFFERENT_DATE',
            requestedStartDate: dateRange.startDate,
            requestedEndDate: dateRange.endDate,
          };
        }
      }
    }

    // If the lead confirmed a slot, book the appointment automatically
    let bookingResult: BookingResult | null = null;
    if (selectionResult?.intent === 'SLOT_SELECTED' && selectionResult.selectedSlot) {
      bookingResult = await this.handleBooking(
        conversation, clinic, lead, selectionResult,
      );
    }

    // DAY_OVERVIEW: show day-level availability instead of specific time slots
    if (selectionResult?.intent === 'DAY_OVERVIEW') {
      const rangeStart = selectionResult.requestedStartDate!;
      const rangeEnd = selectionResult.requestedEndDate!;
      let allSlots = await this.slotProvider.getAvailableSlots(
        clinicConfig.clinicId, rangeStart, rangeEnd,
      );

      // If the lead asked about a specific time (e.g. "what days have 12pm free?"),
      // filter slots to only those matching that time before building the day overview.
      const timeFilter = selectionResult.timePreference;
      if (timeFilter && /\d/.test(timeFilter)) {
        allSlots = allSlots.filter(s => {
          const slotNorm = normaliseTime(s.startTime);
          return slotNorm === timeFilter;
        });
      }

      const daySection = buildDayAvailabilitySection(allSlots, rangeStart, rangeEnd);

      await this.conversationModel.findByIdAndUpdate(conversation._id, {
        awaitingDaySelection: true,
        lastRequestedDateStart: rangeStart,
        lastRequestedDateEnd: rangeEnd,
      });

      const reply = await this.chatService.sendMessage(
        leadInfo, clinicConfig, history, userMessage,
        { slotOptions: { slotSection: daySection, selectionContext: selectionResult ?? undefined } },
      );
      if (!reply) return null;

      await this.saveMessage(conversation, clinic, lead, 'ai', reply);
      await this.updateConversationMeta(conversation, 'ai', undefined);
      return { reply, offeredSlots: [], slotSelection: selectionResult, bookingResult: null };
    }

    // When the lead has selected a slot or their reply is ambiguous (e.g.
    // answering a qualification question like "new"/"returning"), keep the
    // previously offered slots instead of re-fetching from the default
    // 31-day range — avoids the AI contradicting its earlier date-filtered offer.
    const keepExistingSlots =
      selectionResult?.intent === 'SLOT_SELECTED' ||
      selectionResult?.intent === 'AMBIGUOUS';
    let selected: Slot[];
    let slotSection: string;
    if (keepExistingSlots && conversation.offeredSlots?.length > 0) {
      selected = conversation.offeredSlots.map((s: any) => {
        const dt = new Date(s.dateTime);
        return {
          date: dt.toISOString().split('T')[0],
          startTime: dt.toTimeString().substring(0, 5),
          endTime: '', // not needed for display
        };
      });
      slotSection = buildSlotPromptSection(selected, urgency);
    } else {
      try {
        ({ selected, slotSection } = await buildSlotContext(
          this.slotProvider, clinicConfig.clinicId, urgency, selectionResult,
          conversation.offeredSlots as any[],
        ));
      } catch (error) {
        this.logger.warn(`Slot fetching failed: ${(error as Error).message}`);
        return { reply: FALLBACK_CALENDAR_UNAVAILABLE, offeredSlots: [], slotSelection: null, bookingResult: null };
      }
    }

    // Build the list of ALL previously offered slot display texts for prompt injection
    // Uses slotHistory (cumulative) so the AI can reference slots from any turn
    const historySlots = (conversation.slotHistory as any[]) ?? [];
    const currentSlots = (conversation.offeredSlots as any[]) ?? [];
    const allSlotTexts = [...historySlots, ...currentSlots]
      .map((s: any) => s.displayText as string)
      .filter(Boolean);
    // Deduplicate
    const previouslyOfferedSlots = allSlotTexts.length
      ? [...new Set(allSlotTexts)]
      : undefined;

    // No slots available for urgent patient
    if (urgency === 'urgent' && selected.length === 0) {
      const msg = await this.escalationService.handleNoSlotsForUrgent(conversation, clinic, lead);
      await this.saveMessage(conversation, clinic, lead, 'ai', msg);
      await this.updateConversationMeta(conversation, 'ai', undefined);
      return { reply: msg, offeredSlots: [], slotSelection: null, bookingResult: null };
    }

    const reply = await this.chatService.sendMessage(
      leadInfo, clinicConfig, history, userMessage,
      {
        slotOptions: { slotSection, selectionContext: selectionResult ?? undefined, previouslyOfferedSlots },
        urgencyContext: { level: resolvedUrgency as UrgencyLevel | 'unknown', isEmergency: false },
      },
    );
    if (!reply) {
      this.logger.warn('AI response failed — using fallback message');
      return { reply: FALLBACK_AI_UNAVAILABLE, offeredSlots: [], slotSelection: null, bookingResult: null };
    }

    // Use appropriate reply based on booking outcome
    let finalReply: string;
    if (bookingResult?.success && bookingResult.confirmationMessage) {
      finalReply = bookingResult.confirmationMessage;
    } else if (bookingResult && !bookingResult.success && bookingResult.error) {
      finalReply = FALLBACK_APPOINTMENT_FAILED;
    } else {
      finalReply = reply;
    }

    await this.storeOfferedSlots(conversation, selected);

    // Track which day and date range the lead is currently asking about so
    // follow-up time-preference requests (e.g. "afternoon", "later time") are
    // scoped to the correct day and date range
    const dateCtxUpdate: Record<string, any> = {};
    if (selectionResult?.requestedDate) {
      dateCtxUpdate.lastRequestedDay = selectionResult.requestedDate.toLowerCase();
    }
    if (selectionResult?.requestedStartDate) {
      dateCtxUpdate.lastRequestedDateStart = new Date(selectionResult.requestedStartDate);
      dateCtxUpdate.lastRequestedDateEnd = selectionResult.requestedEndDate
        ? new Date(selectionResult.requestedEndDate)
        : new Date(selectionResult.requestedStartDate);
    }
    if (Object.keys(dateCtxUpdate).length > 0) {
      await this.conversationModel.findByIdAndUpdate(conversation._id, dateCtxUpdate);
    }

    await this.saveMessage(conversation, clinic, lead, 'ai', finalReply);
    await this.updateConversationMeta(conversation, 'ai', undefined);

    const offeredSlots = selected.map(s => ({
      dateTime: new Date(`${s.date}T${s.startTime}:00`).toISOString(),
      displayText: formatSlotDisplay(s),
    }));
    return { reply: finalReply, offeredSlots, slotSelection: selectionResult, bookingResult };
  }

  /**
   * Handles automatic appointment booking when a lead confirms a slot.
   * Extracts the selected slot datetime and delegates to AppointmentsService.
   */
  private async handleBooking(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    selectionResult: SlotSelectionResult,
  ): Promise<BookingResult> {
    const selectedSlot = selectionResult.selectedSlot!;
    const startTime = selectedSlot.dateTime instanceof Date
      ? selectedSlot.dateTime.toISOString()
      : new Date(selectedSlot.dateTime).toISOString();

    const contactId = lead.ghlContactId ?? conversation.ghlContactId ?? lead._id.toString();
    const bookingDto = {
      clinicId: clinic._id.toString(),
      contactId,
      conversationId: conversation._id.toString(),
      leadId: lead._id.toString(),
      startTime,
    };

    try {
      const result = await this.appointmentsService.bookAppointment(bookingDto);

      if (result.success) {
        this.logger.log(
          `Auto-booked appointment ${result.appointmentId} for conversation ${conversation._id}`,
        );
      } else if (result.slotTaken) {
        this.logger.warn(
          `Slot was taken during auto-booking for conversation ${conversation._id}`,
        );
      }
      return result;
    } catch (error) {
      this.logger.error(`Auto-booking failed: ${error.message}`);
      return { success: false, error: 'Booking failed unexpectedly' };
    }
  }

  /** Resets a conversation by deleting all messages and resetting phase. */
  async resetConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationModel.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');
    await this.messageModel.deleteMany({ conversationId: conversation._id });
    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      phase: 'greeting', messageCount: 0, offeredSlots: [], slotHistory: [],
      directedHostilityCount: 0, abuseOfferPending: false,
      lastMessageAt: null, lastMessageFrom: null, awaitingDaySelection: false,
      lastRequestedDay: null, lastRequestedDateStart: null, lastRequestedDateEnd: null,
    });
    await this.leadModel.findByIdAndUpdate(conversation.leadId, { urgency: 'unknown' });
  }

  /** Creates a message document in MongoDB, optionally with urgency audit data. */
  private async saveMessage(
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    lead: LeadDocument,
    sender: 'ai' | 'lead',
    content: string,
    urgencyData?: { level: string; score: number },
  ) {
    const doc: Record<string, any> = {
      conversationId: conversation._id,
      clinicId: clinic._id,
      leadId: lead._id,
      sender,
      content,
      channel: conversation.channel,
    };
    if (urgencyData) {
      doc.extractedData = new Map([
        ['urgency', urgencyData.level],
        ['urgencyScore', urgencyData.score.toString()],
      ]);
    }
    return this.messageModel.create(doc);
  }

  /** Updates conversation metadata after a new message */
  private async updateConversationMeta(
    conversation: ConversationDocument,
    lastFrom: string,
    phase?: string,
  ) {
    const update: Record<string, any> = {
      lastMessageAt: new Date(),
      lastMessageFrom: lastFrom,
      $inc: { messageCount: 1 },
    };
    if (phase) update.phase = phase;
    await this.conversationModel.findByIdAndUpdate(conversation._id, update);
  }

  /** Persists the offered slots on the conversation for later selection matching.
   *  Also appends new slots to slotHistory (deduped) so the AI can reference
   *  every slot it has ever offered in this conversation.
   */
  private async storeOfferedSlots(conversation: ConversationDocument, slots: Slot[]) {
    if (slots.length === 0) return;
    const offeredSlots = slots.map(s => ({
      dateTime: new Date(`${s.date}T${s.startTime}:00`),
      displayText: formatSlotDisplay(s),
    }));

    // Build deduplicated slot history — keep existing + add new ones
    const existingHistory: { dateTime: Date; displayText: string }[] =
      (conversation.slotHistory as any[]) ?? [];
    const existingKeys = new Set(existingHistory.map(s => s.displayText));
    const newEntries = offeredSlots.filter(s => !existingKeys.has(s.displayText));
    const slotHistory = [...existingHistory, ...newEntries];

    await this.conversationModel.findByIdAndUpdate(conversation._id, {
      offeredSlots,
      slotHistory,
    });
  }
}
