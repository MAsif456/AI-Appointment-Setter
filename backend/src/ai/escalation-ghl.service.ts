import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Lead, LeadDocument } from "../database/schemas/lead.schema";
import { ClinicDocument } from "../database/schemas/clinic.schema";
import { ConversationDocument } from "../database/schemas/conversation.schema";
import { GhlApiService } from "../ghl/ghl-api.service";
import { retryWithBackoff } from "../common/retry-utils";
import { buildStaffAlert } from "./urgency-messages";

/** GHL tag used for every escalation, regardless of trigger type. */
const ESCALATED_TAG = "escalated";

/** GHL custom field key that records the human-readable reason. */
const ESCALATION_REASON_FIELD = "escalation_reason";

/**
 * Owns every GHL call that fires on an escalation:
 *  - Add the `escalated` tag to the lead document and GHL contact
 *  - Set the `escalation_reason` custom field on the GHL contact
 *  - Send the SMS alert to the clinic staff
 *
 * Each call is wrapped in `retryWithBackoff` (3 attempts, jittered
 * exponential backoff) so transient GHL failures don't lose the
 * notification. Errors from the final retry are logged and swallowed
 * — the in-app staff notification still fires regardless of GHL.
 */
@Injectable()
export class EscalationGhlService {
  private readonly logger = new Logger(EscalationGhlService.name);

  constructor(
    private readonly ghlApiService: GhlApiService,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
  ) {}

  /**
   * Runs the full GHL side of an escalation.
   * All three calls are attempted independently so one failure does
   * not cascade. Every call retries up to 3 times on its own.
   */
  async applyEscalationToGhl(
    lead: LeadDocument,
    conversation: ConversationDocument,
    clinic: ClinicDocument,
    reason: string,
  ): Promise<void> {
    const contactId =
      lead.ghlContactId ?? conversation.ghlContactId ?? lead._id.toString();

    await Promise.allSettled([
      this.addEscalatedTag(lead, contactId),
      this.setReasonCustomField(contactId, reason),
      this.notifyStaff(clinic, lead, reason, contactId),
    ]);
  }

  /** Adds the `escalated` tag to both the lead doc and GHL contact. */
  private async addEscalatedTag(
    lead: LeadDocument,
    contactId: string,
  ): Promise<void> {
    // Update local lead record first — it's the source of truth for
    // in-app views even if GHL is down.
    if (!lead.ghlTags?.includes(ESCALATED_TAG)) {
      await this.leadModel.findByIdAndUpdate(lead._id, {
        $addToSet: { ghlTags: ESCALATED_TAG },
      });
    }

    try {
      await retryWithBackoff(
        () => this.ghlApiService.addContactTag(contactId, ESCALATED_TAG),
        { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 4000 },
      );
    } catch (error) {
      this.logger.error(
        `GHL add tag '${ESCALATED_TAG}' for ${contactId} failed after retries: ${(error as Error).message}`,
      );
    }
  }

  /** Sets the `escalation_reason` custom field on the GHL contact. */
  private async setReasonCustomField(
    contactId: string,
    reason: string,
  ): Promise<void> {
    try {
      await retryWithBackoff(
        () =>
          this.ghlApiService.updateContactCustomField(
            contactId,
            ESCALATION_REASON_FIELD,
            reason,
          ),
        { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 4000 },
      );
    } catch (error) {
      this.logger.error(
        `GHL set ${ESCALATION_REASON_FIELD} for ${contactId} failed after retries: ${(error as Error).message}`,
      );
    }
  }

  /** Sends the SMS alert to the clinic's GHL-linked staff number. */
  private async notifyStaff(
    _clinic: ClinicDocument,
    lead: LeadDocument,
    reason: string,
    contactId: string,
  ): Promise<void> {
    try {
      await this.ghlApiService.sendMessageWithRetry({
        type: "SMS",
        contactId,
        message: buildStaffAlert(lead, reason),
      });
    } catch (error) {
      this.logger.warn(
        `GHL staff notification failed: ${(error as Error).message}`,
      );
    }
  }
}
