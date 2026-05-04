import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Conversation,
  ConversationSchema,
} from "../database/schemas/conversation.schema";
import { Message, MessageSchema } from "../database/schemas/message.schema";
import { InjectionDetectorService } from "./injection-detector.service";
import { ContentSanitiserService } from "./content-sanitiser.service";
import { OutputValidatorService } from "./output-validator.service";
import { SecurityLoggerService } from "./security-logger.service";
import { SecurityPipelineService } from "./security-pipeline.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
  ],
  providers: [
    InjectionDetectorService,
    ContentSanitiserService,
    OutputValidatorService,
    SecurityLoggerService,
    SecurityPipelineService,
  ],
  exports: [SecurityPipelineService, OutputValidatorService],
})
export class SecurityModule {}
