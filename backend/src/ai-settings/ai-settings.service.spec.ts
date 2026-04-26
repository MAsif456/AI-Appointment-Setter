import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { NotFoundException } from "@nestjs/common";
import { AiSettingsService } from "./ai-settings.service";
import { Clinic } from "../database/schemas/clinic.schema"; // used for getModelToken
import { AIToneEnum } from "./ai-settings.dto";
import {
  DEFAULT_TONE,
  DEFAULT_GREETING_TEMPLATE,
  DEFAULT_QUALIFICATION_QUESTIONS,
} from "./ai-settings.defaults";

/**
 * Builds a sample clinic document with the provided overrides.
 * @param {Record<string, unknown>} overrides - Optional overrides to apply to the sample clinic.
 * @returns {Clinic} - The sample clinic document with the provided overrides.
 */
function buildClinic(overrides: Record<string, unknown> = {}): any {
  return {
    _id: "507f1f77bcf86cd799439011",
    name: "Test Clinic",
    aiConfig: {
      tone: "professional",
      greetingTemplate: "Hello {{firstName}}!",
      qualificationQuestions: [
        { key: "urgency", label: "Urgency", enabled: true },
        {
          key: "preferredTime",
          label: "Preferred time of day",
          enabled: false,
        },
      ],
      customInstructions: "Mention parking",
    },
    ...overrides,
  };
}

describe("AiSettingsService", () => {
  let service: AiSettingsService;
  let mockClinicModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    const execMock = jest.fn();
    const leanMock = jest.fn().mockReturnValue({ exec: execMock });
    const findByIdMock = jest.fn().mockReturnValue({ lean: leanMock });

    const updateExecMock = jest.fn();
    const updateLeanMock = jest.fn().mockReturnValue({ exec: updateExecMock });
    const findByIdAndUpdateMock = jest
      .fn()
      .mockReturnValue({ lean: updateLeanMock });

    mockClinicModel = {
      findById: findByIdMock,
      findByIdAndUpdate: findByIdAndUpdateMock,
      _execMock: execMock,
      _updateExecMock: updateExecMock,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiSettingsService,
        { provide: getModelToken(Clinic.name), useValue: mockClinicModel },
      ],
    }).compile();

    service = module.get<AiSettingsService>(AiSettingsService);
  });

  /**
   * Tests the getAiSettings method of AiSettingsService.
   */
  describe("getAiSettings", () => {
    it("should return AI settings for an existing clinic", async () => {
      const clinic = buildClinic();
      mockClinicModel._execMock.mockResolvedValue(clinic);

      const result = await service.getAiSettings("507f1f77bcf86cd799439011");

      expect(result.tone).toBe("professional");
      expect(result.greetingTemplate).toBe("Hello {{firstName}}!");
      expect(result.qualificationQuestions).toHaveLength(2);
      expect(result.customInstructions).toBe("Mention parking");
    });

    it("should throw NotFoundException when clinic does not exist", async () => {
      mockClinicModel._execMock.mockResolvedValue(null);

      await expect(service.getAiSettings("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return defaults when aiConfig is empty", async () => {
      const clinic = buildClinic({ aiConfig: {} });
      mockClinicModel._execMock.mockResolvedValue(clinic);

      const result = await service.getAiSettings("507f1f77bcf86cd799439011");

      expect(result.tone).toBe(DEFAULT_TONE);
      expect(result.greetingTemplate).toBe(DEFAULT_GREETING_TEMPLATE);
      expect(result.qualificationQuestions).toEqual(
        DEFAULT_QUALIFICATION_QUESTIONS,
      );
      expect(result.customInstructions).toBe("");
    });

    it("should return default questions when qualificationQuestions array is empty", async () => {
      const clinic = buildClinic({
        aiConfig: { tone: "friendly", qualificationQuestions: [] },
      });
      mockClinicModel._execMock.mockResolvedValue(clinic);

      const result = await service.getAiSettings("507f1f77bcf86cd799439011");

      expect(result.qualificationQuestions).toEqual(
        DEFAULT_QUALIFICATION_QUESTIONS,
      );
    });
  });

  /**
   * Tests the updateAiSettings method of AiSettingsService.
   */
  describe("updateAiSettings", () => {
    it("should update tone and return updated settings", async () => {
      const updated = buildClinic({
        aiConfig: { ...buildClinic().aiConfig, tone: "friendly" },
      });
      mockClinicModel._updateExecMock.mockResolvedValue(updated);

      const result = await service.updateAiSettings(
        "507f1f77bcf86cd799439011",
        {
          tone: AIToneEnum.Friendly,
        },
      );

      expect(result.tone).toBe("friendly");
      expect(mockClinicModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        { $set: { "aiConfig.tone": AIToneEnum.Friendly } },
        { returnDocument: 'after' },
      );
    });

    it("should update multiple fields at once", async () => {
      const updated = buildClinic({
        aiConfig: {
          tone: "balanced",
          greetingTemplate: "New greeting",
          customInstructions: "New instructions",
          qualificationQuestions: [
            { key: "urgency", label: "Urgency", enabled: false },
          ],
        },
      });
      mockClinicModel._updateExecMock.mockResolvedValue(updated);

      await service.updateAiSettings("507f1f77bcf86cd799439011", {
        tone: AIToneEnum.Balanced,
        greetingTemplate: "New greeting",
        customInstructions: "New instructions",
        qualificationQuestions: [
          { key: "urgency", label: "Urgency", enabled: false },
        ],
      });

      expect(mockClinicModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        {
          $set: {
            "aiConfig.tone": AIToneEnum.Balanced,
            "aiConfig.greetingTemplate": "New greeting",
            "aiConfig.customInstructions": "New instructions",
            "aiConfig.qualificationQuestions": [
              { key: "urgency", label: "Urgency", enabled: false },
            ],
          },
        },
        { returnDocument: 'after' },
      );
    });

    it("should throw NotFoundException when clinic does not exist", async () => {
      mockClinicModel._updateExecMock.mockResolvedValue(null);

      await expect(
        service.updateAiSettings("nonexistent", { tone: AIToneEnum.Friendly }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should not set fields that are not provided in DTO", async () => {
      const updated = buildClinic();
      mockClinicModel._updateExecMock.mockResolvedValue(updated);

      await service.updateAiSettings("507f1f77bcf86cd799439011", {
        customInstructions: "Only this",
      });

      expect(mockClinicModel.findByIdAndUpdate).toHaveBeenCalledWith(
        "507f1f77bcf86cd799439011",
        { $set: { "aiConfig.customInstructions": "Only this" } },
        { returnDocument: 'after' },
      );
    });
  });
});
