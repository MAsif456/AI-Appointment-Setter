/**
 * Service responsible for processing incoming GoHighLevel (GHL) webhook payloads.
 *
 * Routes events to the correct clinic based on the location.id field in the payload.
 * After routing, delegates to OrchestratorService which handles the full AI conversation
 * flow (US-10).
 *
 * Always resolves successfully — exceptions are caught and logged so that GHL never
 * receives a non-200 response, which would otherwise trigger unwanted retries.
 *
 * GHL payload field mapping (from GHL standard data):
 *   - Location ID: payload.location.id  (nested, not root-level)
 *   - Contact name: payload.first_name / payload.last_name  (snake_case)
 *   - Message content: payload.message.body  (nested)
 *   - Event type: payload.type  (custom key added in GHL Automation)
 */
import { Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { ClinicsService } from "../clinics/clinics.service";
import { ClinicDocument } from "../database/schemas/clinic.schema";
import { ClinicConfig } from "../ai/interfaces/clinic-config.interface";
import { OrchestratorService } from "../orchestrator/orchestrator.service";
import { generateCorrelationId } from "../common/correlation-id";
import {
  GhlWebhookPayload,
  GhlContactCreatePayload,
  GhlInboundMessagePayload,
} from "./dto/ghl-webhook.dto";
import { validateGhlPayload } from "./dto/ghl-payload-validator";

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
   * Entry point for all incoming GHL webhook events.
   *
   * Processing steps:
   *   1. Extract and log metadata only (type + locationId) — no PII in logs.
   *   2. Extract location.id — warn and return early if absent.
   *   3. Look up the clinic by GHL Location ID.
   *   4. If clinic is not found, log and return 200 without processing.
   *   5. If clinic is inactive, log and return 200 without processing.
   *   6. Build the ClinicConfig from the clinic document.
   *   7. Dispatch to the appropriate handler based on event type.
   *
   * The entire body is wrapped in try/catch so that any unexpected error
   * is logged and a 200 response is still returned to GHL.
   *
   * @param payload - The raw JSON request body sent by GHL.
   * @returns Always resolves to { success: true }.
   */
  async handleGhlWebhook(
    payload: Record<string, unknown>,
  ): Promise<WebhookResponse> {
    const correlationId = generateCorrelationId();

    // GHL workflow webhooks put custom data keys under `customData`, not at root.
    // Merge customData fields into the root payload so downstream code sees them.
    const customData = payload.customData as
      | Record<string, unknown>
      | undefined;
    if (customData) {
      for (const [key, value] of Object.entries(customData)) {
        if (value !== undefined && value !== null && value !== "") {
          payload[key] = payload[key] ?? value;
        }
      }
    }

    // Normalise contact_id → id (GHL uses contact_id in standard webhook data)
    if (!payload.id && payload.contact_id) {
      payload.id = payload.contact_id;
    }

    // Normalise Issue → issue (GHL form field has capital I)
    if (!payload.issue && payload.Issue) {
      payload.issue = payload.Issue;
    }

    const ghlType = typeof payload.type === "string" ? payload.type : "unknown";
    const location = payload.location as Record<string, unknown> | undefined;
    const ghlLocationId =
      typeof location?.id === "string"
        ? location.id
        : typeof payload.locationId === "string"
          ? payload.locationId
          : "unknown";
    this.logger.log(
      `[${correlationId}] GHL webhook received: type=${ghlType}, locationId=${ghlLocationId}`,
    );

    try {
      // Discriminated-union validation: pick the strict DTO matching the
      // `type` and reject malformed payloads early. Returns success
      // regardless so GHL does not enter a retry loop on a bad payload —
      // failures are logged for investigation.
      const validation = await validateGhlPayload(payload);
      if (!validation.valid) {
        this.logger.warn(
          `[${correlationId}] GHL payload failed validation for type=${validation.type}: ` +
            validation.errors
              .map((e) => `${e.property}=${Object.values(e.constraints ?? {}).join("|")}`)
              .join(", "),
        );
        return { success: true };
      }

      const ghlPayload = payload as GhlWebhookPayload;
      const locationId = ghlPayload.location?.id ?? ghlPayload.locationId;
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

      const clinicConfig = await this.buildClinicConfig(clinic);

      switch (type) {
        case "ContactCreate":
          await this.handleContactCreate(
            payload as GhlContactCreatePayload,
            clinic.name,
            clinicConfig,
            correlationId,
          );
          break;
        case "InboundMessage":
          await this.handleInboundMessage(
            payload as GhlInboundMessagePayload,
            clinic.name,
            clinicConfig,
            correlationId,
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
    correlationId: string,
  ): Promise<void> {
    const { first_name, last_name, phone, email, issue } = payload;
    this.logger.log(`[${correlationId}] Routing lead to clinic: ${clinicName}`);
    this.logger.log(
      `[${correlationId}] Lead details — name: ${first_name ?? ""} ${last_name ?? ""}, phone: ${phone ?? "N/A"}, email: ${email ?? "N/A"}, issue: ${issue ?? "N/A"}`,
    );
    await this.orchestratorService.handleNewLead(
      payload,
      clinicConfig,
      correlationId,
    );
  }

  private async handleInboundMessage(
    payload: GhlInboundMessagePayload,
    clinicName: string,
    clinicConfig: ClinicConfig,
    correlationId: string,
  ): Promise<void> {
    const { id: contactId, conversationId } = payload;
    const messageBody = payload.message?.body;
    this.logger.log(
      `[${correlationId}] Routing message to clinic: ${clinicName}`,
    );
    this.logger.log(
      `[${correlationId}] Message details — contactId: ${contactId ?? "N/A"}, conversationId: ${conversationId ?? "N/A"}, content: ${messageBody ?? "N/A"}`,
    );
    await this.orchestratorService.handleInboundMessage(
      payload,
      clinicConfig,
      correlationId,
    );
  }

  private async buildClinicConfig(clinic: ClinicDocument): Promise<ClinicConfig> {
    const tone =
      clinic.aiConfig?.tone === "professional" ? "Professional" : "Friendly";
    const clinicId = (clinic._id as Types.ObjectId).toString();

    let ghlApiKey: string | undefined;
    try {
      ghlApiKey = await this.clinicsService.getDecryptedApiKey(clinicId);
    } catch {
      // Clinic has no stored API key — GHL calls will be skipped or fail gracefully.
    }

    return {
      clinicId: clinic._id.toString(),
      name: clinic.name,
      tone,
      greetingTemplate: clinic.aiConfig?.greetingTemplate || undefined,
      returningPatientGreetingTemplate:
        clinic.aiConfig?.returningPatientGreetingTemplate || undefined,
      patientDataExpiryDays: clinic.aiConfig?.patientDataExpiryDays ?? 365,
      serviceAreas: clinic.serviceAreas?.map((sa) => sa.postcodePrefix) ?? [],
      customInstructions: clinic.aiConfig?.customInstructions || undefined,
      ghlLocationId: clinic.ghlLocationId,
      isActive: clinic.isActive,
      ghlApiKey,
    };
  }
}
