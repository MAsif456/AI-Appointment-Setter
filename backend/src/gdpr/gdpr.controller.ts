/**
 * REST endpoints for GDPR data subject rights.
 *
 * Provides erasure approval workflow (Art. 17), consent history (Art. 7(1)),
 * consent withdrawal, and erasure status checking.
 *
 * Erasure uses a two-step approval workflow: staff members request deletion,
 * admins approve or reject. This prevents insider threats where a compromised
 * or rogue staff account could mass-delete patient data (least privilege).
 *
 * Ref: ICO Right to Erasure guidance
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
 * Ref: ICO Consent Guidance — Art. 7(1) demonstrability
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/
 * Ref: OWASP Broken Access Control (A01:2021) — least privilege
 *   https://owasp.org/Top10/A01_2021-Broken_Access_Control/
 */
import {
  Controller, Delete, Get, Param, Post, Body,
  HttpCode, UseGuards, UseInterceptors, Req, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ConsentService } from './consent/consent.service';
import { ErasureService } from './erasure/erasure.service';
import { ErasureRequestService } from './erasure/erasure-request.service';
import { GdprAuditInterceptor } from './audit/gdpr-audit.interceptor';
import { AuditDataAccess } from './audit/audit-data-access.decorator';

@Controller('gdpr')
@UseGuards(JwtAuthGuard)
@UseInterceptors(GdprAuditInterceptor)
export class GdprController {
  constructor(
    private readonly consentService: ConsentService,
    private readonly erasureService: ErasureService,
    private readonly erasureRequestService: ErasureRequestService,
  ) {}

  // ── Erasure approval workflow ──────────────────────────────────────

  /** Staff requests patient data deletion. Creates a pending approval. */
  @Post('erasure-requests/:leadId')
  async requestErasure(
    @Param('leadId') leadId: string,
    @Body() body: { reason: string },
    @Req() req: { user?: { email?: string } },
  ) {
    if (!body.reason?.trim()) {
      throw new BadRequestException('A reason is required for erasure requests');
    }
    return this.erasureRequestService.createRequest(
      leadId,
      req.user?.email ?? 'unknown',
      body.reason.trim(),
    );
  }

  /** Admin approves an erasure request — triggers actual data anonymisation. */
  @Post('erasure-requests/:requestId/approve')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  async approveErasure(
    @Param('requestId') requestId: string,
    @Req() req: { user?: { email?: string } },
  ) {
    return this.erasureRequestService.approveRequest(
      requestId,
      req.user?.email ?? 'admin',
    );
  }

  /** Admin rejects an erasure request. */
  @Post('erasure-requests/:requestId/reject')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  async rejectErasure(
    @Param('requestId') requestId: string,
    @Body() body: { reason?: string },
    @Req() req: { user?: { email?: string } },
  ) {
    return this.erasureRequestService.rejectRequest(
      requestId,
      req.user?.email ?? 'admin',
      body.reason,
    );
  }

  /** List all erasure requests (admins see all, staff see their own). */
  @Get('erasure-requests')
  async listErasureRequests(@Req() req: { user?: { email?: string; role?: string } }) {
    if (req.user?.role === 'admin') {
      return this.erasureRequestService.listRequests();
    }
    return this.erasureRequestService.listRequests(req.user?.email);
  }

  // ── Direct erasure (admin-only, bypasses approval) ─────────────────

  /** Exercise right to erasure directly — UK GDPR Art. 17. Admin only. */
  @Delete('erasure/:leadId')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  async erasePatientData(
    @Param('leadId') leadId: string,
    @Req() req: { user?: { email?: string } },
  ) {
    return this.erasureService.erasePatientData(
      leadId,
      req.user?.email ?? 'admin',
    );
  }

  // ── Consent ────────────────────────────────────────────────────────

  /** View consent history — proof of lawful processing per Art. 7(1). */
  @Get('consent/:leadId')
  @AuditDataAccess('consent')
  async getConsentHistory(@Param('leadId') leadId: string) {
    return this.consentService.getConsentHistory(leadId);
  }

  /** Withdraw consent manually. Admin only. */
  @Post('consent/:leadId/withdraw')
  @UseGuards(AdminGuard)
  @HttpCode(200)
  async withdrawConsent(
    @Param('leadId') leadId: string,
  ) {
    const lead = await this.consentService.getLeadClinicId(leadId);
    return this.consentService.withdrawConsent(leadId, lead.clinicId);
  }

  // ── Status ─────────────────────────────────────────────────────────

  /** Check erasure status for a lead. */
  @Get('erasure/:leadId/status')
  @AuditDataAccess('erasure')
  async getErasureStatus(@Param('leadId') leadId: string) {
    return this.erasureService.getErasureStatus(leadId);
  }
}
