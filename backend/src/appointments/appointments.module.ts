import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Appointment,
  AppointmentSchema,
} from '../database/schemas/appointment.schema';
import { Clinic, ClinicSchema } from '../database/schemas/clinic.schema';
import {
  Conversation,
  ConversationSchema,
} from '../database/schemas/conversation.schema';
import { GhlModule } from '../ghl/ghl.module';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Clinic.name, schema: ClinicSchema },
      { name: Conversation.name, schema: ConversationSchema },
    ]),
    GhlModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
