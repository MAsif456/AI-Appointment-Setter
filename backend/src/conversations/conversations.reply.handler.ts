/** AI reply generation flows: day-overview availability summary and standard slot-based reply. */
import { Model } from "mongoose";
import { ConversationDocument } from "../database/schemas/conversation.schema";
import { ClinicDocument } from "../database/schemas/clinic.schema";
import { LeadDocument } from "../database/schemas/lead.schema";
import { ChatService, ChatMessage } from "../ai/chat.service";
import { SlotProvider } from "../ai/slot-provider";
import { Slot } from "../ai/interfaces/slot.interface";
import {
  buildDayAvailabilitySection,
  buildSlotPromptSection,
  formatSlotDisplay,
} from "../ai/slot-formatter";
import { normaliseTime, SlotSelectionResult } from "../ai/slot-selector";
import { BookingResult } from "../appointments/appointments.service";
import { UrgencyLevel } from "../ai/urgency-detector.types";
import { EscalationService } from "../ai/escalation.service";
import { ConversationsPersistenceService } from "./conversations.persistence.service";
import { buildSlotContext } from "./slot-context.helper";

/** Dependency bundle passed into each handler function. */
export interface ReplyHandlerDeps {
  slotProvider: SlotProvider;
  chatService: ChatService;
  escalationService: EscalationService;
  persistence: ConversationsPersistenceService;
  conversationModel: Model<ConversationDocument>;
}

/**
 * Handles the DAY_OVERVIEW intent: fetches availability by day and lets the AI
 * present a day-level summary so the lead can pick a specific day.
 */
export async function handleDayOverview(
  conversation: ConversationDocument,
  clinic: ClinicDocument,
  lead: LeadDocument,
  history: ChatMessage[],
  userMessage: string,
  selectionResult: SlotSelectionResult,
  clinicConfig: any,
  leadInfo: any,
  deps: ReplyHandlerDeps,
) {
  const rangeStart = selectionResult.requestedStartDate!;
  const rangeEnd = selectionResult.requestedEndDate!;
  let allSlots = await deps.slotProvider.getAvailableSlots(
    clinicConfig.clinicId,
    rangeStart,
    rangeEnd,
  );

  if (
    selectionResult.timePreference &&
    /\d/.test(selectionResult.timePreference)
  ) {
    allSlots = allSlots.filter(
      (s) => normaliseTime(s.startTime) === selectionResult.timePreference,
    );
  }

  const daySection = buildDayAvailabilitySection(
    allSlots,
    rangeStart,
    rangeEnd,
  );
  await deps.conversationModel.findByIdAndUpdate(conversation._id, {
    awaitingDaySelection: true,
    lastRequestedDateStart: rangeStart,
    lastRequestedDateEnd: rangeEnd,
  });

  const reply = await deps.chatService.sendMessage(
    leadInfo,
    clinicConfig,
    history,
    userMessage,
    {
      slotOptions: {
        slotSection: daySection,
        selectionContext: selectionResult,
      },
    },
  );
  if (!reply) return null;

  await deps.persistence.saveMessage(conversation, clinic, lead, "ai", reply);
  await deps.persistence.updateConversationMeta(conversation, "ai", undefined);
  return {
    reply,
    offeredSlots: [],
    slotSelection: selectionResult,
    bookingResult: null,
  };
}

/**
 * Fetches or reuses slots, generates an AI reply via ChatService, persists messages,
 * and updates conversation metadata. Used for all non-DAY_OVERVIEW reply paths.
 */
export async function buildAndSendReply(
  conversation: ConversationDocument,
  clinic: ClinicDocument,
  lead: LeadDocument,
  history: ChatMessage[],
  userMessage: string,
  selectionResult: SlotSelectionResult | null,
  urgency: "urgent" | "routine" | "flexible",
  bookingResult: BookingResult | null,
  clinicConfig: any,
  leadInfo: any,
  deps: ReplyHandlerDeps,
) {
  const keepExistingSlots =
    selectionResult?.intent === "SLOT_SELECTED" ||
    selectionResult?.intent === "AMBIGUOUS";

  let selected: Slot[];
  let slotSection: string;
  if (keepExistingSlots && conversation.offeredSlots?.length > 0) {
    selected = conversation.offeredSlots.map((s: any) => {
      const dt = new Date(s.dateTime);
      const londonDate = dt.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
      return {
        date: londonDate,
        startTime: dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" }),
        endTime: "",
        dateTime: dt.toISOString(),
      };
    });
    slotSection = buildSlotPromptSection(selected, urgency);
  } else {
    ({ selected, slotSection } = await buildSlotContext(
      deps.slotProvider,
      clinicConfig.clinicId,
      urgency,
      selectionResult,
      conversation.offeredSlots as any[],
    ));
  }

  const historySlots = (conversation.slotHistory as any[]) ?? [];
  const currentSlots = (conversation.offeredSlots as any[]) ?? [];
  const allSlotTexts = [...historySlots, ...currentSlots]
    .map((s: any) => s.displayText as string)
    .filter(Boolean);
  const previouslyOfferedSlots = allSlotTexts.length
    ? [...new Set(allSlotTexts)]
    : undefined;

  if (urgency === "urgent" && selected.length === 0) {
    const msg = await deps.escalationService.handleNoSlotsForUrgent(
      conversation,
      clinic,
      lead,
    );
    await deps.persistence.saveMessage(conversation, clinic, lead, "ai", msg);
    await deps.persistence.updateConversationMeta(
      conversation,
      "ai",
      undefined,
    );
    return {
      reply: msg,
      offeredSlots: [],
      slotSelection: null,
      bookingResult: null,
    };
  }

  const reply = await deps.chatService.sendMessage(
    leadInfo,
    clinicConfig,
    history,
    userMessage,
    {
      slotOptions: {
        slotSection,
        selectionContext: selectionResult ?? undefined,
        previouslyOfferedSlots,
      },
      urgencyContext: {
        level: lead.urgency as UrgencyLevel | "unknown",
        isEmergency: false,
      },
    },
  );
  if (!reply) return null;

  // If the booking failed because the slot was taken between offer and
  // confirmation, override the AI reply with a canned apology. The LLM is
  // not told about the booking failure, so its draft would otherwise claim
  // the appointment is booked — a false confirmation the patient would act on.
  let finalReply: string;
  if (bookingResult?.slotTaken) {
    finalReply =
      "Sorry — that slot was just taken. Would you like me to check other times?";
  } else if (bookingResult?.success && bookingResult.confirmationMessage) {
    finalReply = bookingResult.confirmationMessage;
  } else {
    finalReply = reply;
  }

  await deps.persistence.storeOfferedSlots(conversation, selected);
  await deps.persistence.saveDateContext(conversation, selectionResult);
  await deps.persistence.saveMessage(
    conversation,
    clinic,
    lead,
    "ai",
    finalReply,
  );
  await deps.persistence.updateConversationMeta(conversation, "ai", undefined);

  const offeredSlots = selected.map((s) => ({
    dateTime: s.dateTime ?? new Date(`${s.date}T${s.startTime}:00`).toISOString(),
    displayText: formatSlotDisplay(s),
  }));
  return {
    reply: finalReply,
    offeredSlots,
    slotSelection: selectionResult,
    bookingResult,
  };
}
