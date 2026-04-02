import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { GroqService } from './groq.service';
import { GreetingService } from './greeting.service';
import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';

describe('ChatService', () => {
  let service: ChatService;

  const mockGroqService = {
    generateChatResponse: jest.fn(),
  };

  const mockGreetingService = {
    generateGreeting: jest.fn(),
  };

  const lead: LeadInfo = {
    firstName: 'David',
    lastName: 'Williams',
    issue: 'Ankle Sprain',
    phone: '07700 900345',
  };

  const clinic: ClinicConfig = {
    clinicId: 'clinic_001',
    name: 'Cardiff Physiotherapy Centre',
    tone: 'Friendly',
    serviceAreas: ['CF'],
    ghlLocationId: 'loc_001',
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: GroqService, useValue: mockGroqService },
        { provide: GreetingService, useValue: mockGreetingService },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    jest.clearAllMocks();
  });

  describe('startConversation', () => {
    it('should delegate to GreetingService', async () => {
      mockGreetingService.generateGreeting.mockResolvedValue('Hi David!');
      const result = await service.startConversation(lead, clinic);

      expect(result).toBe('Hi David!');
      expect(mockGreetingService.generateGreeting).toHaveBeenCalledWith(
        lead,
        clinic,
      );
    });

    it('should return null when greeting fails', async () => {
      mockGreetingService.generateGreeting.mockResolvedValue(null);
      const result = await service.startConversation(lead, clinic);
      expect(result).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('should call Groq with system prompt and full history', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue(
        'Let me check availability.',
      );

      const history = [
        { role: 'assistant' as const, content: 'Hi David!' },
        { role: 'user' as const, content: 'I need an urgent appointment' },
      ];

      const result = await service.sendMessage(
        lead,
        clinic,
        history,
        'My postcode is CF24 0XX',
      );

      expect(result).toBe('Let me check availability.');
      expect(mockGroqService.generateChatResponse).toHaveBeenCalledTimes(1);

      // Verify the messages array structure
      const sentMessages =
        mockGroqService.generateChatResponse.mock.calls[0][0];
      expect(sentMessages[0].role).toBe('system');
      expect(sentMessages[0].content).toContain('Cardiff Physiotherapy Centre');
      // Sandwich defense: last message is a system reinforcement,
      // user message is second-to-last (wrapped in delimiters)
      expect(sentMessages[sentMessages.length - 1].role).toBe('system');
      expect(sentMessages[sentMessages.length - 1].content).toContain('Stay in character');
      expect(sentMessages[sentMessages.length - 2].role).toBe('user');
      expect(sentMessages[sentMessages.length - 2].content).toContain('My postcode is CF24 0XX');
    });

    it('should return null when Groq fails', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue(null);

      const result = await service.sendMessage(lead, clinic, [], 'Hello');
      expect(result).toBeNull();
    });

    it('should include conversation history in context', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue('Sure!');

      const history = [
        { role: 'assistant' as const, content: 'Hello!' },
        { role: 'user' as const, content: 'Hi there' },
        { role: 'assistant' as const, content: 'How can I help?' },
      ];

      await service.sendMessage(lead, clinic, history, 'Book me in');

      const sentMessages =
        mockGroqService.generateChatResponse.mock.calls[0][0];
      // system + 3 history + 1 new user message + 1 sandwich defense system = 6
      expect(sentMessages).toHaveLength(6);
    });

    it('should inject slot section into system prompt when options provided', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue('I have Tuesday at 2pm available.');

      const slotSection = '=== AVAILABLE SLOTS ===\nTuesday 17th March at 2pm';
      await service.sendMessage(lead, clinic, [], 'When can I come in?', {
        slotOptions: { slotSection },
      });

      const systemPrompt = mockGroqService.generateChatResponse.mock.calls[0][0][0].content;
      expect(systemPrompt).toContain('=== AVAILABLE SLOTS ===');
      expect(systemPrompt).toContain('Tuesday 17th March at 2pm');
    });

    it('should NOT include slot section when no options provided', async () => {
      mockGroqService.generateChatResponse.mockResolvedValue('How can I help?');

      await service.sendMessage(lead, clinic, [], 'Hello');

      const systemPrompt = mockGroqService.generateChatResponse.mock.calls[0][0][0].content;
      expect(systemPrompt).not.toContain('=== AVAILABLE SLOTS ===');
    });
  });
});
