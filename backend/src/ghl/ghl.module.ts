import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Conversation,
  ConversationSchema,
} from "../database/schemas/conversation.schema";
import { Message, MessageSchema } from "../database/schemas/message.schema";
import { Lead, LeadSchema } from "../database/schemas/lead.schema";
import { GhlApiService } from "./ghl-api.service";
import { ConversationsService } from "./conversations.service";
import { MessagesService } from "./messages.service";
import { GhlController } from "./ghl.controller";
import { ClinicsModule } from "../clinics/clinics.module";

@Module({
  imports: [
    HttpModule.register({
      baseURL: "https://services.leadconnectorhq.com",
      timeout: 10000,
    }),
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Lead.name, schema: LeadSchema },
    ]),
    ClinicsModule,
  ],
  controllers: [GhlController],
  providers: [GhlApiService, ConversationsService, MessagesService],
  exports: [GhlApiService, ConversationsService, MessagesService],
})
export class GhlModule {}
