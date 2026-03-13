/**
 * Unit tests for WebhooksController.
 *
 * Verifies that the controller correctly delegates to WebhooksService and
 * always returns { success: true }. WebhooksService is fully mocked so
 * these tests are isolated from all business logic and database access.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let service: { handleGhlWebhook: jest.Mock };

  beforeEach(async () => {
    service = {
      handleGhlWebhook: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: WebhooksService, useValue: service }],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  describe('handleGhlWebhook', () => {
    it('should delegate to webhooksService with the exact payload received', async () => {
      const payload = { type: 'ContactCreate', locationId: 'loc_cardiff_001' };

      await controller.handleGhlWebhook(payload);

      expect(service.handleGhlWebhook).toHaveBeenCalledWith(payload);
    });

    it('should return { success: true } for a ContactCreate event', async () => {
      const payload = { type: 'ContactCreate', locationId: 'loc_cardiff_001' };

      const result = await controller.handleGhlWebhook(payload);

      expect(result).toEqual({ success: true });
    });

    it('should return { success: true } for an InboundMessage event', async () => {
      const payload = {
        type: 'InboundMessage',
        locationId: 'loc_cardiff_001',
        message: 'Hello, I need help',
      };

      const result = await controller.handleGhlWebhook(payload);

      expect(result).toEqual({ success: true });
    });

    it('should return { success: true } even when the service encounters an internal error', async () => {
      /** The service never throws — it catches internally and returns success. */
      service.handleGhlWebhook.mockResolvedValue({ success: true });
      const payload = { locationId: 'loc_bad' };

      const result = await controller.handleGhlWebhook(payload);

      expect(result).toEqual({ success: true });
    });

    it('should return { success: true } for a completely empty payload', async () => {
      const result = await controller.handleGhlWebhook({});

      expect(result).toEqual({ success: true });
    });

    it('should pass an unknown event type through to the service without modification', async () => {
      const payload = { type: 'UnknownEventType', locationId: 'loc_cardiff_001' };

      await controller.handleGhlWebhook(payload);

      expect(service.handleGhlWebhook).toHaveBeenCalledWith(payload);
    });
  });
});
