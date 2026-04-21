/**
 * NestJS feature module for the conversation orchestrator.
 *
 * Imports AiModule for GreetingService and GroqService (Ibby's US-09).
 * Imports GhlModule for ConversationsService, MessagesService, and GhlApiService (Suli's US-08).
 * Exports OrchestratorService so WebhooksModule can call it after routing.
 */
import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { GhlModule } from "../ghl/ghl.module";
import { AppointmentsModule } from "../appointments/appointments.module";
import { SecurityModule } from "../security/security.module";
import { CancellationModule } from "../cancellation/cancellation.module";
import { PatientHistoryModule } from "../patient-history/patient-history.module";
import { ConversationsModule } from "../conversations/conversations.module";
import { GdprModule } from "../gdpr/gdpr.module";
import { OrchestratorService } from "./orchestrator.service";
import { PostcodeValidationService } from "./postcode-validation.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    AiModule,
    GhlModule,
    AppointmentsModule,
    SecurityModule,
    CancellationModule,
    PatientHistoryModule,
    ConversationsModule,
    GdprModule,
    NotificationsModule,
  ],
  providers: [OrchestratorService, PostcodeValidationService],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
