/**
 * Service for recording and querying GDPR consent events.
 *
 * Each consent action (grant, decline, withdraw) creates a new immutable
 * ConsentRecord document.  The most-recent record determines active status.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConsentRecordEntry,
  ConsentRecordDocument,
} from '../../database/schemas/consent-record.schema';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import {
  CONSENT_STATEMENT_VERSION,
  CONSENT_STATEMENT_TEXT,
} from '../gdpr.types';

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @InjectModel(ConsentRecordEntry.name)
    private readonly consentModel: Model<ConsentRecordDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  /** Creates a new consent event (granted, declined, or withdrawn). */
  async recordConsent(
    leadId: string,
    clinicId: string,
    status: 'granted' | 'declined' | 'withdrawn',
    channel: string,
    conversationId?: string,
  ): Promise<ConsentRecordDocument> {
    const record = await this.consentModel.create({
      leadId: new Types.ObjectId(leadId),
      clinicId: new Types.ObjectId(clinicId),
      ...(conversationId
        ? { conversationId: new Types.ObjectId(conversationId) }
        : {}),
      status,
      consentStatementVersion: CONSENT_STATEMENT_VERSION,
      consentStatementText: CONSENT_STATEMENT_TEXT,
      channel,
    });

    // Audit trail — ICO Art. 7(1) requires controllers to demonstrate consent.
    await this.auditLogModel.create({
      clinicId: new Types.ObjectId(clinicId),
      action: `consent.${status}`,
      entityType: 'lead',
      entityId: leadId,
      severity: status === 'withdrawn' ? 'warning' : 'info',
      metadata: { channel, consentStatementVersion: CONSENT_STATEMENT_VERSION },
    });

    this.logger.log(`CONSENT_${status.toUpperCase()} leadId=${leadId} clinicId=${clinicId}`);
    return record;
  }

  /** Returns true only if the most recent consent record is 'granted'. */
  async hasActiveConsent(leadId: string, clinicId: string): Promise<boolean> {
    const latest = await this.consentModel
      .findOne({
        leadId: new Types.ObjectId(leadId),
        clinicId: new Types.ObjectId(clinicId),
      })
      .sort({ createdAt: -1 })
      .lean();
    return latest?.status === 'granted';
  }

  /** Returns all consent records for a lead, most recent first. */
  async getConsentHistory(leadId: string): Promise<ConsentRecordDocument[]> {
    return this.consentModel
      .find({ leadId: new Types.ObjectId(leadId) })
      .sort({ createdAt: -1 });
  }

  /** Creates a 'withdrawn' consent record (e.g. via admin action). */
  async withdrawConsent(
    leadId: string,
    clinicId: string,
    conversationId?: string,
  ): Promise<ConsentRecordDocument> {
    return this.recordConsent(
      leadId,
      clinicId,
      'withdrawn',
      'website',
      conversationId,
    );
  }
}
