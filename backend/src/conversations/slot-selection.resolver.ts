/**
 * Resolves the slot selection intent from a lead's message given the current conversation state.
 * Handles week-range detection, day-selection follow-up, and time-of-day preference enrichment.
 * Pattern constants live in slot-selection.patterns.ts.
 */
import { Model } from 'mongoose';
import { Logger } from '@nestjs/common';
import { ConversationDocument } from '../database/schemas/conversation.schema';
import { detectSlotSelection, detectDateRangePreference, normaliseTime, SlotSelectionResult } from '../ai/slot-selector';
import { WEEK_PATTERNS, TIME_PREF_PATTERNS, FURTHER_PHRASES } from './slot-selection.patterns';

/**
 * Determines the slot selection intent from the current message and conversation state.
 * @param conversation - The current conversation document.
 * @param userMessage - The raw message from the lead.
 * @param conversationModel - Used to update awaitingDaySelection state.
 * @param logger - Logger for error reporting.
 * @returns The resolved SlotSelectionResult, or null if no specific intent was detected.
 */
export async function resolveSlotSelectionIntent(
  conversation: ConversationDocument,
  userMessage: string,
  conversationModel: Model<ConversationDocument>,
  logger: Logger,
): Promise<SlotSelectionResult | null> {
  const lowerMsg = userMessage.toLowerCase();

  if (WEEK_PATTERNS.some(p => p.test(lowerMsg))) {
    const dateRange = detectDateRangePreference(userMessage);
    if (dateRange) {
      const weekTimeMatch = lowerMsg.match(/\b(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))\b/i)
        || lowerMsg.match(/\b(\d{1,2}[.:]\d{2})\b/)
        || lowerMsg.match(/(?:at|around|for)\s+(\d{1,2}(?:[.:]\d{2})?(?:\s*(?:am|pm))?)\b/i);
      const weekTimePref = weekTimeMatch ? normaliseTime(weekTimeMatch[1].trim()) : undefined;
      return {
        intent: 'DAY_OVERVIEW',
        requestedStartDate: dateRange.startDate,
        requestedEndDate: dateRange.endDate,
        ...(weekTimePref ? { timePreference: weekTimePref } : {}),
      };
    }
  }

  if (conversation.awaitingDaySelection) {
    return resolveAwaitingDaySelection(conversation, userMessage, lowerMsg, conversationModel);
  }

  if (conversation.offeredSlots?.length > 0) {
    return resolveFromOfferedSlots(conversation, userMessage, lowerMsg, logger);
  }

  if (FURTHER_PHRASES.some(p => lowerMsg.includes(p))) {
    return { intent: 'FURTHER_DATE' };
  }
  const dateRange = detectDateRangePreference(userMessage);
  if (dateRange) {
    return { intent: 'DIFFERENT_DATE', requestedStartDate: dateRange.startDate, requestedEndDate: dateRange.endDate };
  }
  return null;
}

/**
 * Resolves intent when the conversation is awaiting a day choice after a DAY_OVERVIEW.
 * @param conversation - The current conversation document.
 * @param userMessage - The raw message from the lead.
 * @param lowerMsg - Lowercased message for pattern matching.
 * @param conversationModel - Used to clear the awaitingDaySelection flag.
 */
