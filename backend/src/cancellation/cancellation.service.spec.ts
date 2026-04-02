import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Logger } from '@nestjs/common';
import { CancellationService } from './cancellation.service';
import { GhlApiService } from '../ghl/ghl-api.service';
import { Conversation } from '../database/schemas/conversation.schema';
import { Appointment } from '../database/schemas/appointment.schema';
import { Clinic } from '../database/schemas/clinic.schema';

describe('CancellationService', () => {
  let service: CancellationService;

  const mockConversationModel = { findById: jest.fn(), findByIdAndUpdate: jest.fn() };
  const mockAppointmentModel = { findById: jest.fn(), findByIdAndUpdate: jest.fn() };
  const mockClinicModel = { findById: jest.fn() };
  const mockGhlApiService = {
    cancelAppointment: jest.fn(),
    addContactTag: jest.fn(),
    removeContactTag: jest.fn(),
    sendMessageWithRetry: jest.fn(),
  };

  // Reusable test data
  const conversationId = new Types.ObjectId('507f1f77bcf86cd799439011');
  const appointmentId = new Types.ObjectId('507f1f77bcf86cd799439012');
  const clinicId = new Types.ObjectId('507f1f77bcf86cd799439013');

  // Appointment 48 hours in the future (outside default 24h notice)
  const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
  // Appointment 2 hours in the future (within default 24h notice)
  const soonDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const mockAppointment = {
    _id: appointmentId,
    ghlAppointmentId: 'ghl_apt_123',
    appointmentDate: futureDate,
    status: 'confirmed',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationService,
        { provide: getModelToken(Conversation.name), useValue: mockConversationModel },
        { provide: getModelToken(Appointment.name), useValue: mockAppointmentModel },
        { provide: getModelToken(Clinic.name), useValue: mockClinicModel },
        { provide: GhlApiService, useValue: mockGhlApiService },
      ],
    }).compile();

    service = module.get<CancellationService>(CancellationService);
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  describe('checkAppointmentExists', () => {
    it('should return null when conversation has no appointmentId', async () => {
      mockConversationModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ appointmentId: null }) });

      const result = await service.checkAppointmentExists(conversationId);
      expect(result).toBeNull();
    });

    it('should return null when appointment status is not confirmed', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ appointmentId }),
      });
      mockAppointmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockAppointment, status: 'cancelled' }),
      });

      const result = await service.checkAppointmentExists(conversationId);
      expect(result).toBeNull();
    });

    it('should return the appointment when it exists and is confirmed', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ appointmentId }),
      });
      mockAppointmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAppointment),
      });

      const result = await service.checkAppointmentExists(conversationId);
      expect(result).toEqual(mockAppointment);
    });
  });

  describe('buildConfirmationPrompt', () => {
    it('should format the appointment date in British English', () => {
      const appointment = { ...mockAppointment, appointmentDate: new Date('2026-03-17T14:00:00Z') } as any;
      const result = service.buildConfirmationPrompt(appointment);

      expect(result).toContain('Tuesday 17th March');
      expect(result).toContain('2:00 PM');
      expect(result).toContain('Is that correct?');
    });
  });

  describe('evaluatePolicy', () => {
    it('should return withinNotice=false when appointment is >24h away', async () => {
      mockClinicModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ cancellationPolicy: { noticeHours: 24, feeEnabled: false } }),
      });

      const result = await service.evaluatePolicy(mockAppointment as any, clinicId);
      expect(result.withinNotice).toBe(false);
      expect(result.warningMessage).toBeUndefined();
    });

    it('should return fee warning when appointment is <24h away and fee enabled', async () => {
      const soonAppointment = { ...mockAppointment, appointmentDate: soonDate };
      mockClinicModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          cancellationPolicy: { noticeHours: 24, feeEnabled: true, feeDescription: '£50' },
        }),
      });

      const result = await service.evaluatePolicy(soonAppointment as any, clinicId);
      expect(result.withinNotice).toBe(true);
      expect(result.feeEnabled).toBe(true);
      expect(result.warningMessage).toContain('£50');
    });

    it('should not warn when appointment is <24h away but fee disabled', async () => {
      const soonAppointment = { ...mockAppointment, appointmentDate: soonDate };
      mockClinicModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          cancellationPolicy: { noticeHours: 24, feeEnabled: false },
        }),
      });

      const result = await service.evaluatePolicy(soonAppointment as any, clinicId);
      expect(result.withinNotice).toBe(true);
      expect(result.feeEnabled).toBe(false);
      expect(result.warningMessage).toBeUndefined();
    });

    it('should use configurable noticeHours (e.g. 48h)', async () => {
      // Appointment is 48h away — within a 72h notice period
      mockClinicModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          cancellationPolicy: { noticeHours: 72, feeEnabled: true, feeDescription: '£30' },
        }),
      });

      const result = await service.evaluatePolicy(mockAppointment as any, clinicId);
      expect(result.withinNotice).toBe(true);
      expect(result.warningMessage).toContain('72 hours');
    });

    it('should use custom cancellationMessage template when configured', async () => {
      const soonAppointment = { ...mockAppointment, appointmentDate: soonDate };
      mockClinicModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          cancellationPolicy: {
            noticeHours: 24,
            feeEnabled: true,
            feeDescription: '£50',
            cancellationMessage: 'Late cancellations incur a {{feeDescription}} charge within {{noticeHours}}h.',
          },
        }),
      });

      const result = await service.evaluatePolicy(soonAppointment as any, clinicId);
      expect(result.warningMessage).toBe('Late cancellations incur a £50 charge within 24h.');
    });
  });

  describe('executeCancellation', () => {
    beforeEach(() => {
      mockAppointmentModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAppointment),
      });
      mockAppointmentModel.findByIdAndUpdate.mockResolvedValue({});
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ghlConversationId: 'ghl_conv_123' }),
      });
      mockGhlApiService.cancelAppointment.mockResolvedValue({ id: 'ghl_apt_123' });
      mockGhlApiService.addContactTag.mockResolvedValue({});
      mockGhlApiService.removeContactTag.mockResolvedValue({});
      mockGhlApiService.sendMessageWithRetry.mockResolvedValue({});
    });

    it('should cancel in GHL and update local records', async () => {
      const result = await service.executeCancellation(conversationId, appointmentId, 'contact_123', 'Too busy');

      expect(result.success).toBe(true);
      expect(result.message).toContain('cancelled');
      expect(mockGhlApiService.cancelAppointment).toHaveBeenCalledWith('ghl_apt_123');
      expect(mockAppointmentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        appointmentId,
        expect.objectContaining({ status: 'cancelled', cancellationReason: 'Too busy' }),
      );
    });

    it('should push to cancelledAppointments audit array', async () => {
      await service.executeCancellation(conversationId, appointmentId, 'contact_123');

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({
          phase: 'cancelled',
          appointmentId: null,
          $push: expect.objectContaining({
            cancelledAppointments: expect.objectContaining({
              ghlAppointmentId: 'ghl_apt_123',
              cancelledBy: 'lead',
            }),
          }),
        }),
      );
    });

    it('should add cancelled tag and remove appointment-booked tag', async () => {
      await service.executeCancellation(conversationId, appointmentId, 'contact_123');

      expect(mockGhlApiService.addContactTag).toHaveBeenCalledWith('contact_123', 'cancelled');
      expect(mockGhlApiService.removeContactTag).toHaveBeenCalledWith('contact_123', 'appointment-booked');
    });

    it('should still succeed locally when GHL cancel returns null', async () => {
      mockGhlApiService.cancelAppointment.mockResolvedValue(null);

      const result = await service.executeCancellation(conversationId, appointmentId, 'contact_123');

      expect(result.success).toBe(true);
      expect(mockAppointmentModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('should return failure when appointment not found', async () => {
      mockAppointmentModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      const result = await service.executeCancellation(conversationId, appointmentId, 'contact_123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should store cancellationReason when provided', async () => {
      await service.executeCancellation(conversationId, appointmentId, 'contact_123', 'Moving away');

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        conversationId,
        expect.objectContaining({ cancellationReason: 'Moving away' }),
      );
    });

    it('should send clinic notification via GHL messaging', async () => {
      await service.executeCancellation(conversationId, appointmentId, 'contact_123', 'Schedule conflict');

      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SMS',
          contactId: 'contact_123',
          message: expect.stringContaining('Cancellation notice'),
        }),
      );
    });

    it('should include reason in clinic notification when provided', async () => {
      await service.executeCancellation(conversationId, appointmentId, 'contact_123', 'Too expensive');

      expect(mockGhlApiService.sendMessageWithRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Reason: Too expensive'),
        }),
      );
    });
  });

  describe('isAwaitingReason', () => {
    it('should return true when awaitingCancellationReason flag is set', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ awaitingCancellationReason: true }),
      });

      const result = await service.isAwaitingReason(conversationId);
      expect(result).toBe(true);
    });

    it('should return false when flag is not set', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ awaitingCancellationReason: false }),
      });

      const result = await service.isAwaitingReason(conversationId);
      expect(result).toBe(false);
    });

    it('should return false when conversation not found', async () => {
      mockConversationModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      const result = await service.isAwaitingReason(conversationId);
      expect(result).toBe(false);
    });
  });

  describe('requestReason', () => {
    it('should set awaitingCancellationReason flag and return prompt', async () => {
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      const result = await service.requestReason(conversationId);

      expect(result).toContain('reason');
      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        conversationId,
        { awaitingCancellationReason: true },
      );
    });
  });

  describe('storeReason', () => {
    it('should store reason and clear awaiting flag', async () => {
      mockConversationModel.findByIdAndUpdate.mockResolvedValue({});

      await service.storeReason(conversationId, 'Too expensive');

      expect(mockConversationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        conversationId,
        { cancellationReason: 'Too expensive', awaitingCancellationReason: false },
      );
    });
  });
});
