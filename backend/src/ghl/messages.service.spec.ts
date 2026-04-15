import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Types } from "mongoose";
import { MessagesService } from "./messages.service";
import { Message } from "../database/schemas/message.schema";
import { Conversation } from "../database/schemas/conversation.schema";

describe("MessagesService", () => {
  let service: MessagesService;
  let messageModel: Record<string, jest.Mock>;
  let conversationModel: Record<string, jest.Mock>;

  const conversationId = new Types.ObjectId();
  const clinicId = new Types.ObjectId();
  const leadId = new Types.ObjectId();

  beforeEach(async () => {
    messageModel = {
      create: jest.fn(),
      find: jest.fn(),
    };

    conversationModel = {
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getModelToken(Message.name), useValue: messageModel },
        {
          provide: getModelToken(Conversation.name),
          useValue: conversationModel,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  describe("addMessage", () => {
    it("should create a message and update the conversation", async () => {
      const mockMessage = {
        _id: new Types.ObjectId(),
        conversationId,
        sender: "lead",
        content: "Hello",
      };
      messageModel.create.mockResolvedValue(mockMessage);

      const result = await service.addMessage(
        conversationId,
        clinicId,
        leadId,
        "lead",
        "Hello",
        "sms",
        "ghl_msg_001",
      );

      expect(result).toEqual(mockMessage);
      expect(messageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId,
          clinicId,
          leadId,
          sender: "lead",
          content: "Hello",
          channel: "sms",
          ghlMessageId: "ghl_msg_001",
          status: "sent",
        }),
      );
      expect(conversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({
          lastMessageFrom: "lead",
          $inc: { messageCount: 1 },
        }),
      );
    });

    it("should create a message without ghlMessageId", async () => {
      const mockMessage = { _id: new Types.ObjectId(), sender: "ai" };
      messageModel.create.mockResolvedValue(mockMessage);

      await service.addMessage(
        conversationId,
        clinicId,
        leadId,
        "ai",
        "Response",
        "sms",
      );

      expect(messageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: "ai",
          content: "Response",
          ghlMessageId: undefined,
        }),
      );
    });
  });

  describe("getByConversation", () => {
    it("should return messages sorted by createdAt", async () => {
      const messages = [
        { _id: new Types.ObjectId(), content: "First" },
        { _id: new Types.ObjectId(), content: "Second" },
      ];
      messageModel.find.mockReturnValue({
        sort: jest
          .fn()
          .mockReturnValue({ exec: jest.fn().mockResolvedValue(messages) }),
      });

      const result = await service.getByConversation(conversationId);

      expect(result).toEqual(messages);
      expect(messageModel.find).toHaveBeenCalledWith({ conversationId });
    });
  });
});
