import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { FALLBACK_AI_UNAVAILABLE } from '../orchestrator/orchestrator.types';

// Define mockOfferedSlots
const mockOfferedSlots = [
  {
    dateTime: new Date('2026-03-17T14:00:00.000Z'),
    displayText: 'Tuesday 17th March at 2pm',
  },
];

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let mockService: any;

  const mockRequest = {
    user: {
      _id: 'user1',
      email: 'admin@example.com',
      role: 'admin',
      assignedClinics: [],
    },
  };

  beforeEach(async () => {
    mockService = {
      listConversations: jest.fn().mockResolvedValue([]),
      getConversation: jest.fn().mockResolvedValue({
        conversation: { _id: 'conv1', phase: 'greeting', clinicId: 'clinic1' },
        messages: [],
        clinic: { _id: 'clinic1', name: 'Test Clinic' },
        lead: { _id: 'lead1', firstName: 'Sarah' },
      }),
      startConversation: jest.fn().mockResolvedValue('Hi Sarah!'),
      resetConversation: jest.fn().mockResolvedValue(undefined),
      sendMessage: jest.fn().mockResolvedValue({
        reply: 'Let me check.',
        offeredSlots: mockOfferedSlots,
        slotSelection: null,
        bookingResult: null,
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [ConversationsController],
      providers: [{ provide: ConversationsService, useValue: mockService }],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /conversations', () => {
    it('should return a list of conversations', async () => {
      await controller.list(mockRequest);
      expect(mockService.listConversations).toHaveBeenCalled();
    });
  });

  describe('GET /conversations/:id', () => {
    it('should return conversation with messages and metadata', async () => {
      const result = await controller.get('conv1', mockRequest);
      expect(result.conversation).toBeDefined();
      expect(mockService.getConversation).toHaveBeenCalledWith('conv1');
    });
  });

  describe('POST /conversations/:id/start', () => {
    it('should return an AI greeting', async () => {
      mockService.startConversation.mockResolvedValue('Hi Sarah!');

      const result = await controller.start('conv1', mockRequest);
      expect(result).toEqual({ greeting: 'Hi Sarah!' });
      expect(mockService.startConversation).toHaveBeenCalledWith('conv1');
    });

    it('should return fallback greeting on failure', async () => {
      // Mock the service to return null (indicating failure)
      mockService.startConversation.mockResolvedValueOnce(null);

      const result = await controller.start('conv1', mockRequest);
      expect(result).toEqual({ 
        greeting: FALLBACK_AI_UNAVAILABLE 
      });
    });

    it('should return fallback greeting when service throws', async () => {
      // Mock the service to throw an error
      mockService.startConversation.mockRejectedValueOnce(new Error('DB error'));

      const result = await controller.start('conv1', mockRequest);
      expect(result.greeting).toBe('Thanks for your message! Someone from the clinic will be in touch shortly.');
    });
  });

  describe('POST /conversations/:id/reset', () => {
    it('should reset the conversation and return success', async () => {
      mockService.resetConversation.mockResolvedValue(undefined);

      const result = await controller.reset('conv1', mockRequest);
      expect(result).toEqual({ success: true });
      expect(mockService.resetConversation).toHaveBeenCalledWith('conv1');
    });
  });

  describe('POST /conversations/:id/messages', () => {
    it('should return an AI reply with offered slots', async () => {
      // Mock getConversation to be called twice (auth check + phase fetch)
      mockService.getConversation
        .mockResolvedValueOnce({
          conversation: { _id: 'conv1', phase: 'greeting', clinicId: 'clinic1' },
          messages: [],
          clinic: { _id: 'clinic1', name: 'Test Clinic' },
          lead: { _id: 'lead1', firstName: 'Sarah' },
        })
        .mockResolvedValueOnce({
          conversation: { _id: 'conv1', phase: 'greeting', clinicId: 'clinic1' },
          messages: [],
          clinic: { _id: 'clinic1', name: 'Test Clinic' },
          lead: { _id: 'lead1', firstName: 'Sarah' },
        });

      const result = await controller.sendMessage('conv1', { message: 'Hi' }, mockRequest);
      expect(result).toEqual({
        reply: 'Let me check.',
        offeredSlots: mockOfferedSlots,
        slotSelection: null,
        bookingResult: null,
        phase: 'greeting',
      });
    });

    it('should return fallback reply on failure', async () => {
      // Add auth check mock
      mockService.getConversation.mockResolvedValueOnce({
        conversation: { _id: 'conv1', phase: 'greeting', clinicId: 'clinic1' },
        messages: [],
        clinic: { _id: 'clinic1', name: 'Test Clinic' },
        lead: { _id: 'lead1', firstName: 'Sarah' },
      });
      mockService.sendMessage.mockResolvedValueOnce(null);

      const result = await controller.sendMessage('conv1', { message: 'Hello' }, mockRequest);
      expect(result.reply).toBe('Thanks for your message! Someone from the clinic will be in touch shortly.');
      expect(result.bookingResult).toBeNull();
    });

    it('should return fallback reply when service throws', async () => {
      // Mock getConversation to throw (auth check fails)
      mockService.getConversation.mockRejectedValueOnce(new Error('Unexpected error'));

      const result = await controller.sendMessage('conv1', { message: 'Hello' }, mockRequest);
      expect(result.reply).toBe('Thanks for your message! Someone from the clinic will be in touch shortly.');
      expect(result.offeredSlots).toEqual([]);
      expect(result.bookingResult).toBeNull();
    });

    it('throws 409 ConflictException when conversation phase is escalated', async () => {
      mockService.getConversation.mockResolvedValueOnce({
        conversation: { _id: 'conv1', phase: 'escalated', clinicId: 'clinic1' },
        messages: [],
        clinic: { _id: 'clinic1', name: 'Test Clinic' },
        lead: { _id: 'lead1', firstName: 'Sarah' },
      });

      await expect(
        controller.sendMessage('conv1', { message: 'Hello' }, mockRequest),
      ).rejects.toThrow(ConflictException);

      expect(mockService.sendMessage).not.toHaveBeenCalled();
    });

    it('re-throws ForbiddenException instead of swallowing it', async () => {
      const staffReq = {
        user: {
          _id: 'user1',
          email: 'staff@example.com',
          role: 'staff',
          assignedClinics: ['other_clinic'],
        },
      };
      mockService.getConversation.mockResolvedValueOnce({
        conversation: { _id: 'conv1', phase: 'greeting', clinicId: 'clinic1' },
        messages: [],
        clinic: { _id: 'clinic1', name: 'Test Clinic' },
        lead: { _id: 'lead1', firstName: 'Sarah' },
      });

      await expect(
        controller.sendMessage('conv1', { message: 'Hello' }, staffReq),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});