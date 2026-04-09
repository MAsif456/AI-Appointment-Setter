import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { Types } from "mongoose";
import { GhlWebhookController } from "./ghl-webhook.controller";
import { ConversationsService } from "./conversations.service";
import { MessagesService } from "./messages.service";
import { ClinicsService } from "../clinics/clinics.service";

describe("GhlWebhookController", () => {
  let controller: GhlWebhookController;
  let conversationsService: Record<string, jest.Mock>;
  let messagesService: Record<string, jest.Mock>;
  let clinicsService: Record<string, jest.Mock>;

  const clinicId = new Types.ObjectId();
  const leadId = new Types.ObjectId();
  const conversationId = new Types.ObjectId();

  beforeEach(async () => {
    conversationsService = {
      findOrCreate: jest.fn(),
    };

    messagesService = {
      addMessage: jest.fn(),
      getByConversation: jest.fn(),
    };

    clinicsService = {
      findByGhlLocationId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GhlWebhookController],
      providers: [
        { provide: ConversationsService, useValue: conversationsService },
        { provide: MessagesService, useValue: messagesService },
        { provide: ClinicsService, useValue: clinicsService },
      ],
    }).compile();

    controller = module.get<GhlWebhookController>(GhlWebhookController);
  });

  describe("handleInbound", () => {
    const payload = {
      type: "InboundMessage",
      locationId: "loc_001",
      contactId: "contact_123",
      conversationId: "ghl_conv_001",
      messageId: "ghl_msg_001",
      body: "Hi, I need to book an appointment",
      direction: "inbound",
      messageType: "SMS",
    };

    it("should process an inbound webhook and return full context with messages", async () => {
      const mockClinic = { _id: clinicId };
      const mockConversation = {
        _id: conversationId,
        leadId,
        channel: "sms",
        phase: "greeting",
        ghlContactId: "contact_123",
        messageCount: 1,
      };
      const mockMessages = [
        {
          _id: "msg1",
          content: "Hi, I need to book an appointment",
          sender: "lead",
        },
      ];

      clinicsService.findByGhlLocationId.mockResolvedValue(mockClinic);
      conversationsService.findOrCreate.mockResolvedValue(mockConversation);
      messagesService.addMessage.mockResolvedValue({});
      messagesService.getByConversation.mockResolvedValue(mockMessages);

      const result = await controller.handleInbound(payload);

      expect(result.success).toBe(true);
      expect(result.conversation.phase).toBe("greeting");
      expect(result.conversation.messages).toEqual(mockMessages);
      expect(messagesService.addMessage).toHaveBeenCalledWith(
        conversationId,
        clinicId,
        leadId,
        "lead",
        "Hi, I need to book an appointment",
        "sms",
        "ghl_msg_001",
      );
    });

    it("should create a new conversation for a new contact", async () => {
      const mockClinic = { _id: clinicId };
      const newConversation = {
        _id: conversationId,
        leadId,
        channel: "whatsapp",
        phase: "greeting",
        ghlContactId: "contact_123",
        messageCount: 0,
      };
      const mockMessages = [{ _id: "msg1", content: "Hello", sender: "lead" }];

      clinicsService.findByGhlLocationId.mockResolvedValue(mockClinic);
      conversationsService.findOrCreate.mockResolvedValue(newConversation);
      messagesService.addMessage.mockResolvedValue({});
      messagesService.getByConversation.mockResolvedValue(mockMessages);

      const whatsappPayload = { ...payload, messageType: "WhatsApp" };
      const result = await controller.handleInbound(whatsappPayload);

      expect(result.success).toBe(true);
      expect(result.conversation.phase).toBe("greeting");
      expect(conversationsService.findOrCreate).toHaveBeenCalledWith(
        whatsappPayload,
        clinicId,
      );
    });

    it("should propagate NotFoundException when clinic is not found", async () => {
      clinicsService.findByGhlLocationId.mockRejectedValue(
        new NotFoundException(
          'Clinic with GHL locationId "unknown_loc" not found',
        ),
      );

      const unknownPayload = { ...payload, locationId: "unknown_loc" };

      await expect(controller.handleInbound(unknownPayload)).rejects.toThrow(
        NotFoundException,
      );
      expect(conversationsService.findOrCreate).not.toHaveBeenCalled();
    });
  });
});
