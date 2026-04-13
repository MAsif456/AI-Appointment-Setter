/**
 * Service for recording and querying GDPR consent events.
 *
 * Each consent action (grant, decline, withdraw) creates a new immutable
 * ConsentRecord document.  The most-recent record determines active status.
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ConsentRecordEntry,
  ConsentRecordDocument,
} from '../../database/schemas/consent-record.schema';
import {
  CONSENT_STATEMENT_VERSION,
  CONSENT_STATEMENT_TEXT,
} from '../gdpr.types';

@Injectable()
export class ConsentService {
  /**
   * Constructs a new ConsentService instance.
   *
   * @param consentModel Injected instance of ConsentRecordEntry mongoose model.
   */
  constructor(
    @InjectModel(ConsentRecordEntry.name)
    private readonly consentModel: Model<ConsentRecordDocument>,
  ) {}

  /** Creates a new consent event (granted, declined, or withdrawn). */
  async recordConsent(
    leadId: string,
    clinicId: string,
    status: 'granted' | 'declined' | 'withdrawn',
    channel: string,
    conversationId?: string,
  ): Promise<ConsentRecordDocument> {
    return this.consentModel.create({
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
