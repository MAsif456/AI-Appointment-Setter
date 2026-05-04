import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  EscalationNotification,
  EscalationNotificationSchema,
} from "../database/schemas/escalation-notification.schema";
import { Message, MessageSchema } from "../database/schemas/message.schema";
import { Lead, LeadSchema } from "../database/schemas/lead.schema";
import { AuthModule } from "../auth/auth.module";
import { EscalationsController } from "./escalations.controller";
import { EscalationsService } from "./escalations.service";

/**
 * REST surface for the staff-facing escalation queue.
 *
 * `AuthModule` is imported so `JwtAuthGuard` resolves the user onto
 * the request object. `EscalationNotifierService` (which publishes
 * events) lives inside `ConversationsModule` and uses this same
 * schema registration via Mongoose's shared model cache.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EscalationNotification.name, schema: EscalationNotificationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
    AuthModule,
  ],
  controllers: [EscalationsController],
  providers: [EscalationsService],
  exports: [EscalationsService],
})
export class EscalationsModule {}
