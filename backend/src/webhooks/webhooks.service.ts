import { Injectable, Logger } from "@nestjs/common";
import { ClinicsService } from "../clinics/clinics.service";
import { ClinicDocument } from "../database/schemas/clinic.schema";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { OrchestratorService } from "../orchestrator/orchestrator.service";
import {
  GhlWebhookPayload,
  GhlContactCreatePayload,
  GhlInboundMessagePayload,
} from "./dto/ghl-webhook.dto";

export interface WebhookResponse {
  success: boolean;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly clinicsService: ClinicsService,
    private readonly orchestratorService: OrchestratorService,
  ) {}

/**
 * Handles a GHL webhook event.
 *
 * Logs the event type and locationId of the GHL webhook payload.
 * If the locationId is missing, logs a warning and returns early.
 * If the clinic associated with the locationId is inactive, logs a message and returns early.
 * If the event type is unknown, logs a warning and returns early.
 *
 * Calls the appropriate handler function based on the event type:
 *   - ContactCreate: handleContactCreate
 *   - InboundMessage: handleInboundMessage
 *
 * Catches and logs any errors that occur during webhook processing.
 *
 * Returns a WebhookResponse object indicating the success of the webhook processing.
 * 
 * Ref: https://www.apisec.ai/blog/securing-webhook-endpoints-best-practices
 */
  async handleGhlWebhook(
    payload: Record<string, unknown>,
  ): Promise<WebhookResponse> {
    const ghlType = typeof payload.type === "string" ? payload.type : "unknown";
    const location = payload.location as Record<string, unknown> | undefined;
    const ghlLocationId =
      typeof location?.id === "string" ? location.id : "unknown";
    this.logger.log(
      `GHL webhook received: type=${ghlType}, locationId=${ghlLocationId}`,
    );

    try {
      const ghlPayload = payload as GhlWebhookPayload;
      const locationId = ghlPayload.location?.id;
      const { type } = ghlPayload;

      if (!locationId) {
        this.logger.warn("GHL webhook payload missing locationId field");
        return { success: true };
      }

      const clinic = await this.clinicsService.findByGhlLocationId(locationId);

      if (!clinic) {
        this.logger.log(`Unknown GHL Location ID: ${locationId}`);
        return { success: true };
      }

      if (!clinic.isActive) {
        this.logger.log("Clinic is inactive, ignoring webhook");
        return { success: true };
      }

      const clinicConfig = this.buildClinicConfig(clinic);

      switch (type) {
        case "ContactCreate":
          await this.handleContactCreate(
            payload as GhlContactCreatePayload,
            clinic.name,
            clinicConfig,
          );
          break;
        case "InboundMessage":
          await this.handleInboundMessage(
            payload as GhlInboundMessagePayload,
            clinic.name,
            clinicConfig,
          );
          break;
        default:
          this.logger.warn(`Unrecognised GHL event type: ${type}`);
      }
    } catch (err) {
      this.logger.error(
        `Error processing GHL webhook: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    return { success: true };
  }

  private async handleContactCreate(
    payload: GhlContactCreatePayload,
    clinicName: string,
    clinicConfig: ClinicConfig,
  ): Promise<void> {
    const { first_name, last_name, phone, email, issue } = payload;
    this.logger.log(`Routing lead to clinic: ${clinicName}`);
    this.logger.log(
      `Lead details — name: ${first_name ?? ""} ${last_name ?? ""}, phone: ${phone ?? "N/A"}, email: ${email ?? "N/A"}, issue: ${issue ?? "N/A"}`,
    );
    await this.orchestratorService.handleNewLead(payload, clinicConfig);
  }

  private async handleInboundMessage(
    payload: GhlInboundMessagePayload,
    clinicName: string,
    clinicConfig: ClinicConfig,
  ): Promise<void> {
    const { id: contactId, conversationId } = payload;
    const messageBody = payload.message?.body;
    this.logger.log(`Routing message to clinic: ${clinicName}`);
    this.logger.log(
      `Message details — contactId: ${contactId ?? "N/A"}, conversationId: ${conversationId ?? "N/A"}, content: ${messageBody ?? "N/A"}`,
    );
    await this.orchestratorService.handleInboundMessage(payload, clinicConfig);
  }

  private buildClinicConfig(clinic: ClinicDocument): ClinicConfig {
    const tone =
      clinic.aiConfig?.tone === "professional" ? "Professional" : "Friendly";
    return {
      clinicId: clinic._id.toString(),
      name: clinic.name,
      tone,
      greetingTemplate: clinic.aiConfig?.greetingTemplate || undefined,
      serviceAreas: clinic.serviceAreas?.map((sa) => sa.postcodePrefix) ?? [],
      customInstructions: clinic.aiConfig?.customInstructions || undefined,
      ghlLocationId: clinic.ghlLocationId,
      isActive: clinic.isActive,
    };
  }
}
