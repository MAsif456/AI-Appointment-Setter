import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  EscalationNotification,
  EscalationNotificationDocument,
} from "../database/schemas/escalation-notification.schema";
import { NotificationBusService } from "../notifications/notification-bus.service";
import { EscalationContext } from "./escalation.types";

/**
 * Persists escalation notifications and pushes them to the in-app
 * SSE bus so assigned staff see them in real time.
 *
 * Split out of `EscalationService` so the orchestrator stays under
 * 200 lines and the DB + bus concern is independently testable.
 */
@Injectable()
export class EscalationNotifierService {
  private readonly logger = new Logger(EscalationNotifierService.name);

  constructor(
    @InjectModel(EscalationNotification.name)
    private readonly notificationModel: Model<EscalationNotificationDocument>,
    private readonly bus: NotificationBusService,
  ) {}

  /**
   * Creates the persistent notification and publishes the event.
   *
   * Idempotency is the caller's responsibility — we trust that the
   * orchestrator has already guarded against double escalation via
   * the conversation flag flip. This method is the point of no
   * return: once the doc is written, the bell fires.
   *
   * @returns the new notification id (or null on persistence failure)
   */
  async recordAndPublish(ctx: EscalationContext): Promise<string | null> {
    try {
      const leadName =
        `${ctx.lead.firstName ?? ""} ${ctx.lead.lastName ?? ""}`.trim() ||
        "Unknown lead";

      const created = await this.notificationModel.create({
        conversationId: ctx.conversation._id,
        leadId: ctx.lead._id,
        clinicId: ctx.clinic._id,
        trigger: ctx.trigger,
        reason: ctx.reason,
        leadName,
        leadPhone: ctx.lead.phone ?? "",
        clinicName: ctx.clinic.name ?? "Unknown clinic",
      });

      // Fire-and-forget publish — subscribers are in-process and
      // cannot fail synchronously, but we isolate any surprise here.
      try {
        this.bus.publish({
          id: created._id.toString(),
          conversationId: ctx.conversation._id.toString(),
          leadId: ctx.lead._id.toString(),
          leadName,
          leadPhone: ctx.lead.phone ?? "",
          clinicId: ctx.clinic._id.toString(),
          clinicName: ctx.clinic.name ?? "Unknown clinic",
          trigger: ctx.trigger,
          reason: ctx.reason,
          createdAt: new Date().toISOString(),
        });
      } catch (busError) {
        this.logger.warn(
          `Notification bus publish failed (doc still persisted): ${(busError as Error).message}`,
        );
      }

      return created._id.toString();
    } catch (error) {
      // Persistence failure is loud but non-fatal — the staff still
      // get an SMS via the GHL side of the escalation service.
      this.logger.error(
        `Failed to persist escalation notification: ${(error as Error).message}`,
      );
      return null;
    }
  }
}
