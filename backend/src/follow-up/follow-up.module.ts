import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Conversation,
  ConversationSchema,
} from '../database/schemas/conversation.schema';
import { Lead, LeadSchema } from '../database/schemas/lead.schema';
import { Clinic, ClinicSchema } from '../database/schemas/clinic.schema';
import { GhlModule } from '../ghl/ghl.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowUpService } from './follow-up.service';
import { EncryptionService } from '../common/encryption/encryption.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Lead.name, schema: LeadSchema },
      { name: Clinic.name, schema: ClinicSchema },
    ]),
    GhlModule,
    NotificationsModule,
  ],
  providers: [FollowUpService, EncryptionService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
