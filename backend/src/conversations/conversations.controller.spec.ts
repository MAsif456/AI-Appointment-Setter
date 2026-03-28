import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

describe('ConversationsController', () => {
  let controller: ConversationsController;

  const mockService = {
    listConversations: jest.fn(),
    getConversation: jest.fn(),
    startConversation: jest.fn(),
    sendMessage: jest.fn(),
    resetConversation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: mockService }],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
    jest.clearAllMocks();
  });

  describe('GET /conversations', () => {
    it('should return a list of conversations', async () => {
      const mockList = [{ _id: 'conv1', phase: 'greeting' }];
      mockService.listConversations.mockResolvedValue(mockList);

      const result = await controller.list();
      expect(result).toEqual(mockList);
    });
  });

  describe('GET /conversations/:id', () => {
    it('should return conversation with messages and metadata', async () => {
      mockService.getConversation.mockResolvedValue({
        conversation: { _id: 'conv1', phase: 'greeting' },
        messages: [
          { _id: 'msg1', sender: 'ai', content: 'Hello!', createdAt: new Date() },
        ],
        clinic: { _id: 'c1', name: 'Cardiff Physio', aiConfig: { tone: 'friendly' } },
        lead: {
          _id: 'l1',
          firstName: 'Sarah',
          lastName: 'Williams',
          phone: '07700 900123',
          email: 'sarah@email.com',
          issue: 'Back Pain',
          postcode: 'CF10 3AB',
          leadSource: 'facebook',
        },
      });

      const result = await controller.get('conv1');

      expect(result.conversation._id).toBe('conv1');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].sender).toBe('ai');
      expect(result.clinic!.name).toBe('Cardiff Physio');
      expect(result.lead!.firstName).toBe('Sarah');
    });
  });

  describe('POST /conversations/:id/start', () => {
    it('should return an AI greeting', async () => {
      mockService.startConversation.mockResolvedValue('Hi Sarah!');

      const result = await controller.start('conv1');
      expect(result).toEqual({ greeting: 'Hi Sarah!' });
      expect(mockService.startConversation).toHaveBeenCalledWith('conv1');
    });

    it('should return null greeting on failure', async () => {
      mockService.startConversation.mockResolvedValue(null);

      const result = await controller.start('conv1');
      expect(result).toEqual({ greeting: null });
    });
  });

  describe('POST /conversations/:id/reset', () => {
    it('should reset the conversation and return success', async () => {
      mockService.resetConversation.mockResolvedValue(undefined);

      const result = await controller.reset('conv1');
      expect(result).toEqual({ success: true });
      expect(mockService.resetConversation).toHaveBeenCalledWith('conv1');
    });
  });

  describe('POST /conversations/:id/messages', () => {
    it('should return an AI reply with offered slots', async () => {
      const mockOfferedSlots = [
        { dateTime: '2026-03-17T14:00:00.000Z', displayText: 'Tuesday 17th March at 2pm' },
      ];
      mockService.sendMessage.mockResolvedValue({
        reply: 'Let me check.',
        offeredSlots: mockOfferedSlots,
        slotSelection: null,
      });
      mockService.getConversation.mockResolvedValue({
        conversation: { phase: 'greeting' },
        messages: [], clinic: null, lead: null,
      });

      const result = await controller.sendMessage('conv1', {
        message: 'My postcode is CF10 3AB',
      });

      expect(result).toEqual({
        reply: 'Let me check.',
        offeredSlots: mockOfferedSlots,
        slotSelection: null,
        bookingResult: null,
        phase: 'greeting',
      });
      expect(mockService.sendMessage).toHaveBeenCalledWith(
        'conv1',
        'My postcode is CF10 3AB',
      );
    });

    it('should return null reply with empty slots on failure', async () => {
      mockService.sendMessage.mockResolvedValue(null);

      const result = await controller.sendMessage('conv1', {
        message: 'Hello',
      });
      expect(result).toEqual({ reply: null, offeredSlots: [], slotSelection: null, bookingResult: null, phase: null });
    });
  });
});
