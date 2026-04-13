import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ErasureService } from './erasure.service';
import { Lead } from '../../database/schemas/lead.schema';
import { Message } from '../../database/schemas/message.schema';
import { Conversation } from '../../database/schemas/conversation.schema';
import { Appointment } from '../../database/schemas/appointment.schema';
import { PatientHistory } from '../../database/schemas/patient-history.schema';
import { AuditLog } from '../../database/schemas/audit-log.schema';
import { ErasureRecord } from '../../database/schemas/erasure-record.schema';
import { ANONYMISED_VALUE } from '../gdpr.types';

const LEAD_ID = new Types.ObjectId().toHexString();
const CLINIC_ID = new Types.ObjectId();

describe('ErasureService', () => {
  let service: ErasureService;

  const mockLeadModel = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };
  const mockMessageModel = { updateMany: jest.fn().mockResolvedValue({ modifiedCount: 5 }) };
  const mockConversationModel = {
    find: jest.fn().mockResolvedValue([{ _id: 'conv1' }]),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const mockAppointmentModel = { updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }) };
  const mockPatientHistoryModel = { updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }) };
  const mockAuditLogModel = { create: jest.fn().mockResolvedValue({}) };
  const mockErasureModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErasureService,
        { provide: getModelToken(Lead.name), useValue: mockLeadModel },
        { provide: getModelToken(Message.name), useValue: mockMessageModel },
        { provide: getModelToken(Conversation.name), useValue: mockConversationModel },
        { provide: getModelToken(Appointment.name), useValue: mockAppointmentModel },
        { provide: getModelToken(PatientHistory.name), useValue: mockPatientHistoryModel },
        { provide: getModelToken(AuditLog.name), useValue: mockAuditLogModel },
        { provide: getModelToken(ErasureRecord.name), useValue: mockErasureModel },
      ],
    }).compile();

    service = module.get<ErasureService>(ErasureService);
    jest.clearAllMocks();
  });

  it('throws NotFoundException when lead does not exist', async () => {
    mockLeadModel.findById.mockResolvedValue(null);
    await expect(service.erasePatientData(LEAD_ID, 'staff')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns existing completed record (idempotent)', async () => {
    const completed = { originalLeadId: LEAD_ID, status: 'completed' };
    mockLeadModel.findById.mockResolvedValue({ clinicId: CLINIC_ID });
    mockErasureModel.findOne
      .mockResolvedValueOnce(completed) // completed check
      ;

    const result = await service.erasePatientData(LEAD_ID, 'staff');
    expect(result).toEqual(completed);
    expect(mockPatientHistoryModel.updateMany).not.toHaveBeenCalled();
  });

  describe('successful erasure', () => {
    const mockRecord = { _id: 'rec1', collectionsProcessed: {}, status: 'in_progress' };

    beforeEach(() => {
      mockLeadModel.findById.mockResolvedValue({ clinicId: CLINIC_ID });
      mockErasureModel.findOne
        .mockResolvedValueOnce(null)   // no completed
        .mockResolvedValueOnce(null);  // no in_progress
      mockErasureModel.create.mockResolvedValue(mockRecord);
      mockLeadModel.findByIdAndUpdate.mockResolvedValue({});
      mockErasureModel.findByIdAndUpdate.mockResolvedValue({});
    });

    it('anonymises all collections in order', async () => {
      await service.erasePatientData(LEAD_ID, 'staff');

      expect(mockPatientHistoryModel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: CLINIC_ID }),
        expect.objectContaining({
          $set: expect.objectContaining({ phone: ANONYMISED_VALUE }),
        }),
      );
      expect(mockAppointmentModel.updateMany).toHaveBeenCalled();
      expect(mockMessageModel.updateMany).toHaveBeenCalled();
      expect(mockConversationModel.updateMany).toHaveBeenCalled();
      expect(mockLeadModel.findByIdAndUpdate).toHaveBeenCalledWith(
        LEAD_ID,
        expect.objectContaining({
          $set: expect.objectContaining({ firstName: ANONYMISED_VALUE }),
        }),
      );
    });

    it('creates an audit log entry', async () => {
      await service.erasePatientData(LEAD_ID, 'staff');

      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'data.erased',
          entityType: 'lead',
          entityId: LEAD_ID,
          severity: 'warning',
        }),
      );
    });

    it('updates erasure record to completed', async () => {
      await service.erasePatientData(LEAD_ID, 'staff');

      expect(mockErasureModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'rec1',
        expect.objectContaining({
          $set: expect.objectContaining({ status: 'completed' }),
        }),
      );
    });

    it('records collection counts in the journal', async () => {
      await service.erasePatientData(LEAD_ID, 'staff');

      const updateCall = mockErasureModel.findByIdAndUpdate.mock.calls[0];
      const collections = updateCall[1].$set.collectionsProcessed;
      expect(collections.patientHistory).toBe(1);
      expect(collections.appointments).toBe(2);
      expect(collections.messages).toBe(5);
      expect(collections.conversations).toBe(1);
      expect(collections.lead).toBe(1);
    });
  });

  it('sets status to partial_failure on error', async () => {
    const mockRecord = { _id: 'rec1', collectionsProcessed: {}, status: 'in_progress' };
    mockLeadModel.findById.mockResolvedValue({ clinicId: CLINIC_ID });
    mockErasureModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mockErasureModel.create.mockResolvedValue(mockRecord);
    mockPatientHistoryModel.updateMany.mockRejectedValue(new Error('DB error'));
    mockErasureModel.findByIdAndUpdate.mockResolvedValue({});

    await expect(service.erasePatientData(LEAD_ID, 'staff')).rejects.toThrow('DB error');

    expect(mockErasureModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'rec1',
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'partial_failure',
          errorDetails: 'DB error',
        }),
      }),
    );
  });
});
