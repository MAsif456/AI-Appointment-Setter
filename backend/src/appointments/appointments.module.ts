import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { Appointment, AppointmentSchema, } from "../database/schemas/appointment.schema";
import { Clinic, ClinicSchema } from "../database/schemas/clinic.schema";
import { Conversation, ConversationSchema, } from "../database/schemas/conversation.schema";
import { Lead, LeadSchema } from "../database/schemas/lead.schema";
import { IdempotencyKey, IdempotencyKeySchema } from "./idempotency-key.schema";
import { GhlModule } from "../ghl/ghl.module";
import { PatientHistoryModule } from "../patient-history/patient-history.module";
import { EncryptionService } from "../common/encryption/encryption.service";
import { AppointmentsService } from "./appointments.service";
import { AppointmentsController } from "./appointments.controller";
import { SlotsService } from "./services/slots.service";
import { GHLCalendarService } from "./services/ghl-calendar.service";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Clinic.name, schema: ClinicSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: IdempotencyKey.name, schema: IdempotencyKeySchema },
    ]),
    GhlModule,
    HttpModule,
    ConfigModule,
    PatientHistoryModule,
  ],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsService,
    SlotsService,
    GHLCalendarService,
    IdempotencyInterceptor,
    EncryptionService,
  ],
  exports: [AppointmentsService, SlotsService, GHLCalendarService],
})
export class AppointmentsModule {}
