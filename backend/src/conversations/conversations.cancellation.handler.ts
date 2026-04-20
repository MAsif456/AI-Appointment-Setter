/**
 * Intercepts cancellation-related messages before they reach ChatService.
 * Handles the full cancellation state machine:
 *   booked → cancelling → (cancelling_warned →) cancelled
 * Also handles DECLINE_CANCEL restoring the booked phase.
 */
import { Types } from "mongoose";
import { ConversationDocument } from "../database/schemas/conversation.schema";
import { ClinicDocument } from "../database/schemas/clinic.schema";
import { LeadDocument } from "../database/schemas/lead.schema";
import { CancellationService } from "../cancellation/cancellation.service";
import {
  CANCEL_KEYWORDS,
  CONFIRM_KEYWORDS,
  DECLINE_CANCEL_KEYWORDS,
  BOOKING_KEYWORDS,
} from "../orchestrator/orchestrator.types";

/** Return shape matches ConversationsService.sendMessage() partial return. */
export type CancellationResult = {
  reply: string;
  offeredSlots: any[];
  slotSelection: null;
  bookingResult: null;
} | null;

/**
 * Checks the current conversation phase and message content to determine
 * whether a cancellation action should intercept the normal chat flow.
 *
 * @param conversation - The active conversation document.
 * @param clinic - The clinic document (used for policy checks).
 * @param lead - The lead document.
 * @param userMessage - The raw message from the lead.
 * @param cancellationService - Service providing cancellation business logic.
 * @param saveMessage - Callback to persist an AI message.
 * @param updateMeta - Callback to update conversation metadata/phase.
 * @returns A partial send-message result, or null to continue normal flow.
 */
export async function handleCancellationIntercept(
  conversation: ConversationDocument,
  clinic: ClinicDocument,
  lead: LeadDocument,
  userMessage: string,
  cancellationService: CancellationService,
  saveMessage: (
    sender: "ai" | "lead",
    content: string,
    urgencyData?: { level: string; score: number },
  ) => Promise<any>,
  updateMeta: (lastFrom: string, phase?: string) => Promise<void>,
  apiKey: string = '',
  locationId: string = '',
): Promise<CancellationResult> {
  const phase = conversation.phase;
  const lower = userMessage.toLowerCase();
  const convId = conversation._id;
  let reply: string | null = null;
  let newPhase: string | undefined;

  if (phase === "booked" && CANCEL_KEYWORDS.some((kw) => lower.includes(kw))) {
    const appointment =
      await cancellationService.checkAppointmentExists(convId);
    if (!appointment) {
      reply =
        "I don't have a booking on file for you. Is there something else I can help with?";
    } else {
      reply = cancellationService.buildConfirmationPrompt(appointment);
      newPhase = "cancelling";
    }
  } else if (phase === "cancelling" || phase === "cancelling_warned") {
    if (CONFIRM_KEYWORDS.some((kw) => lower.includes(kw))) {
      // Policy check only in first confirmation phase
      if (phase === "cancelling") {
        const appointment =
          await cancellationService.checkAppointmentExists(convId);
        if (appointment) {
          const policy = await cancellationService.evaluatePolicy(
            appointment,
            clinic._id,
          );
          if (
            policy.withinNotice &&
            policy.feeEnabled &&
            policy.warningMessage
          ) {
            reply = policy.warningMessage;
            newPhase = "cancelling_warned";
            await saveMessage("ai", reply);
            await updateMeta("ai", newPhase);
            return {
              reply,
              offeredSlots: [],
              slotSelection: null,
              bookingResult: null,
            };
          }
        }
      }
      // Ask for reason or execute cancellation
      const alreadyAsked = await cancellationService.isAwaitingReason(convId);
      if (!alreadyAsked) {
        reply = await cancellationService.requestReason(convId);
      } else {
        const appointment =
          await cancellationService.checkAppointmentExists(convId);
        if (appointment) {
          const result = await cancellationService.executeCancellation(
            convId,
            appointment._id as Types.ObjectId,
            lead.ghlContactId ?? "",
            apiKey,
            undefined,
            locationId,
          );
          reply = result.message;
          newPhase = "cancelled";
        }
      }
    } else if (DECLINE_CANCEL_KEYWORDS.some((kw) => lower.includes(kw))) {
      reply =
        phase === "cancelling_warned"
          ? "No problem! Let's look at rescheduling your appointment instead. When would suit you better?"
          : "No problem, your appointment is still confirmed. Is there anything else I can help with?";
      newPhase = "booked";
    } else {
      // Freeform text — could be the cancellation reason
      const isAwaiting = await cancellationService.isAwaitingReason(convId);
      if (isAwaiting) {
        await cancellationService.storeReason(convId, userMessage);
        const appointment =
          await cancellationService.checkAppointmentExists(convId);
        if (appointment) {
          const result = await cancellationService.executeCancellation(
            convId,
            appointment._id as Types.ObjectId,
            lead.ghlContactId ?? "",
            apiKey,
            userMessage,
            locationId,
          );
          reply = result.message;
          newPhase = "cancelled";
        }
      }
    }
  } else if (
    phase === "cancelled" &&
    BOOKING_KEYWORDS.some((kw) => lower.includes(kw))
  ) {
    return null; // Let ChatService handle re-booking naturally
  }

  if (!reply) return null;

  await saveMessage("ai", reply);
  await updateMeta("ai", newPhase);
  return { reply, offeredSlots: [], slotSelection: null, bookingResult: null };
}
