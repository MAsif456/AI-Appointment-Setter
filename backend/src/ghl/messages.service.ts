import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Message, MessageDocument } from "../database/schemas/message.schema";
import {
  Conversation,
  ConversationDocument,
} from "../database/schemas/conversation.schema";

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  /**
   * Constructor.
   * @param messageModel - The Mongoose model for messages.
   * @param conversationModel - The Mongoose model for conversations.
   */
  constructor(
    @InjectModel(Message.name)
    private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
  ) {}

  /**
   * Adds a message to a conversation.
   *
   * @param conversationId - The ID of the conversation.
   * @param clinicId - The ID of the clinic.
   * @param leadId - The ID of the lead.
   * @param sender - The sender of the message ('lead', 'ai', or 'system').
   * @param content - The content of the message.
   * @param channel - The channel of the message.
   * @param ghlMessageId - The ID of the message in GHL (optional).
   *
   * @returns A promise that resolves to the created message document.
   */
  async addMessage(
    conversationId: Types.ObjectId,
    clinicId: Types.ObjectId,
    leadId: Types.ObjectId,
    sender: "lead" | "ai" | "system",
    content: string,
    channel: string,
    ghlMessageId?: string,
  ): Promise<MessageDocument> {
    const message = await this.messageModel.create({
      conversationId,
      clinicId,
      leadId,
      sender,
      content,
      channel,
      ghlMessageId,
      status: "sent",
    });

    await this.conversationModel.findByIdAndUpdate(conversationId, {
      lastMessageAt: new Date(),
      lastMessageFrom: sender,
      $inc: { messageCount: 1 },
    });

    this.logger.log(
      `Added ${sender} message to conversation ${conversationId}`,
    );
    return message;
  }

  /**
   * Retrieves all messages for a given conversation.
   *
   * @param conversationId - The ID of the conversation.
   *
   * @returns A promise that resolves to an array of message documents.
   */
  async getByConversation(
    conversationId: Types.ObjectId,
  ): Promise<MessageDocument[]> {
    return this.messageModel
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .exec();
  }
}
