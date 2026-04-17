import { handleConsentGranted, handleConsentDeclined } from './consent.handler';
import { CONSENT_ACKNOWLEDGED_RESPONSE, CONSENT_DECLINED_RESPONSE } from '../gdpr.types';

describe('consent.handler', () => {
  const mockConsentService = { recordConsent: jest.fn().mockResolvedValue({}) };

  const baseDeps = {
    consentService: mockConsentService as any,
    leadId: '507f1f77bcf86cd799439011',
    clinicId: '507f1f77bcf86cd799439012',
    conversationId: '507f1f77bcf86cd799439013',
    channel: 'sms',
  };

  beforeEach(() => jest.clearAllMocks());

  describe('handleConsentGranted', () => {
    it('records consent with granted status', async () => {
      await handleConsentGranted(baseDeps);

      expect(mockConsentService.recordConsent).toHaveBeenCalledWith(
        baseDeps.leadId,
        baseDeps.clinicId,
        'granted',
        'sms',
        baseDeps.conversationId,
      );
    });

    it('returns the acknowledgement response', async () => {
      const result = await handleConsentGranted(baseDeps);
      expect(result).toBe(CONSENT_ACKNOWLEDGED_RESPONSE);
    });
  });

  describe('handleConsentDeclined', () => {
    it('records consent with declined status', async () => {
      await handleConsentDeclined(baseDeps);

      expect(mockConsentService.recordConsent).toHaveBeenCalledWith(
        baseDeps.leadId,
        baseDeps.clinicId,
        'declined',
        'sms',
        baseDeps.conversationId,
      );
    });

    it('returns the declined response', async () => {
      const result = await handleConsentDeclined(baseDeps);
      expect(result).toBe(CONSENT_DECLINED_RESPONSE);
    });
  });
});
