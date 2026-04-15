import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ConversationsPersistenceService } from "./conversations.persistence.service";
import { Conversation } from "../database/schemas/conversation.schema";
import { Message } from "../database/schemas/message.schema";

describe("ConversationsPersistenceService", () => {
  let service: ConversationsPersistenceService;

  const mockConversationModel = {
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
  };
  const mockMessageModel = {
    create: jest.fn().mockResolvedValue({}),
  };

  const mockConversation: any = {
    _id: "conv1",
    clinicId: "clinic1",
    leadId: "lead1",
    channel: "website",
    slotHistory: [],
  };
  const mockClinic: any = { _id: "clinic1" };
  const mockLead: any = { _id: "lead1" };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsPersistenceService,
        {
          provide: getModelToken(Conversation.name),
          useValue: mockConversationModel,
        },
        { provide: getModelToken(Message.name), useValue: mockMessageModel },
      ],
    }).compile();

    service = module.get<ConversationsPersistenceService>(
      ConversationsPersistenceService,
    );
    jest.clearAllMocks();
  });

  describe("saveMessage", () => {
    it("creates a message document with the correct sender and content", async () => {
      await service.saveMessage(
        mockConversation,
        mockClinic,
        mockLead,
        "lead",
        "Hello",
      );

      expect(mockMessageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: "conv1",
          clinicId: "clinic1",
          leadId: "lead1",
          sender: "lead",
          content: "Hello",
          channel: "website",
        }),
      );
    });

    it("includes extractedData Map when urgencyData is provided", async () => {
      await service.saveMessage(
        mockConversation,
        mockClinic,
        mockLead,
        "lead",
        "Help",
        {
          level: "urgent",
          score: 0.9,
        },
      );

      const callArg = mockMessageModel.create.mock.calls[0][0];
      expect(callArg.extractedData).toBeInstanceOf(Map);
      expect(callArg.extractedData.get("urgency")).toBe("urgent");
      expect(callArg.extractedData.get("urgencyScore")).toBe("0.9");
    });

    it("does not include extractedData when no urgencyData is provided", async () => {
      await service.saveMessage(
        mockConversation,
        mockClinic,
        mockLead,
        "ai",
        "Hi there",
      );

      const callArg = mockMessageModel.create.mock.calls[0][0];
      expect(callArg.extractedData).toBeUndefined();
    });
  });

  describe("updateConversationMeta", () => {
    it("calls findByIdAndUpdate with lastMessageFrom, $inc messageCount, and a Date for lastMessageAt", async () => {
      await service.updateConversationMeta(mockConversation, "ai");

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        expect.objectContaining({
          lastMessageFrom: "ai",
          lastMessageAt: expect.any(Date),
          $inc: { messageCount: 1 },
        }),
      );
    });

    it("includes phase in the update when phase argument is provided", async () => {
      await service.updateConversationMeta(mockConversation, "lead", "booking");

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        expect.objectContaining({ phase: "booking" }),
      );
    });

    it("does not include phase in the update when phase argument is omitted", async () => {
      await service.updateConversationMeta(mockConversation, "ai");

      const updateArg =
        mockConversationModel.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.phase).toBeUndefined();
    });
  });

  describe("storeOfferedSlots", () => {
    it("does nothing when the slots array is empty", async () => {
      await service.storeOfferedSlots(mockConversation, []);

      expect(mockConversationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("persists offered slots as Date objects", async () => {
      const slots = [
        { date: "2026-04-01", startTime: "09:00", endTime: "09:30" },
      ];

      await service.storeOfferedSlots(mockConversation, slots);

      const updateArg =
        mockConversationModel.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.offeredSlots).toHaveLength(1);
      expect(updateArg.offeredSlots[0].dateTime).toBeInstanceOf(Date);
    });

    it("appends new slots to slotHistory", async () => {
      const slots = [
        { date: "2026-04-01", startTime: "09:00", endTime: "09:30" },
      ];

      await service.storeOfferedSlots(mockConversation, slots);

      const updateArg =
        mockConversationModel.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.slotHistory).toHaveLength(1);
    });

    it("deduplicates slots already present in slotHistory", async () => {
      const slot = { date: "2026-04-01", startTime: "09:00", endTime: "09:30" };
      // Pre-populate slotHistory with the same slot's displayText
      const existingDisplayText =
        require("../ai/slot-formatter").formatSlotDisplay(slot);
      const convWithHistory: any = {
        ...mockConversation,
        slotHistory: [
          {
            dateTime: new Date("2026-04-01T09:00:00"),
            displayText: existingDisplayText,
          },
        ],
      };

      await service.storeOfferedSlots(convWithHistory, [slot]);

      const updateArg =
        mockConversationModel.findByIdAndUpdate.mock.calls[0][1];
      // slotHistory should still be length 1 — no duplicate appended
      expect(updateArg.slotHistory).toHaveLength(1);
    });
  });

  describe("saveDateContext", () => {
    it("does nothing when selectionResult is null", async () => {
      await service.saveDateContext(mockConversation, null);

      expect(mockConversationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("does nothing when selectionResult has no date context fields", async () => {
      await service.saveDateContext(mockConversation, {
        intent: "SLOT_SELECTED",
      } as any);

      expect(mockConversationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("persists lastRequestedDay in lowercase when requestedDate is present", async () => {
      await service.saveDateContext(mockConversation, {
        intent: "DAY_OVERVIEW",
        requestedDate: "Thursday",
      } as any);

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "conv1",
        expect.objectContaining({ lastRequestedDay: "thursday" }),
      );
    });

    it("persists lastRequestedDateStart and lastRequestedDateEnd as Dates when requestedStartDate is present", async () => {
      await service.saveDateContext(mockConversation, {
        intent: "DAY_OVERVIEW",
        requestedStartDate: "2026-04-07",
        requestedEndDate: "2026-04-11",
      } as any);

      const updateArg =
        mockConversationModel.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.lastRequestedDateStart).toBeInstanceOf(Date);
      expect(updateArg.lastRequestedDateEnd).toBeInstanceOf(Date);
    });

    it("uses requestedStartDate as fallback for lastRequestedDateEnd when requestedEndDate is absent", async () => {
      await service.saveDateContext(mockConversation, {
        intent: "DAY_OVERVIEW",
        requestedStartDate: "2026-04-07",
      } as any);

      const updateArg =
        mockConversationModel.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.lastRequestedDateStart).toEqual(
        updateArg.lastRequestedDateEnd,
      );
    });
  });
});
