import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AppointmentsController } from './appointments.controller';
import { SlotsService } from './services/slots.service';
import { GHLCalendarService } from './services/ghl-calendar.service';
import { Clinic, ClinicSchema } from '../database/schemas/clinic.schema';
import { Conversation, ConversationSchema } from '../database/schemas/conversation.schema';
import { Appointment, AppointmentSchema } from '../database/schemas/appointment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clinic.name, schema: ClinicSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
    HttpModule,
    ConfigModule, 
  ],
  controllers: [AppointmentsController],
  providers: [SlotsService, GHLCalendarService],
  exports: [SlotsService, GHLCalendarService],
})
export class AppointmentsModule {}