import { Test, TestingModule } from '@nestjs/testing';
import { GhlController } from './ghl.controller';
import { GhlApiService } from './ghl-api.service';

describe('GhlController', () => {
  let controller: GhlController;
  let ghlApiService: Record<string, jest.Mock>;

  beforeEach(async () => {
    ghlApiService = {
      sendMessageWithRetry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GhlController],
      providers: [
        { provide: GhlApiService, useValue: ghlApiService },
      ],
    }).compile();

    controller = module.get<GhlController>(GhlController);
  });

  describe('sendMessage', () => {
    it('should send a message and return success with data', async () => {
      const dto = { type: 'SMS', contactId: 'contact_123', message: 'Hello' };
      const apiResponse = { messageId: 'msg_001' };
      ghlApiService.sendMessageWithRetry.mockResolvedValue(apiResponse);

      const result = await controller.sendMessage(dto);

      expect(result).toEqual({ success: true, data: apiResponse });
      expect(ghlApiService.sendMessageWithRetry).toHaveBeenCalledWith(dto);
    });

    it('should propagate errors from GHL API service', async () => {
      const dto = { type: 'WhatsApp', contactId: 'contact_456', message: 'Hi' };
      ghlApiService.sendMessageWithRetry.mockRejectedValue(new Error('GHL API error'));

      await expect(controller.sendMessage(dto)).rejects.toThrow('GHL API error');
    });
  });
});
