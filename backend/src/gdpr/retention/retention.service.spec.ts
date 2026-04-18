import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RetentionService } from './retention.service';
import { Lead } from '../../database/schemas/lead.schema';
import { Clinic } from '../../database/schemas/clinic.schema';
import { Conversation } from '../../database/schemas/conversation.schema';
import { AuditLog } from '../../database/schemas/audit-log.schema';
import { ErasureService } from '../erasure/erasure.service';
import { ANONYMISED_VALUE } from '../gdpr.types';

const CLINIC_ID = new Types.ObjectId();
const LEAD_ID = new Types.ObjectId();

describe('RetentionService', () => {
  let service: RetentionService;
  let erasureService: { erasePatientData: jest.Mock };

  const mockLeadModel = { find: jest.fn() };
  const mockClinicModel = { find: jest.fn() };
  const mockConversationModel = { findOne: jest.fn() };
  const mockAuditLogModel = { create: jest.fn().mockResolvedValue({}) };

  beforeEach(async () => {
    erasureService = { erasePatientData: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetentionService,
        { provide: getModelToken(Lead.name), useValue: mockLeadModel },
        { provide: getModelToken(Clinic.name), useValue: mockClinicModel },
        { provide: getModelToken(Conversation.name), useValue: mockConversationModel },
        { provide: getModelToken(AuditLog.name), useValue: mockAuditLogModel },
        { provide: ErasureService, useValue: erasureService },
      ],
    }).compile();

    service = module.get<RetentionService>(RetentionService);
    jest.clearAllMocks();
  });

  it('anonymises expired leads with no recent conversations', async () => {
    mockClinicModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: CLINIC_ID, isActive: true, dataRetentionMonths: 6 }]),
    });
    mockLeadModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: LEAD_ID, clinicId: CLINIC_ID }]),
    });
    mockConversationModel.findOne.mockResolvedValue(null); // no recent conv

    await service.runRetentionCleanup();

    expect(erasureService.erasePatientData).toHaveBeenCalledWith(
      LEAD_ID.toString(),
      'retention_job',
    );
  });

  it('skips leads with recent conversations', async () => {
    mockClinicModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: CLINIC_ID, isActive: true }]),
    });
    mockLeadModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: LEAD_ID }]),
    });
    mockConversationModel.findOne.mockResolvedValue({ _id: 'recent-conv' });

    await service.runRetentionCleanup();

    expect(erasureService.erasePatientData).not.toHaveBeenCalled();
  });

  it('skips already-anonymised leads via query filter', async () => {
    mockClinicModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: CLINIC_ID, isActive: true }]),
    });
    mockLeadModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]), // filter excludes [REDACTED]
    });

    await service.runRetentionCleanup();

    expect(erasureService.erasePatientData).not.toHaveBeenCalled();
  });

  it('creates an audit log when leads are anonymised', async () => {
    mockClinicModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: CLINIC_ID, isActive: true }]),
    });
    mockLeadModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: LEAD_ID }]),
    });
    mockConversationModel.findOne.mockResolvedValue(null);

    await service.runRetentionCleanup();

    expect(mockAuditLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'data.retention_cleanup',
        severity: 'info',
      }),
    );
  });

  it('does not create audit log when no leads anonymised', async () => {
    mockClinicModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: CLINIC_ID, isActive: true }]),
    });
    mockLeadModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    await service.runRetentionCleanup();

    expect(mockAuditLogModel.create).not.toHaveBeenCalled();
  });

  it('continues processing other leads when one fails', async () => {
    const LEAD_ID_2 = new Types.ObjectId();
    mockClinicModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: CLINIC_ID, isActive: true }]),
    });
    mockLeadModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: LEAD_ID }, { _id: LEAD_ID_2 }]),
    });
    mockConversationModel.findOne.mockResolvedValue(null);
    erasureService.erasePatientData
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({});

    await service.runRetentionCleanup();

    expect(erasureService.erasePatientData).toHaveBeenCalledTimes(2);
  });

  it('uses default 12-month retention when clinic has no config', async () => {
    mockClinicModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([{ _id: CLINIC_ID, isActive: true }]),
    });
    mockLeadModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    await service.runRetentionCleanup();

    // Verify the query used the correct cutoff (12 months ago)
    const findCall = mockLeadModel.find.mock.calls[0][0];
    expect(findCall.clinicId).toEqual(CLINIC_ID);
    expect(findCall.firstName).toEqual({ $ne: ANONYMISED_VALUE });
    expect(findCall.updatedAt.$lt).toBeInstanceOf(Date);
  });
});
