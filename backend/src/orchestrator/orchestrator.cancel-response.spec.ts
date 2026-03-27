/**
 * Unit tests for OrchestratorService cancellation response generation.
 * Covers CANCEL, CONFIRM_CANCEL, and DECLINE_CANCEL intent handling.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { OrchestratorService, OrchestratorContext } from './orchestrator.service';
import { GreetingService } from '../ai/greeting.service';
import { GroqService } from '../ai/groq.service';
import { CancellationService } from '../cancellation/cancellation.service';
import { ConversationsService } from '../ghl/conversations.service';
import { MessagesService } from '../ghl/messages.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { ClinicConfig } from '../ai/interfaces/clinic-config.interface';

const mockGreetingService = { generateGreeting: jest.fn() };
const mockGroqService = { generateResponse: jest.fn(), generateChatResponse: jest.fn() };
const mockCancellationService = {
  checkAppointmentExists: jest.fn(),
  buildConfirmationPrompt: jest.fn(),
  evaluatePolicy: jest.fn(),
  executeCancellation: jest.fn(),
};
const mockConversationsService = { findByGhlContactId: jest.fn(), createForNewLead: jest.fn(), updatePhase: jest.fn() };
const mockMessagesService = { addMessage: jest.fn(), getByConversation: jest.fn() };
const mockGhlApiService = { sendMessageWithRetry: jest.fn(), getConversation: jest.fn(), createConversation: jest.fn() };

const clinicConfig: ClinicConfig = {
  clinicId: '507f1f77bcf86cd799439013',
  name: 'Cardiff Physiotherapy Centre',
  tone: 'Friendly',
  serviceAreas: ['CF', 'NP'],
  ghlLocationId: 'loc_cardiff_001',
  isActive: true,
};

const convId = '507f1f77bcf86cd799439011';
const baseContext: OrchestratorContext = {
  clinicId: clinicConfig.clinicId,
  ghlContactId: 'contact_123',
  conversationId: convId,
  phase: 'booked',
  messages: [],
  patientInfo: { firstName: 'Sarah' },
};

describe('OrchestratorService — cancellation responses', () => {
  let service: OrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: GreetingService, useValue: mockGreetingService },
        { provide: GroqService, useValue: mockGroqService },
        { provide: CancellationService, useValue: mockCancellationService },
        { provide: ConversationsService, useValue: mockConversationsService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: GhlApiService, useValue: mockGhlApiService },
      ],
    }).compile();

    service = module.get<OrchestratorService>(OrchestratorService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('CANCEL intent', () => {
    it('should return no-booking message when no appointment exists', async () => {
      mockCancellationService.checkAppointmentExists.mockResolvedValue(null);

      const result = await service.generateResponse({ intent: 'CANCEL' }, baseContext, clinicConfig);

      expect(result).toContain("don't have a booking on file");
    });

    it('should return confirmation prompt when appointment exists', async () => {
      const mockAppointment = { _id: new Types.ObjectId(), appointmentDate: new Date() };
      mockCancellationService.checkAppointmentExists.mockResolvedValue(mockAppointment);
      mockCancellationService.buildConfirmationPrompt.mockReturnValue(
        "Just to confirm, you'd like to cancel your appointment on Tuesday 17th March at 2:00 PM. Is that correct?",
      );

      const result = await service.generateResponse({ intent: 'CANCEL' }, baseContext, clinicConfig);

      expect(result).toContain('Just to confirm');
      expect(result).toContain('Is that correct?');
    });

    it('should return no-booking message when conversationId is missing', async () => {
      const noConvContext = { ...baseContext, conversationId: undefined };
      const result = await service.generateResponse({ intent: 'CANCEL' }, noConvContext, clinicConfig);
      expect(result).toContain("don't have a booking on file");
    });
  });

  describe('CONFIRM_CANCEL intent', () => {
    const cancellingContext = { ...baseContext, phase: 'cancelling' };
    const warnedContext = { ...baseContext, phase: 'cancelling_warned' };
    const mockAppointment = { _id: new Types.ObjectId(), appointmentDate: new Date() };

    it('should execute cancellation when no fee warning needed (>24h)', async () => {
      mockCancellationService.checkAppointmentExists.mockResolvedValue(mockAppointment);
      mockCancellationService.evaluatePolicy.mockResolvedValue({ withinNotice: false, feeEnabled: false });
      mockCancellationService.executeCancellation.mockResolvedValue({
        success: true,
        message: 'Your appointment has been cancelled. Feel free to book again anytime!',
      });

      const result = await service.generateResponse({ intent: 'CONFIRM_CANCEL' }, cancellingContext, clinicConfig);

      expect(result).toContain('cancelled');
      expect(mockCancellationService.executeCancellation).toHaveBeenCalled();
    });

    it('should return fee warning when within notice period and fee enabled', async () => {
      mockCancellationService.checkAppointmentExists.mockResolvedValue(mockAppointment);
      mockCancellationService.evaluatePolicy.mockResolvedValue({
        withinNotice: true,
        feeEnabled: true,
        feeDescription: '£50',
        warningMessage: 'Cancellations within 24 hours may incur a fee of £50. Would you like to proceed or reschedule instead?',
      });

      const result = await service.generateResponse({ intent: 'CONFIRM_CANCEL' }, cancellingContext, clinicConfig);

      expect(result).toContain('incur a fee');
      expect(result).toContain('£50');
      expect(mockCancellationService.executeCancellation).not.toHaveBeenCalled();
    });

    it('should execute cancellation from cancelling_warned phase (post-warning confirm)', async () => {
      mockCancellationService.checkAppointmentExists.mockResolvedValue(mockAppointment);
      mockCancellationService.executeCancellation.mockResolvedValue({
        success: true,
        message: 'Your appointment has been cancelled. Feel free to book again anytime!',
      });

      const result = await service.generateResponse({ intent: 'CONFIRM_CANCEL' }, warnedContext, clinicConfig);

      expect(result).toContain('cancelled');
      expect(mockCancellationService.executeCancellation).toHaveBeenCalled();
      // Should NOT call evaluatePolicy — already warned
      expect(mockCancellationService.evaluatePolicy).not.toHaveBeenCalled();
    });
  });

  describe('DECLINE_CANCEL intent', () => {
    it('should reassure appointment is kept when declining from cancelling phase', async () => {
      const ctx = { ...baseContext, phase: 'cancelling' };
      const result = await service.generateResponse({ intent: 'DECLINE_CANCEL' }, ctx, clinicConfig);

      expect(result).toContain('still confirmed');
    });

    it('should offer rescheduling when declining from cancelling_warned phase', async () => {
      const ctx = { ...baseContext, phase: 'cancelling_warned' };
      const result = await service.generateResponse({ intent: 'DECLINE_CANCEL' }, ctx, clinicConfig);

      expect(result).toContain('rescheduling');
    });
  });
});
