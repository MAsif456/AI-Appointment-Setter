import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ConsentService } from './consent.service';
import { ConsentRecordEntry } from '../../database/schemas/consent-record.schema';
import { CONSENT_STATEMENT_VERSION, CONSENT_STATEMENT_TEXT } from '../gdpr.types';

const LEAD_ID = new Types.ObjectId().toHexString();
const CLINIC_ID = new Types.ObjectId().toHexString();
const CONV_ID = new Types.ObjectId().toHexString();

describe('ConsentService', () => {
  let service: ConsentService;

  const mockConsentModel = {
    create: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentService,
        {
          provide: getModelToken(ConsentRecordEntry.name),
          useValue: mockConsentModel,
        },
      ],
    }).compile();

    service = module.get<ConsentService>(ConsentService);
    jest.clearAllMocks();
  });

  describe('recordConsent', () => {
    it('creates a consent record with granted status', async () => {
      mockConsentModel.create.mockResolvedValue({ status: 'granted' });

      await service.recordConsent(LEAD_ID, CLINIC_ID, 'granted', 'sms', CONV_ID);

      expect(mockConsentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'granted',
          consentStatementVersion: CONSENT_STATEMENT_VERSION,
          consentStatementText: CONSENT_STATEMENT_TEXT,
          channel: 'sms',
        }),
      );
    });

    it('creates a consent record with declined status', async () => {
      mockConsentModel.create.mockResolvedValue({ status: 'declined' });

      await service.recordConsent(LEAD_ID, CLINIC_ID, 'declined', 'email');

      expect(mockConsentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'declined' }),
      );
    });

    it('omits conversationId when not provided', async () => {
      mockConsentModel.create.mockResolvedValue({ status: 'granted' });

      await service.recordConsent(LEAD_ID, CLINIC_ID, 'granted', 'sms');

      const callArg = mockConsentModel.create.mock.calls[0][0];
      expect(callArg.conversationId).toBeUndefined();
    });
  });

  describe('hasActiveConsent', () => {
    it('returns true when latest record is granted', async () => {
      mockConsentModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ status: 'granted' }),
        }),
      });

      expect(await service.hasActiveConsent(LEAD_ID, CLINIC_ID)).toBe(true);
    });

    it('returns false when latest record is withdrawn', async () => {
      mockConsentModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ status: 'withdrawn' }),
        }),
      });

      expect(await service.hasActiveConsent(LEAD_ID, CLINIC_ID)).toBe(false);
    });

    it('returns false when no records exist', async () => {
      mockConsentModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      expect(await service.hasActiveConsent(LEAD_ID, CLINIC_ID)).toBe(false);
    });
  });

  describe('getConsentHistory', () => {
    it('returns records sorted by createdAt descending', async () => {
      const records = [{ status: 'withdrawn' }, { status: 'granted' }];
      mockConsentModel.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(records),
      });

      const result = await service.getConsentHistory(LEAD_ID);
      expect(result).toEqual(records);
      expect(mockConsentModel.find).toHaveBeenCalled();
    });
  });

  describe('withdrawConsent', () => {
    it('creates a withdrawn record', async () => {
      mockConsentModel.create.mockResolvedValue({ status: 'withdrawn' });

      await service.withdrawConsent(LEAD_ID, CLINIC_ID);

      expect(mockConsentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'withdrawn', channel: 'website' }),
      );
    });
  });
});
