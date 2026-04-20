import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ErasureRequestService } from './erasure-request.service';
import { ErasureRequest } from '../../database/schemas/erasure-request.schema';
import { Lead } from '../../database/schemas/lead.schema';
import { Clinic } from '../../database/schemas/clinic.schema';
import { AuditLog } from '../../database/schemas/audit-log.schema';
import { ErasureService } from './erasure.service';

const LEAD_ID = new Types.ObjectId().toHexString();
const CLINIC_ID = new Types.ObjectId();
const REQUEST_ID = new Types.ObjectId().toHexString();

describe('ErasureRequestService', () => {
  let service: ErasureRequestService;
  let erasureService: { erasePatientData: jest.Mock };

  const mockRequestModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  };
  const mockLeadModel = {
    findById: jest.fn(),
  };
  const mockClinicModel = {
    findById: jest.fn(),
  };
  const mockAuditLogModel = {
    create: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    erasureService = { erasePatientData: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErasureRequestService,
        { provide: getModelToken(ErasureRequest.name), useValue: mockRequestModel },
        { provide: getModelToken(Lead.name), useValue: mockLeadModel },
        { provide: getModelToken(Clinic.name), useValue: mockClinicModel },
        { provide: getModelToken(AuditLog.name), useValue: mockAuditLogModel },
        { provide: ErasureService, useValue: erasureService },
      ],
    }).compile();

    service = module.get<ErasureRequestService>(ErasureRequestService);
    jest.clearAllMocks();
  });

  describe('createRequest', () => {
    it('throws NotFoundException when lead does not exist', async () => {
      mockLeadModel.findById.mockResolvedValue(null);

      await expect(
        service.createRequest(LEAD_ID, 'staff@clinic.com', 'Patient requested'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when a pending request already exists', async () => {
      mockLeadModel.findById.mockResolvedValue({ clinicId: CLINIC_ID });
      mockRequestModel.findOne.mockResolvedValue({ status: 'pending' });

      await expect(
        service.createRequest(LEAD_ID, 'staff@clinic.com', 'Patient requested'),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a request and audit log on success', async () => {
      const mockRequest = { leadId: LEAD_ID, clinicId: CLINIC_ID, status: 'pending' };
      mockLeadModel.findById.mockResolvedValue({
        clinicId: CLINIC_ID, firstName: 'Test', lastName: 'Patient', email: 'test@example.com',
      });
      mockRequestModel.findOne.mockResolvedValue(null);
      mockRequestModel.create.mockResolvedValue(mockRequest);
      mockClinicModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: 'Test Clinic' }),
      });

      const result = await service.createRequest(LEAD_ID, 'staff@clinic.com', 'Patient requested');

      expect(result).toEqual(mockRequest);
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'erasure.requested',
          entityType: 'lead',
          entityId: LEAD_ID,
          severity: 'warning',
        }),
      );
    });
  });

  describe('approveRequest', () => {
    it('throws NotFoundException when request does not exist', async () => {
      mockRequestModel.findById.mockResolvedValue(null);

      await expect(
        service.approveRequest(REQUEST_ID, 'admin@clinic.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when request is not pending', async () => {
      mockRequestModel.findById.mockResolvedValue({ status: 'approved' });

      await expect(
        service.approveRequest(REQUEST_ID, 'admin@clinic.com'),
      ).rejects.toThrow(ConflictException);
    });

    it('triggers erasure and updates request status on approval', async () => {
      const mockRequest: Record<string, unknown> = {
        _id: REQUEST_ID,
        leadId: new Types.ObjectId(LEAD_ID),
        clinicId: CLINIC_ID,
        status: 'pending',
        requestedBy: 'staff@clinic.com',
        save: jest.fn().mockResolvedValue({}),
      };
      mockRequestModel.findById.mockResolvedValue(mockRequest);
      mockLeadModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ firstName: 'Test', lastName: 'Patient', email: 'test@example.com' }),
      });
      mockClinicModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: 'Test Clinic' }),
      });

      await service.approveRequest(REQUEST_ID, 'admin@clinic.com');

      expect(erasureService.erasePatientData).toHaveBeenCalledWith(
        LEAD_ID,
        'approved_by:admin@clinic.com',
      );
      expect(mockRequest.status).toBe('approved');
      expect(mockRequest.reviewedBy).toBe('admin@clinic.com');
      expect(mockRequest.save as jest.Mock).toHaveBeenCalled();
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'erasure.approved' }),
      );
    });
  });

  describe('rejectRequest', () => {
    it('throws NotFoundException when request does not exist', async () => {
      mockRequestModel.findById.mockResolvedValue(null);

      await expect(
        service.rejectRequest(REQUEST_ID, 'admin@clinic.com', 'Insufficient reason'),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets status to rejected with reason', async () => {
      const mockRequest: Record<string, unknown> = {
        _id: REQUEST_ID,
        leadId: new Types.ObjectId(LEAD_ID),
        clinicId: CLINIC_ID,
        status: 'pending',
        requestedBy: 'staff@clinic.com',
        save: jest.fn().mockResolvedValue({}),
      };
      mockRequestModel.findById.mockResolvedValue(mockRequest);
      mockLeadModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ firstName: 'Test', lastName: 'Patient', email: 'test@example.com' }),
      });
      mockClinicModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ name: 'Test Clinic' }),
      });

      await service.rejectRequest(REQUEST_ID, 'admin@clinic.com', 'Data still needed');

      expect(mockRequest.status).toBe('rejected');
      expect(mockRequest.rejectionReason).toBe('Data still needed');
      expect(mockRequest.save as jest.Mock).toHaveBeenCalled();
      expect(erasureService.erasePatientData).not.toHaveBeenCalled();
      expect(mockAuditLogModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'erasure.rejected', severity: 'info' }),
      );
    });
  });

  describe('listRequests', () => {
    it('returns all requests for admin (no filter)', async () => {
      const requests = [{ status: 'pending' }, { status: 'approved' }];
      mockRequestModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(requests) }),
        }),
      });

      const result = await service.listRequests();

      expect(result).toEqual(requests);
      expect(mockRequestModel.find).toHaveBeenCalledWith({});
    });

    it('filters by requestedBy for staff', async () => {
      mockRequestModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      });

      await service.listRequests('staff@clinic.com');

      expect(mockRequestModel.find).toHaveBeenCalledWith({ requestedBy: 'staff@clinic.com' });
    });
  });
});
