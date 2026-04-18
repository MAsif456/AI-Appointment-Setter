import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { Appointment, AppointmentSchema } from '../database/schemas/appointment.schema';
import { Conversation, ConversationSchema } from '../database/schemas/conversation.schema';
import { Clinic, ClinicSchema } from '../database/schemas/clinic.schema';
import { Message, MessageSchema } from '../database/schemas/message.schema';
import { GhlModule } from '../ghl/ghl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReminderService } from './reminder.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { ReminderTrackerService } from './reminder-tracker.service';
import { ReminderController } from './reminder.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: Clinic.name, schema: ClinicSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    GhlModule, // Provides GhlApiService and MessagesService
    NotificationsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [ReminderController],
  providers: [
    ReminderService,
    ReminderSchedulerService,
    ReminderTrackerService,
  ],
  exports: [ReminderService],
})
export class ReminderModule {}