/**
 * REST endpoints for GDPR data subject rights.
 *
 * Provides erasure (Art. 17), consent history (Art. 7(1) proof),
 * consent withdrawal, and erasure status checking.
 *
 * Ref: ICO Right to Erasure guidance
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
 * Ref: ICO Consent Guidance — Art. 7(1) demonstrability
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/
 *
 * TODO: Apply staff-only auth guard when auth module is extended.
 */
import { Controller, Delete, Get, Param, Post, HttpCode } from '@nestjs/common';
import { ConsentService } from './consent/consent.service';
import { ErasureService } from './erasure/erasure.service';

@Controller('gdpr')
export class GdprController {
  /**
   * Constructs a new GdprController instance.
   *
   * @param consentService ConsentService instance for recording consent events.
   * @param erasureService ErasureService instance for exercising right to erasure.
   */
  constructor(
    private readonly consentService: ConsentService,
    private readonly erasureService: ErasureService,
  ) {}

  /** Exercise right to erasure — UK GDPR Art. 17. */
  @Delete('erasure/:leadId')
  @HttpCode(200)
  async erasePatientData(@Param('leadId') leadId: string) {
    return this.erasureService.erasePatientData(leadId, 'staff');
  }

  /** View consent history — proof of lawful processing per Art. 7(1). */
  @Get('consent/:leadId')
  async getConsentHistory(@Param('leadId') leadId: string) {
    return this.consentService.getConsentHistory(leadId);
  }

  /** Withdraw consent manually — triggers a 'withdrawn' consent record. */
  @Post('consent/:leadId/withdraw')
  @HttpCode(200)
  async withdrawConsent(@Param('leadId') leadId: string) {
    return this.consentService.withdrawConsent(leadId, 'unknown');
  }

  /** Check erasure status for a lead. */
  @Get('erasure/:leadId/status')
  async getErasureStatus(@Param('leadId') leadId: string) {
    return this.erasureService.getErasureStatus(leadId);
  }
}
