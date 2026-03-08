
/**
 * Unit tests for AiSettingsController.
 * Covers happy paths and edge cases: clinic not found, invalid clinic ID.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService, AiSettingsResponse } from './ai-settings.service';
import { AIToneEnum } from './ai-settings.dto';

const sampleSettings: AiSettingsResponse = {
  /**
   * Sample AI settings response to be returned by the controller
   */
  tone: 'friendly',
  greetingTemplate: 'Hi {{firstName}}!',
  qualificationQuestions: [
    { key: 'urgency', label: 'Urgency', enabled: true },
  ],
  customInstructions: 'Mention parking',
};

describe('AiSettingsController', () => {
  let controller: AiSettingsController;
  let service: { getAiSettings: jest.Mock; updateAiSettings: jest.Mock };

  beforeEach(async () => {
    service = {
      getAiSettings: jest.fn(),
      updateAiSettings: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiSettingsController],
      providers: [{ provide: AiSettingsService, useValue: service }],
    }).compile();

    controller = module.get<AiSettingsController>(AiSettingsController);
  });

  /**
   * Test the GET /api/clinics/:clinicId/ai-settings endpoint.
   * Should return AI settings for a valid clinic.
   */
  describe('GET /api/clinics/:clinicId/ai-settings', () => {
    it('should return AI settings for a valid clinic', async () => {
      service.getAiSettings.mockResolvedValue(sampleSettings);

      const result = await controller.getAiSettings('abc123');

      expect(result).toEqual(sampleSettings);
      expect(service.getAiSettings).toHaveBeenCalledWith('abc123');
    });

    it('should propagate NotFoundException from service', async () => {
      service.getAiSettings.mockRejectedValue(
        new NotFoundException('Clinic not found'),
      );

      await expect(controller.getAiSettings('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  /**
   * Test the PUT /api/clinics/:clinicId/ai-settings endpoint.
   * Should update and return AI settings.
   */
  describe('PUT /api/clinics/:clinicId/ai-settings', () => {    it('should update and return AI settings', async () => {
      const updated = { ...sampleSettings, tone: 'professional' };
      service.updateAiSettings.mockResolvedValue(updated);

      const result = await controller.updateAiSettings('abc123', {
        tone: AIToneEnum.Professional,
      });

      expect(result.tone).toBe('professional');
      expect(service.updateAiSettings).toHaveBeenCalledWith('abc123', {
        tone: AIToneEnum.Professional,
      });
    });

    it('should propagate NotFoundException from service', async () => {
      service.updateAiSettings.mockRejectedValue(
        new NotFoundException('Clinic not found'),
      );

      await expect(
        controller.updateAiSettings('bad-id', { tone: AIToneEnum.Friendly }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});