import { Test, TestingModule } from "@nestjs/testing";
import { GhlController } from "./ghl.controller";
import { GhlApiService } from "./ghl-api.service";
import { ClinicsService } from "../clinics/clinics.service";

describe("GhlController", () => {
  let controller: GhlController;
  let ghlApiService: Record<string, jest.Mock>;
  let clinicsService: Record<string, jest.Mock>;

  beforeEach(async () => {
    ghlApiService = {
      sendMessageWithRetry: jest.fn(),
    };
    clinicsService = {
      getDecryptedApiKey: jest.fn().mockResolvedValue('test-api-key'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GhlController],
      providers: [
        { provide: GhlApiService, useValue: ghlApiService },
        { provide: ClinicsService, useValue: clinicsService },
      ],
    }).compile();

    controller = module.get<GhlController>(GhlController);
  });

  describe("sendMessage", () => {
    it("should send a message and return success with data", async () => {
      const dto = { type: "SMS", contactId: "contact_123", message: "Hello", clinicId: "clinic_abc" };
      const apiResponse = { messageId: "msg_001" };
      ghlApiService.sendMessageWithRetry.mockResolvedValue(apiResponse);

      const result = await controller.sendMessage(dto);

      expect(result).toEqual({ success: true, data: apiResponse });
      expect(ghlApiService.sendMessageWithRetry).toHaveBeenCalledWith('test-api-key', dto);
    });

    it("should send with empty key when no clinicId provided", async () => {
      const dto = { type: "SMS", contactId: "contact_123", message: "Hello" };
      const apiResponse = { messageId: "msg_002" };
      ghlApiService.sendMessageWithRetry.mockResolvedValue(apiResponse);

      const result = await controller.sendMessage(dto);

      expect(result).toEqual({ success: true, data: apiResponse });
      expect(ghlApiService.sendMessageWithRetry).toHaveBeenCalledWith('', dto);
    });

    it("should propagate errors from GHL API service", async () => {
      const dto = { type: "WhatsApp", contactId: "contact_456", message: "Hi", clinicId: "clinic_abc" };
      ghlApiService.sendMessageWithRetry.mockRejectedValue(
        new Error("GHL API error"),
      );

      await expect(controller.sendMessage(dto)).rejects.toThrow(
        "GHL API error",
      );
    });
  });
});
