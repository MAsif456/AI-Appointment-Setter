import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { EscalationService } from './escalation.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { UrgencyAssessment } from './urgency-detector.types';

describe('EscalationService', () => {
  let service: EscalationService;
  let mockGhlApi: { sendMessageWithRetry: jest.Mock };
  let mockConversationModel: { findByIdAndUpdate: jest.Mock };
  let mockLeadModel: { findByIdAndUpdate: jest.Mock };

  const mockConversation: any = { _id: 'conv_1', ghlContactId: 'ghl_c1' };
  const mockLead: any = {
    _id: 'lead_1', firstName: 'Sarah', lastName: 'Jones',
    phone: '07700 900123', issue: 'Back pain', ghlContactId: 'ghl_c1', ghlTags: [],
  };
  const mockClinic: any = { _id: 'clinic_1', name: 'Cardiff Physio' };

  const emergencyAssessment: UrgencyAssessment = {
    level: 'emergency', score: 1.0,
    signals: [{ source: 'keyword', text: 'chest pain', score: 1.0, classification: 'emergency' }],
    isAmbiguous: false, requiresEscalation: true, emergencyKeywordsMatched: ['chest pain'],
  };

  beforeEach(async () => {
    mockGhlApi = { sendMessageWithRetry: jest.fn().mockResolvedValue({}) };
    mockConversationModel = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) };
    mockLeadModel = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: GhlApiService, useValue: mockGhlApi },
        { provide: getModelToken('Conversation'), useValue: mockConversationModel },
        { provide: getModelToken('Lead'), useValue: mockLeadModel },
      ],
    }).compile();

    service = module.get(EscalationService);
  });

  describe('escalateEmergency', () => {
    it('sets conversation flags and returns emergency message', async () => {
      const result = await service.escalateEmergency(
        mockConversation, mockLead, mockClinic, emergencyAssessment,
      );

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({
          isEmergency: true,
          requiresHumanIntervention: true,
          phase: 'escalated',
        }),
      );
      expect(result.aiMessage).toContain('999');
      expect(result.aiMessage).toContain('notified the clinic team');
    });

    it('falls back to conversation.ghlContactId when lead.ghlContactId is null', async () => {
      const leadNoGhl = { ...mockLead, ghlContactId: undefined };

      await service.escalateEmergency(
        mockConversation, leadNoGhl as any, mockClinic, emergencyAssessment,
      );

      expect(mockGhlApi.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'ghl_c1' }),
      );
    });

    it('falls back to lead._id when both ghlContactId fields are null', async () => {
      const leadNoGhl = { ...mockLead, ghlContactId: undefined };
      const convNoGhl = { ...mockConversation, ghlContactId: undefined };

      await service.escalateEmergency(
        convNoGhl as any, leadNoGhl as any, mockClinic, emergencyAssessment,
      );

      expect(mockGhlApi.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'lead_1' }),
      );
    });

    it('handles GHL notification failure gracefully', async () => {
      mockGhlApi.sendMessageWithRetry.mockRejectedValue(new Error('GHL down'));

      const result = await service.escalateEmergency(
        mockConversation, mockLead, mockClinic, emergencyAssessment,
      );

      // Should still return a valid result even when GHL fails
      expect(result.aiMessage).toContain('999');
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('handleNoSlotsForUrgent', () => {
    it('sets requiresHumanIntervention and returns patient message', async () => {
      const msg = await service.handleNoSlotsForUrgent(
        mockConversation, mockClinic, mockLead,
      );

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'conv_1',
        expect.objectContaining({ requiresHumanIntervention: true }),
      );
      expect(msg).toContain('flagged your case as urgent');
      expect(msg).toContain('Someone will be in touch');
    });

    it('falls back to lead._id when ghlContactId fields are null', async () => {
      const leadNoGhl = { ...mockLead, ghlContactId: undefined };
      const convNoGhl = { ...mockConversation, ghlContactId: undefined };

      await service.handleNoSlotsForUrgent(convNoGhl as any, mockClinic, leadNoGhl as any);

      expect(mockGhlApi.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 'lead_1' }),
      );
    });
  });

  describe('updateGhlTags', () => {
    it('adds urgency tag to lead', async () => {
      await service.updateGhlTags(mockLead, 'urgent');

      expect(mockLeadModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'lead_1',
        { $addToSet: { ghlTags: 'urgent' } },
      );
    });

    it('does not duplicate existing tag', async () => {
      const taggedLead = { ...mockLead, ghlTags: ['urgent'] };
      await service.updateGhlTags(taggedLead as any, 'urgent');

      expect(mockLeadModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
