import { Types } from "mongoose";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { ConversationsService } from "../ghl/conversations.service";
import { PostcodeValidationService } from "./postcode-validation.service";
import { IntentResult } from "./orchestrator.types";
import { ConversationDocument } from "../database/schemas/conversation.schema";

/**
 * Advances the conversation phase based on the detected intent and current phase.
 * @param intent The detected intent from the AI.
 * @param response The response message from the AI.
 * @param currentPhase The current phase of the conversation.
 * @param conversationObjectId The ObjectId of the conversation document.
 * @param conversation The conversation document.
 * @param conversationsService The service for managing conversations.
 * @param postcodeValidationService The service for validating postcodes.
 * @param clinicConfig The clinic configuration.
 */
export async function advancePhaseFromIntent(
  intent: IntentResult,
  response: string,
  currentPhase: string,
  conversationObjectId: Types.ObjectId,
  conversation: ConversationDocument,
  conversationsService: ConversationsService,
  postcodeValidationService: PostcodeValidationService,
  clinicConfig: ClinicConfig,
): Promise<void> {
  if (intent.intent === "PROVIDE_POSTCODE") {
    const { postcode } = intent.data;
    const inArea = postcodeValidationService.isInServiceArea(
      postcode,
      clinicConfig.serviceAreas ?? [],
    );
    if (inArea) {
      await conversationsService.setContext(
        conversationObjectId,
        "validatedPostcode",
        postcode,
      );
      await conversationsService.updatePhase(conversationObjectId, "qualified");
    } else {
      await conversationsService.updatePhase(conversationObjectId, "declined");
    }
  } else if (intent.intent === "WANT_TO_BOOK") {
    await conversationsService.updatePhase(conversationObjectId, "booking");
  } else if (intent.intent === "CANCEL") {
    await conversationsService.updatePhase(conversationObjectId, "cancelling");
  } else if (intent.intent === "CONFIRM_CANCEL") {
    const isWarning =
      response.includes("incur a fee") ||
      response.includes("Would you like to proceed");
    if (isWarning) {
      await conversationsService.updatePhase(
        conversationObjectId,
        "cancelling_warned",
      );
    }
  } else if (intent.intent === "DECLINE_CANCEL") {
    if (currentPhase === "cancelling_warned") {
      await conversationsService.updatePhase(
        conversationObjectId,
        "rescheduling",
      );
    } else {
      await conversationsService.updatePhase(conversationObjectId, "booked");
    }
  } else if (intent.intent === "DETAILS_UNCHANGED") {
    const postcode = conversation.context?.get("returningPatientPostcode");
    if (postcode) {
      await conversationsService.setContext(
        conversationObjectId,
        "validatedPostcode",
        postcode,
      );
    }
    await conversationsService.updatePhase(conversationObjectId, "booking");
  } else if (intent.intent === "DETAILS_CHANGED") {
    await conversationsService.updatePhase(conversationObjectId, "qualifying");
  }
}
