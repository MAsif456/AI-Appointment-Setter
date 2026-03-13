/**
 * Unit tests for WebhooksService.
 *
 * Covers all routing branches: missing location.id, unknown clinic, inactive clinic,
 * ContactCreate, InboundMessage, unrecognised event type, and database errors.
 * ClinicsService is mocked so no database connection is required.
 *
 * Test payloads match GHL's actual standard data format:
 *   - Location ID is nested as location.id
 *   - Contact names are snake_case (first_name, last_name)
 *   - Message content is nested as message.body
 */
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { ClinicsService } from '../clinics/clinics.service';

/** Minimal mock clinic document representing an active clinic. */
const mockActiveClinic = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Cardiff Physiotherapy Centre',
  ghlLocationId: 'loc_cardiff_001',
  isActive: true,
};

/** Minimal mock clinic document representing an inactive clinic. */
const mockInactiveClinic = { ...mockActiveClinic, isActive: false };

/** Reusable GHL-format location object for loc_cardiff_001. */
const cardiffLocation = { id: 'loc_cardiff_001', name: 'Cardiff Physio' };

describe('WebhooksService', () => {
  let service: WebhooksService;
  let clinicsService: { findByGhlLocationId: jest.Mock };

  beforeEach(async () => {
    clinicsService = {
      findByGhlLocationId: jest.fn().mockResolvedValue(mockActiveClinic),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: ClinicsService, useValue: clinicsService },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);

    /** Silence logger output during tests to keep the console clean. */
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('handleGhlWebhook', () => {
    it('should always return { success: true } for a valid active clinic', async () => {
      const result = await service.handleGhlWebhook({
        type: 'ContactCreate',
        location: cardiffLocation,
      });

      expect(result).toEqual({ success: true });
    });

    it('should log the full raw payload on every call', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      const payload = { type: 'ContactCreate', location: cardiffLocation };

      await service.handleGhlWebhook(payload);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(payload)),
      );
    });

    it('should warn and return 200 when the location field is absent from the payload', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      const result = await service.handleGhlWebhook({ type: 'ContactCreate' });

      expect(result).toEqual({ success: true });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing locationId'),
      );
      expect(clinicsService.findByGhlLocationId).not.toHaveBeenCalled();
    });

    it('should log "Unknown GHL Location ID" and return 200 when no clinic is found', async () => {
      clinicsService.findByGhlLocationId.mockResolvedValue(null);
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      const result = await service.handleGhlWebhook({
        type: 'ContactCreate',
        location: { id: 'loc_unknown_999' },
      });

      expect(result).toEqual({ success: true });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown GHL Location ID: loc_unknown_999'),
      );
    });

    it('should log "Clinic is inactive" and return 200 when the clinic is inactive', async () => {
      clinicsService.findByGhlLocationId.mockResolvedValue(mockInactiveClinic);
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      const result = await service.handleGhlWebhook({
        type: 'ContactCreate',
        location: cardiffLocation,
      });

      expect(result).toEqual({ success: true });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Clinic is inactive, ignoring webhook'),
      );
    });

    it('should log "Routing lead to clinic" for a ContactCreate event', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.handleGhlWebhook({
        type: 'ContactCreate',
        location: cardiffLocation,
        first_name: 'Jane',
        last_name: 'Doe',
        phone: '07700900000',
        email: 'jane@example.com',
        issue: 'Back pain',
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Routing lead to clinic: Cardiff Physiotherapy Centre'),
      );
    });

    it('should log "Routing message to clinic" for an InboundMessage event', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.handleGhlWebhook({
        type: 'InboundMessage',
        location: cardiffLocation,
        id: 'contact_abc123',
        conversationId: 'conv_xyz789',
        message: { body: 'I need an appointment please' },
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Routing message to clinic: Cardiff Physiotherapy Centre'),
      );
    });

    it('should warn for an unrecognised event type and still return 200', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn');

      const result = await service.handleGhlWebhook({
        type: 'AppointmentBooked',
        location: cardiffLocation,
      });

      expect(result).toEqual({ success: true });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unrecognised GHL event type: AppointmentBooked'),
      );
    });

    it('should return 200 and log the error when clinicsService throws', async () => {
      clinicsService.findByGhlLocationId.mockRejectedValue(
        new Error('DB connection lost'),
      );
      const errorSpy = jest.spyOn(Logger.prototype, 'error');

      const result = await service.handleGhlWebhook({
        type: 'ContactCreate',
        location: cardiffLocation,
      });

      expect(result).toEqual({ success: true });
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('DB connection lost'),
        expect.anything(),
      );
    });

    it('should call findByGhlLocationId with the location.id from the payload', async () => {
      await service.handleGhlWebhook({
        type: 'ContactCreate',
        location: cardiffLocation,
      });

      expect(clinicsService.findByGhlLocationId).toHaveBeenCalledWith('loc_cardiff_001');
    });

    it('should return 200 for a completely empty payload without throwing', async () => {
      const result = await service.handleGhlWebhook({});

      expect(result).toEqual({ success: true });
    });
  });
});
