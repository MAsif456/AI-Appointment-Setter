/**
 * Handles returning patient re-entry when an inbound message arrives on a
 * conversation that is in a terminal phase (booked, confirmed, cancelled, etc.).
 *
 * Extracted from orchestrator.inbound-message.ts to keep that file under the
 * 200-line limit. Follows the same standalone-function pattern used by
 * orchestrator.new-lead.ts and orchestrator.detect-intent.ts.
 */
import { Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { ConversationsService } from "../ghl/conversations.service";
import { ConversationsService as ChatConversationsService } from "../conversations/conversations.service";
import { PatientHistoryService, ReturningPatientResult } from "../patient-history/patient-history.service";
import { ConversationDocument } from "../database/schemas/conversation.schema";
import { FALLBACK_AI_UNAVAILABLE } from "./orchestrator.types";

/** Dependencies required by the re-entry handler (subset of InboundMessageDeps). */
export interface ReentryDeps {
  conversationsService: ConversationsService;
  chatConversationsService: ChatConversationsService;
  patientHistoryService: PatientHistoryService;
  logger: Logger;
}

/**
 * Resets a terminal-phase conversation and generates the appropriate greeting.
 *
 * Flow:
 *   1. Look up the lead to get phone/email for PatientHistory query.
 *   2. Call findReturningPatient() — null-on-failure (graceful degradation).
 *   3. If match: set returning patient flags + store historical postcode.
 *   4. Reset conversation in place (preserves flags, clears messages).
 *   5. Generate greeting via startConversation (returning or new patient).
 *
 * @returns The greeting string to send to the lead.
 */
export async function handleReentryForTerminalConversation(
  conversation: ConversationDocument,
  clinicConfig: ClinicConfig,
  deps: ReentryDeps,
  correlationId?: string,
): Promise<string> {
  const { conversationsService, chatConversationsService, patientHistoryService, logger } = deps;
  const cid = correlationId ? `[${correlationId}] ` : "";
  const conversationId = conversation._id as Types.ObjectId;

  // Step 1: Look up lead for phone/email (needed by findReturningPatient)
  const lead = await conversationsService.findLeadById(
    conversation.leadId as Types.ObjectId,
  );

  // Step 2: Check PatientHistory — null-on-failure built into the service
  let returningPatient: ReturningPatientResult | null = null;
  if (lead) {
    const expiryDays = clinicConfig.patientDataExpiryDays ?? 365;
    returningPatient = await patientHistoryService.findReturningPatient(
      lead.phone,
      lead.email,
      clinicConfig.clinicId,
      expiryDays,
    );
  }

  // Step 3: Set returning patient flags if a match was found
  if (returningPatient) {
    await conversationsService.updateReturningPatientFlags(conversationId, {
      isReturningPatient: true,
      previousConversationId: returningPatient.previousConversationId,
      returningPatientConfidence: returningPatient.confidence,
    });

    if (returningPatient.validatedPostcode) {
      await conversationsService.setContext(
        conversationId,
        "returningPatientPostcode",
        returningPatient.validatedPostcode,
      );
    }

    logger.log(
      `${cid}RETURNING_PATIENT_DETECTED clinicId=${clinicConfig.clinicId} ` +
        `contactId=${conversation.ghlContactId} confidence=${returningPatient.confidence}`,
    );
  }

  // Step 4: Reset conversation — phase → greeting, messages cleared, flags preserved
  await chatConversationsService.resetConversation(conversationId.toHexString());

  // Step 5: Generate greeting (checks isReturningPatient flag internally)
  const greeting = await chatConversationsService.startConversation(
    conversationId.toHexString(),
  );

  logger.log(
    `${cid}Re-entry processed — contactId=${conversation.ghlContactId}, ` +
      `clinicId=${clinicConfig.clinicId}, returning=${!!returningPatient}`,
  );

  return greeting ?? FALLBACK_AI_UNAVAILABLE;
}