async function resolveAwaitingDaySelection(
  conversation: ConversationDocument,
  userMessage: string,
  lowerMsg: string,
  conversationModel: Model<ConversationDocument>,
): Promise<SlotSelectionResult | null> {
  const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const pickedDay = dayNames.find(d => lowerMsg.includes(d));

  if (pickedDay) {
    const savedStart = conversation.lastRequestedDateStart ? new Date(conversation.lastRequestedDateStart) : undefined;
    const savedEnd = conversation.lastRequestedDateEnd ? new Date(conversation.lastRequestedDateEnd) : undefined;
    const dateRange = savedStart
      ? { startDate: savedStart, endDate: savedEnd! }
      : (detectDateRangePreference(userMessage) ?? detectDateRangePreference('this week'));
    await conversationModel.findByIdAndUpdate(conversation._id, {
      awaitingDaySelection: false, lastRequestedDay: pickedDay,
    });
    return {
      intent: 'DIFFERENT_DATE',
      requestedDate: pickedDay.charAt(0).toUpperCase() + pickedDay.slice(1),
      requestedStartDate: dateRange?.startDate,
      requestedEndDate: dateRange?.endDate,
    };
  }

  // Check for a time reference (e.g. "any slots at 2pm?")
  const timeInMsg = lowerMsg.match(/\b(\d{1,2}(?:[.:]\d{2})?\s*(?:am|pm))\b/i)
    || lowerMsg.match(/\b(\d{1,2}[.:]\d{2})\b/)
    || lowerMsg.match(/\b(\d{1,2}(?:[.:]\d{2})?)\s*(?:o'?clock|slots?|free|available|appointment)/i)
    || lowerMsg.match(/(?:at|around|for|have)\s+(\d{1,2}(?:[.:]\d{2})?(?:\s*(?:am|pm))?)\b/i);

  if (timeInMsg && conversation.lastRequestedDateStart) {
    return {
      intent: 'DAY_OVERVIEW',
      requestedStartDate: new Date(conversation.lastRequestedDateStart),
      requestedEndDate: conversation.lastRequestedDateEnd ? new Date(conversation.lastRequestedDateEnd) : undefined,
      timePreference: normaliseTime(timeInMsg[1].trim()),
    };
  }

  const dateRange = detectDateRangePreference(userMessage);
  if (dateRange) {
    await conversationModel.findByIdAndUpdate(conversation._id, { awaitingDaySelection: false });
    return { intent: 'DIFFERENT_DATE', requestedStartDate: dateRange.startDate, requestedEndDate: dateRange.endDate };
  }

  if (conversation.lastRequestedDateStart) {
    await conversationModel.findByIdAndUpdate(conversation._id, { awaitingDaySelection: false });
    return {
      intent: 'DIFFERENT_DATE',
      requestedStartDate: new Date(conversation.lastRequestedDateStart),
      requestedEndDate: conversation.lastRequestedDateEnd ? new Date(conversation.lastRequestedDateEnd) : undefined,
    };
  }

  return null;
}

/**
 * Resolves intent when slots have previously been offered, applying time-preference enrichment.
 * @param conversation - The current conversation document.
 * @param userMessage - The raw message from the lead.
 * @param lowerMsg - Lowercased message for pattern matching.
 * @param logger - Logger for error reporting.
 */
function resolveFromOfferedSlots(
  conversation: ConversationDocument,
  userMessage: string,
  lowerMsg: string,
  logger: Logger,
): SlotSelectionResult | null {
  let selectionResult: SlotSelectionResult | null = null;
  try {
    selectionResult = detectSlotSelection(userMessage, conversation.offeredSlots);
  } catch (error) {
    logger.error('Slot detection failed, continuing without selection', error);
  }

  const detectedTimePref = TIME_PREF_PATTERNS.find(tp => tp.pattern.test(lowerMsg))?.pref;

  if (selectionResult?.intent === 'AMBIGUOUS' && detectedTimePref) {
    selectionResult = { intent: 'DIFFERENT_TIME', timePreference: detectedTimePref };
  }
  if (selectionResult?.intent === 'DIFFERENT_DATE' && detectedTimePref && !selectionResult.timePreference) {
    selectionResult.timePreference = detectedTimePref;
  }
  if (
    selectionResult?.intent === 'DIFFERENT_DATE' &&
    selectionResult.requestedDate &&
    !selectionResult.requestedStartDate &&
    conversation.lastRequestedDateStart
  ) {
    selectionResult.requestedStartDate = new Date(conversation.lastRequestedDateStart);
    selectionResult.requestedEndDate = conversation.lastRequestedDateEnd
      ? new Date(conversation.lastRequestedDateEnd) : undefined;
  }
  if (selectionResult?.intent === 'DIFFERENT_TIME') {
    if (conversation.lastRequestedDay) {
      selectionResult.requestedDate =
        conversation.lastRequestedDay.charAt(0).toUpperCase() + conversation.lastRequestedDay.slice(1);
    }
    if (conversation.lastRequestedDateStart) {
      selectionResult.requestedStartDate = new Date(conversation.lastRequestedDateStart);
      selectionResult.requestedEndDate = conversation.lastRequestedDateEnd
        ? new Date(conversation.lastRequestedDateEnd) : undefined;
    }
  }

  return selectionResult;
}
