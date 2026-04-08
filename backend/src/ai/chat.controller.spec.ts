import { Test, TestingModule } from "@nestjs/testing";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

describe("ChatController", () => {
  let controller: ChatController;

  const mockChatService = {
    startConversation: jest.fn(),
    sendMessage: jest.fn(),
  };

  const leadInfo = { firstName: "David", issue: "Ankle Sprain" };
  const clinicConfig = {
    clinicId: "clinic_001",
    name: "Cardiff Physiotherapy Centre",
    tone: "Friendly" as const,
    ghlLocationId: "loc_001",
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: mockChatService }],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    jest.clearAllMocks();
  });

  describe("POST /chat/start", () => {
    it("should return a greeting", async () => {
      mockChatService.startConversation.mockResolvedValue("Hi David!");

      const result = await controller.startChat({ leadInfo, clinicConfig });

      expect(result).toEqual({ greeting: "Hi David!" });
      expect(mockChatService.startConversation).toHaveBeenCalledWith(
        leadInfo,
        clinicConfig,
      );
    });

    it("should return null greeting on failure", async () => {
      mockChatService.startConversation.mockResolvedValue(null);

      const result = await controller.startChat({ leadInfo, clinicConfig });
      expect(result).toEqual({ greeting: null });
    });
  });

  describe("POST /chat/message", () => {
    it("should return an AI reply", async () => {
      mockChatService.sendMessage.mockResolvedValue(
        "Let me check that for you.",
      );

      const result = await controller.sendMessage({
        leadInfo,
        clinicConfig,
        history: [{ role: "assistant", content: "Hi David!" }],
        message: "Can I book today?",
      });

      expect(result).toEqual({ reply: "Let me check that for you." });
    });

    it("should return null reply on failure", async () => {
      mockChatService.sendMessage.mockResolvedValue(null);

      const result = await controller.sendMessage({
        leadInfo,
        clinicConfig,
        history: [],
        message: "Hello",
      });

      expect(result).toEqual({ reply: null });
    });
  });
});
