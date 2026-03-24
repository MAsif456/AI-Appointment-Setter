import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from '../database/schemas/conversation.schema';
import { Message, MessageSchema } from '../database/schemas/message.schema';
import { Clinic, ClinicSchema } from '../database/schemas/clinic.schema';
import { Lead, LeadSchema } from '../database/schemas/lead.schema';
import { AiModule } from '../ai/ai.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { AbuseHandlerService } from './abuse-handler.service';
import { AbuseDetectionService } from './abuse-detection.service';


@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Clinic.name, schema: ClinicSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
    AiModule,
    AppointmentsModule,
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, AbuseHandlerService, AbuseDetectionService],
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
