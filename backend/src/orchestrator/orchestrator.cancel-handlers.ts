/**
 * Cancellation response handlers for the orchestrator.
 *
 * Extracted to keep orchestrator.service.ts under the 200-line limit.
 * Each handler is a standalone function receiving its dependencies as arguments.
 */
import { Types } from "mongoose";
import { CancellationService } from "../cancellation/cancellation.service";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { OrchestratorContext, FALLBACK_MESSAGE } from "./orchestrator.types";

const NO_BOOKING_MSG =
  "I don't have a booking on file for you. Is there something else I can help with?";

/** Handles CANCEL intent: checks for existing appointment, returns confirmation prompt or guard. */
export async function handleCancelIntent(
  context: OrchestratorContext,
  cancellationService: CancellationService,
): Promise<string> {
  if (!context.conversationId) return NO_BOOKING_MSG;
  const appointment = await cancellationService.checkAppointmentExists(
    new Types.ObjectId(context.conversationId),
  );
  if (!appointment) return NO_BOOKING_MSG;
  return cancellationService.buildConfirmationPrompt(appointment);
}

/** Evaluates policy on CONFIRM_CANCEL: asks for reason, executes cancellation, or returns fee warning. */
export async function handleConfirmCancel(
  context: OrchestratorContext,
  clinicConfig: ClinicConfig,
  cancellationService: CancellationService,
): Promise<string> {
  if (!context.conversationId || !context.ghlContactId) return FALLBACK_MESSAGE;
  const convId = new Types.ObjectId(context.conversationId);
  const appointment = await cancellationService.checkAppointmentExists(convId);
  if (!appointment) return NO_BOOKING_MSG;

  // If coming from 'cancelling' (first confirmation), check policy
  if (context.phase === "cancelling") {
    const policy = await cancellationService.evaluatePolicy(
      appointment,
      new Types.ObjectId(clinicConfig.clinicId),
    );
    if (policy.withinNotice && policy.feeEnabled && policy.warningMessage) {
      return policy.warningMessage;
    }
  }

  // Before executing, ask for a reason if not yet requested
  const alreadyAsked = await cancellationService.isAwaitingReason(convId);
  if (!alreadyAsked) {
    return cancellationService.requestReason(convId);
  }

  // Reason already collected (or skipped) — execute cancellation
  const result = await cancellationService.executeCancellation(
    convId,
    appointment._id as Types.ObjectId,
    context.ghlContactId,
    clinicConfig.ghlApiKey ?? '',
    undefined,
    clinicConfig.ghlLocationId,
  );
  return result.message;
}

/** Handles DECLINE_CANCEL intent: reassures lead or offers rescheduling. */
export async function handleDeclineCancel(
  context: OrchestratorContext,
): Promise<string> {
  if (context.phase === "cancelling_warned") {
    return "No problem! Let's look at rescheduling your appointment instead. When would suit you better?";
  }
  return "No problem, your appointment is still confirmed. Is there anything else I can help with?";
}

/** Handles freeform text in cancelling phases — stores as reason and executes cancellation. */
export async function handleCancellationReason(
  context: OrchestratorContext,
  clinicConfig: ClinicConfig,
  cancellationService: CancellationService,
): Promise<string> {
  const convId = new Types.ObjectId(context.conversationId!);
  const isAwaiting = await cancellationService.isAwaitingReason(convId);
  if (!isAwaiting) return FALLBACK_MESSAGE;

  // The last user message is the reason
  const lastMsg = context.messages[context.messages.length - 1];
  const reason = lastMsg?.role === "user" ? lastMsg.content : undefined;
  if (reason) await cancellationService.storeReason(convId, reason);

  const appointment = await cancellationService.checkAppointmentExists(convId);
  if (!appointment || !context.ghlContactId) return FALLBACK_MESSAGE;

  const result = await cancellationService.executeCancellation(
    convId,
    appointment._id as Types.ObjectId,
    context.ghlContactId,
    clinicConfig.ghlApiKey ?? '',
    reason,
    clinicConfig.ghlLocationId,
  );
  return result.message;
}
