import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { GdprController } from './gdpr.controller';
import { ConsentService } from './consent/consent.service';
import { ErasureService } from './erasure/erasure.service';
import { ErasureRequestService } from './erasure/erasure-request.service';
import { GdprAuditInterceptor } from './audit/gdpr-audit.interceptor';
import { Reflector } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { AuditLog } from '../database/schemas/audit-log.schema';

const LEAD_ID = new Types.ObjectId().toHexString();
const REQUEST_ID = new Types.ObjectId().toHexString();

describe('GdprController', () => {
  let controller: GdprController;
  let consentService: { getConsentHistory: jest.Mock; withdrawConsent: jest.Mock; getLeadClinicId: jest.Mock };
  let erasureService: { erasePatientData: jest.Mock; getErasureStatus: jest.Mock };
  let erasureRequestService: {
    createRequest: jest.Mock;
    approveRequest: jest.Mock;
    rejectRequest: jest.Mock;
    listRequests: jest.Mock;
  };

  beforeEach(async () => {
    consentService = {
      getConsentHistory: jest.fn().mockResolvedValue([]),
      withdrawConsent: jest.fn().mockResolvedValue({}),
      getLeadClinicId: jest.fn().mockResolvedValue({ clinicId: 'clinic123' }),
    };
    erasureService = {
      erasePatientData: jest.fn().mockResolvedValue({}),
      getErasureStatus: jest.fn().mockResolvedValue(null),
    };
    erasureRequestService = {
      createRequest: jest.fn().mockResolvedValue({ status: 'pending' }),
      approveRequest: jest.fn().mockResolvedValue({ status: 'approved' }),
      rejectRequest: jest.fn().mockResolvedValue({ status: 'rejected' }),
      listRequests: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GdprController],
      providers: [
        { provide: ConsentService, useValue: consentService },
        { provide: ErasureService, useValue: erasureService },
        { provide: ErasureRequestService, useValue: erasureRequestService },
        { provide: Reflector, useValue: new Reflector() },
        { provide: getModelToken(AuditLog.name), useValue: { create: jest.fn() } },
        GdprAuditInterceptor,
      ],
    }).compile();

    controller = module.get<GdprController>(GdprController);
  });

  // ── Erasure request workflow ──────────────────────────────────────

  describe('requestErasure', () => {
    it('creates an erasure request with reason and user email', async () => {
      const req = { user: { email: 'staff@clinic.com' } };
      await controller.requestErasure(LEAD_ID, { reason: 'Patient asked' }, req);

      expect(erasureRequestService.createRequest).toHaveBeenCalledWith(
        LEAD_ID, 'staff@clinic.com', 'Patient asked',
      );
    });

    it('throws BadRequestException when reason is empty', async () => {
      const req = { user: { email: 'staff@clinic.com' } };
      await expect(
        controller.requestErasure(LEAD_ID, { reason: '  ' }, req),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults requestedBy to "unknown" when user email is missing', async () => {
      const req = { user: {} };
      await controller.requestErasure(LEAD_ID, { reason: 'Reason' }, req);

      expect(erasureRequestService.createRequest).toHaveBeenCalledWith(
        LEAD_ID, 'unknown', 'Reason',
      );
    });
  });

  describe('approveErasure', () => {
    it('delegates to erasureRequestService.approveRequest', async () => {
      const req = { user: { email: 'admin@clinic.com' } };
      await controller.approveErasure(REQUEST_ID, req);

      expect(erasureRequestService.approveRequest).toHaveBeenCalledWith(
        REQUEST_ID, 'admin@clinic.com',
      );
    });

    it('defaults approver to "admin" when email is missing', async () => {
      await controller.approveErasure(REQUEST_ID, { user: {} });

      expect(erasureRequestService.approveRequest).toHaveBeenCalledWith(
        REQUEST_ID, 'admin',
      );
    });
  });

  describe('rejectErasure', () => {
    it('delegates to erasureRequestService.rejectRequest', async () => {
      const req = { user: { email: 'admin@clinic.com' } };
      await controller.rejectErasure(REQUEST_ID, { reason: 'Not needed' }, req);

      expect(erasureRequestService.rejectRequest).toHaveBeenCalledWith(
        REQUEST_ID, 'admin@clinic.com', 'Not needed',
      );
    });
  });

  describe('listErasureRequests', () => {
    it('returns all requests for admin users', async () => {
      const req = { user: { email: 'admin@clinic.com', role: 'admin' } };
      await controller.listErasureRequests(req);

      expect(erasureRequestService.listRequests).toHaveBeenCalledWith();
    });

    it('filters by requester email for non-admin users', async () => {
      const req = { user: { email: 'staff@clinic.com', role: 'staff' } };
      await controller.listErasureRequests(req);

      expect(erasureRequestService.listRequests).toHaveBeenCalledWith('staff@clinic.com');
    });
  });

  // ── Direct erasure (admin-only) ───────────────────────────────────

  describe('erasePatientData', () => {
    it('delegates to erasureService.erasePatientData', async () => {
      const req = { user: { email: 'admin@clinic.com' } };
      await controller.erasePatientData(LEAD_ID, req);

      expect(erasureService.erasePatientData).toHaveBeenCalledWith(
        LEAD_ID, 'admin@clinic.com',
      );
    });
  });

  // ── Consent ───────────────────────────────────────────────────────

  describe('getConsentHistory', () => {
    it('returns consent history for a lead', async () => {
      const history = [{ status: 'granted' }];
      consentService.getConsentHistory.mockResolvedValue(history);

      const result = await controller.getConsentHistory(LEAD_ID);

      expect(result).toEqual(history);
      expect(consentService.getConsentHistory).toHaveBeenCalledWith(LEAD_ID);
    });
  });

  describe('withdrawConsent', () => {
    it('looks up clinicId from lead then delegates to consentService.withdrawConsent', async () => {
      await controller.withdrawConsent(LEAD_ID);

      expect(consentService.getLeadClinicId).toHaveBeenCalledWith(LEAD_ID);
      expect(consentService.withdrawConsent).toHaveBeenCalledWith(
        LEAD_ID, 'clinic123',
      );
    });
  });

  // ── Status ────────────────────────────────────────────────────────

  describe('getErasureStatus', () => {
    it('returns erasure status for a lead', async () => {
      erasureService.getErasureStatus.mockResolvedValue({ status: 'completed' });

      const result = await controller.getErasureStatus(LEAD_ID);

      expect(result).toEqual({ status: 'completed' });
    });

    it('returns null when no erasure record exists', async () => {
      const result = await controller.getErasureStatus(LEAD_ID);

      expect(result).toBeNull();
    });
  });
});
