import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { ClinicsService } from "../clinics/clinics.service";
import { OrchestratorService } from "../orchestrator/orchestrator.service";

const mockActiveClinic = {
  _id: "507f1f77bcf86cd799439011",
  name: "Cardiff Physiotherapy Centre",
  ghlLocationId: "loc_cardiff_001",
  isActive: true,
  aiConfig: { tone: "friendly", greetingTemplate: "", customInstructions: "" },
  serviceAreas: [],
};
const mockInactiveClinic = { ...mockActiveClinic, isActive: false };
const cardiffLocation = { id: "loc_cardiff_001", name: "Cardiff Physio" };
const basePayload = { type: "ContactCreate", location: cardiffLocation };
const contactPayload = {
  type: "ContactCreate",
  location: cardiffLocation,
  first_name: "Jane",
  last_name: "Doe",
  phone: "07700900000",
  email: "jane@example.com",
  issue: "Back pain",
};
const messagePayload = {
  type: "InboundMessage",
  location: cardiffLocation,
  id: "contact_abc123",
  conversationId: "conv_xyz789",
  message: { body: "I need an appointment please" },
};

describe("WebhooksService", () => {
  let service: WebhooksService;
  let clinicsService: { findByGhlLocationId: jest.Mock };
  let orchestratorService: {
    handleNewLead: jest.Mock;
    handleInboundMessage: jest.Mock;
  };

  beforeEach(async () => {
    clinicsService = {
      findByGhlLocationId: jest.fn().mockResolvedValue(mockActiveClinic),
    };
    orchestratorService = {
      handleNewLead: jest.fn().mockResolvedValue(undefined),
      handleInboundMessage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: ClinicsService, useValue: clinicsService },
        { provide: OrchestratorService, useValue: orchestratorService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe("handleGhlWebhook", () => {
    it("should always return { success: true } for a valid active clinic", async () => {
      const result = await service.handleGhlWebhook(basePayload);
      expect(result).toEqual({ success: true });
    });

    it("should log metadata only — not the full JSON payload", async () => {
      const logSpy = jest.spyOn(Logger.prototype, "log");
      const payload = {
        type: "ContactCreate",
        location: cardiffLocation,
        first_name: "Secret",
        phone: "07700900000",
      };
      await service.handleGhlWebhook(payload);
      const firstLogCall = logSpy.mock.calls[0]?.[0] ?? "";
      expect(firstLogCall).toContain("type=ContactCreate");
      expect(firstLogCall).toContain("locationId=loc_cardiff_001");
      expect(firstLogCall).not.toContain(JSON.stringify(payload));
    });

    it("should warn and return 200 when the location field is absent", async () => {
      const warnSpy = jest.spyOn(Logger.prototype, "warn");
      const result = await service.handleGhlWebhook({ type: "ContactCreate" });
      expect(result).toEqual({ success: true });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing locationId"),
      );
      expect(clinicsService.findByGhlLocationId).not.toHaveBeenCalled();
    });

    it("should log Unknown GHL Location ID when no clinic found", async () => {
      clinicsService.findByGhlLocationId.mockResolvedValue(null);
      const logSpy = jest.spyOn(Logger.prototype, "log");
      const result = await service.handleGhlWebhook({
        type: "ContactCreate",
        location: { id: "loc_unknown_999" },
      });
      expect(result).toEqual({ success: true });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown GHL Location ID: loc_unknown_999"),
      );
    });

    it("should log Clinic is inactive when the clinic is inactive", async () => {
      clinicsService.findByGhlLocationId.mockResolvedValue(mockInactiveClinic);
      const logSpy = jest.spyOn(Logger.prototype, "log");
      const result = await service.handleGhlWebhook(basePayload);
      expect(result).toEqual({ success: true });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Clinic is inactive, ignoring webhook"),
      );
    });

    it("should log Routing lead to clinic for ContactCreate", async () => {
      const logSpy = jest.spyOn(Logger.prototype, "log");
      await service.handleGhlWebhook(contactPayload);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Routing lead to clinic: Cardiff Physiotherapy Centre",
        ),
      );
    });
    it("should call orchestratorService.handleNewLead for ContactCreate", async () => {
      await service.handleGhlWebhook(contactPayload);
      expect(orchestratorService.handleNewLead).toHaveBeenCalledTimes(1);
    });

    it("should log Routing message to clinic for InboundMessage", async () => {
      const logSpy = jest.spyOn(Logger.prototype, "log");
      await service.handleGhlWebhook(messagePayload);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Routing message to clinic: Cardiff Physiotherapy Centre",
        ),
      );
    });
    it("should call orchestratorService.handleInboundMessage for InboundMessage", async () => {
      await service.handleGhlWebhook(messagePayload);
      expect(orchestratorService.handleInboundMessage).toHaveBeenCalledTimes(1);
    });

    it("should warn for an unrecognised event type and still return 200", async () => {
      const warnSpy = jest.spyOn(Logger.prototype, "warn");
      const result = await service.handleGhlWebhook({
        type: "AppointmentBooked",
        location: cardiffLocation,
      });
      expect(result).toEqual({ success: true });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Unrecognised GHL event type: AppointmentBooked",
        ),
      );
    });

    it("should return 200 and log the error when clinicsService throws", async () => {
      clinicsService.findByGhlLocationId.mockRejectedValue(
        new Error("DB connection lost"),
      );
      const errorSpy = jest.spyOn(Logger.prototype, "error");
      const result = await service.handleGhlWebhook(basePayload);
      expect(result).toEqual({ success: true });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("DB connection lost"),
        expect.anything(),
      );
    });
    it("should return 200 and log the error when orchestratorService throws", async () => {
      orchestratorService.handleNewLead.mockRejectedValue(
        new Error("Orchestrator error"),
      );
      const errorSpy = jest.spyOn(Logger.prototype, "error");
      const result = await service.handleGhlWebhook(basePayload);
      expect(result).toEqual({ success: true });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Orchestrator error"),
        expect.anything(),
      );
    });

    it("should call findByGhlLocationId with the location.id from the payload", async () => {
      await service.handleGhlWebhook(basePayload);
      expect(clinicsService.findByGhlLocationId).toHaveBeenCalledWith(
        "loc_cardiff_001",
      );
    });
    it("should return 200 for a completely empty payload without throwing", async () => {
      const result = await service.handleGhlWebhook({});
      expect(result).toEqual({ success: true });
    });
  });
});
