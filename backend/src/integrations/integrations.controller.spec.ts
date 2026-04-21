import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/** Sample response returned by the service. */
const sampleResponse = {
  ghlApiKey: '••••••••••••abc123',
  webhookUrl: 'https://example.com/webhook',
  ghlConnectionStatus: 'connected' as const,
};

describe('IntegrationsController', () => {
  let controller: IntegrationsController;
  let service: {
    getSettings: jest.Mock;
    updateSettings: jest.Mock;
    testConnection: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
      testConnection: jest.fn(),
      disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationsController],
      providers: [{ provide: IntegrationsService, useValue: service }],
    })
      // Override guard so unit tests don't need a real JWT
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IntegrationsController>(IntegrationsController);
  });

  // ─── GET /api/integrations ────────────────────────────────────────────────

  describe('GET /api/integrations', () => {
    it('returns settings with masked API key', async () => {
      service.getSettings.mockResolvedValue(sampleResponse);
      const result = await controller.getSettings();
      expect(result).toEqual(sampleResponse);
      expect(service.getSettings).toHaveBeenCalledTimes(1);
    });

    it('propagates service errors', async () => {
      service.getSettings.mockRejectedValue(new Error('DB error'));
      await expect(controller.getSettings()).rejects.toThrow('DB error');
    });
  });

  // ─── PUT /api/integrations ────────────────────────────────────────────────

  describe('PUT /api/integrations', () => {
    it('delegates to service and returns updated settings', async () => {
      service.updateSettings.mockResolvedValue(sampleResponse);
      const result = await controller.updateSettings({
        ghlApiKey: 'new-valid-token-abc123',
        webhookUrl: 'https://example.com/webhook',
      });
      expect(result).toEqual(sampleResponse);
      expect(service.updateSettings).toHaveBeenCalledWith({
        ghlApiKey: 'new-valid-token-abc123',
        webhookUrl: 'https://example.com/webhook',
      });
    });

    it('propagates BadRequestException when key is invalid', async () => {
      service.updateSettings.mockRejectedValue(
        new BadRequestException('Could not connect to GoHighLevel. Please check your API key.'),
      );
      await expect(
        controller.updateSettings({ ghlApiKey: 'bad-key-here-00' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows updating webhook URL without an API key', async () => {
      service.updateSettings.mockResolvedValue({ ...sampleResponse, webhookUrl: 'https://new.com/wh' });
      const result = await controller.updateSettings({ webhookUrl: 'https://new.com/wh' });
      expect(result.webhookUrl).toBe('https://new.com/wh');
    });
  });

  // ─── POST /api/integrations/test-connection ───────────────────────────────

  describe('POST /api/integrations/test-connection', () => {
    it('returns connected status', async () => {
      service.testConnection.mockResolvedValue({ status: 'connected' });
      const result = await controller.testConnection();
      expect(result.status).toBe('connected');
    });

    it('returns disconnected when no key is stored', async () => {
      service.testConnection.mockResolvedValue({ status: 'disconnected' });
      const result = await controller.testConnection();
      expect(result.status).toBe('disconnected');
    });
  });

  // ─── POST /api/integrations/disconnect ───────────────────────────────────

  describe('POST /api/integrations/disconnect', () => {
    it('calls service.disconnect and returns success message', async () => {
      service.disconnect.mockResolvedValue(undefined);
      const result = await controller.disconnect();
      expect(service.disconnect).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('disconnected');
    });
  });
});
