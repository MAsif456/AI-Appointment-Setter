import { Test, TestingModule } from '@nestjs/testing';
import { GreetingService } from './greeting.service';
import { GroqService } from './groq.service';
import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';

describe('GreetingService', () => {
  let service: GreetingService;
  let groqService: GroqService;

  const mockGroqService = {
    generateResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GreetingService,
        { provide: GroqService, useValue: mockGroqService },
      ],
    }).compile();

    service = module.get<GreetingService>(GreetingService);
    groqService = module.get<GroqService>(GroqService);
    jest.clearAllMocks();
  });

  const baseLead: LeadInfo = {
    firstName: 'Sarah',
    lastName: 'Williams',
    issue: 'Back pain',
  };

  const clinicWithTemplate: ClinicConfig = {
    clinicId: 'clinic_002',
    name: 'Newport Sports Clinic',
    tone: 'Professional',
    greetingTemplate:
      'Hello {{firstName}}! Thanks for contacting {{clinicName}} about your {{issue}}.',
    ghlLocationId: 'loc_002',
    isActive: true,
  };

  const clinicWithoutTemplate: ClinicConfig = {
    clinicId: 'clinic_001',
    name: 'Cardiff Chiropractic',
    tone: 'Friendly',
    ghlLocationId: 'loc_001',
    isActive: true,
  };

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateGreeting with custom template', () => {
    it('should return template with variables replaced', async () => {
      const lead: LeadInfo = {
        firstName: 'Tom',
        issue: 'neck pain',
      };

      const result = await service.generateGreeting(lead, clinicWithTemplate);

      expect(result).toBe(
        'Hello Tom! Thanks for contacting Newport Sports Clinic about your neck pain.',
      );
      // Should NOT call Groq API
      expect(mockGroqService.generateResponse).not.toHaveBeenCalled();
    });

    it('should replace all supported placeholders', async () => {
      const result = await service.generateGreeting(
        baseLead,
        clinicWithTemplate,
      );

      expect(result).toContain('Sarah');
      expect(result).toContain('Newport Sports Clinic');
      expect(result).toContain('Back pain');
    });

    it('should handle missing optional variables gracefully', async () => {
      const leadNoIssue: LeadInfo = { firstName: 'Jane' };
      const result = await service.generateGreeting(
        leadNoIssue,
        clinicWithTemplate,
      );

      expect(result).toContain('Jane');
      expect(result).toContain('Newport Sports Clinic');
      // issue placeholder should be replaced with empty string
      expect(result).not.toContain('{{issue}}');
    });
  });

  describe('generateGreeting without template (AI generation)', () => {
    it('should call GroqService and return AI-generated greeting', async () => {
      const aiGreeting = 'Hi Sarah! Welcome to Cardiff Chiropractic.';
      mockGroqService.generateResponse.mockResolvedValue(aiGreeting);

      const result = await service.generateGreeting(
        baseLead,
        clinicWithoutTemplate,
      );

      expect(result).toBe(aiGreeting);
      expect(mockGroqService.generateResponse).toHaveBeenCalledTimes(1);
    });

    it('should return null when GroqService returns null', async () => {
      mockGroqService.generateResponse.mockResolvedValue(null);

      const result = await service.generateGreeting(
        baseLead,
        clinicWithoutTemplate,
      );

      expect(result).toBeNull();
    });

    it('should pass a prompt string to GroqService', async () => {
      mockGroqService.generateResponse.mockResolvedValue('Hello!');

      await service.generateGreeting(baseLead, clinicWithoutTemplate);

      const passedPrompt = mockGroqService.generateResponse.mock.calls[0][0];
      expect(typeof passedPrompt).toBe('string');
      expect(passedPrompt).toContain('Sarah');
      expect(passedPrompt).toContain('Cardiff Chiropractic');
    });
  });
});
