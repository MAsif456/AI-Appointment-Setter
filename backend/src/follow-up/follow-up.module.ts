import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Conversation,
  ConversationSchema,
} from '../database/schemas/conversation.schema';
import { Lead, LeadSchema } from '../database/schemas/lead.schema';
import { GhlModule } from '../ghl/ghl.module';
import { FollowUpService } from './follow-up.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
    GhlModule,
  ],
  providers: [FollowUpService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
