import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Conversation,
  ConversationSchema,
} from "../database/schemas/conversation.schema";
import { Message, MessageSchema } from "../database/schemas/message.schema";
import { Clinic, ClinicSchema } from "../database/schemas/clinic.schema";
import { Lead, LeadSchema } from "../database/schemas/lead.schema";
import {
  EscalationNotification,
  EscalationNotificationSchema,
} from "../database/schemas/escalation-notification.schema";
import { AiModule } from "../ai/ai.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { GhlModule } from "../ghl/ghl.module";
import { EscalationService } from "../ai/escalation.service";
import { EscalationGhlService } from "../ai/escalation-ghl.service";
import { EscalationNotifierService } from "../ai/escalation-notifier.service";
import { ComprehensionClassifier } from "../ai/comprehension-classifier";
import { NotificationsModule } from "../notifications/notifications.module";
import { EncryptionService } from "../common/encryption/encryption.service";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { ConversationsPersistenceService } from "./conversations.persistence.service";
import { AbuseHandlerService } from "./abuse-handler.service";
import { AbuseDetectionService } from "./abuse-detection.service";
import { SecurityModule } from "../security/security.module";
import { CancellationModule } from "../cancellation/cancellation.module";
import { PatientHistoryModule } from "../patient-history/patient-history.module";
import { GdprModule } from "../gdpr/gdpr.module";
import { PostcodeValidationService } from "../orchestrator/postcode-validation.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Clinic.name, schema: ClinicSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: EscalationNotification.name, schema: EscalationNotificationSchema },
    ]),
    AiModule,
    AppointmentsModule,
    GhlModule,
    SecurityModule,
    CancellationModule,
    PatientHistoryModule,
    NotificationsModule,
    GdprModule,
  ],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    ConversationsPersistenceService,
    EscalationService,
    EscalationGhlService,
    EscalationNotifierService,
    ComprehensionClassifier,
    AbuseHandlerService,
    AbuseDetectionService,
    PostcodeValidationService,
    EncryptionService,
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {
  /**
   * Register the ConversationsModule in the application.
   * This module imports the MongooseModule with the Conversation, Message, Clinic, and Lead schemas.
   * It registers the ConversationsController and ConversationsService.
   * It exports the ConversationsService.
   */
}
