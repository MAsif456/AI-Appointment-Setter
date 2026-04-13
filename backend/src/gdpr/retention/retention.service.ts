/**
 * Automated data retention cleanup — UK GDPR Article 5(1)(e) storage limitation.
 *
 * Ref: ICO Storage Limitation Principle
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/the-principles/storage-limitation/
 *
 * Runs daily at 02:00 via @nestjs/schedule (already installed, v6.1.1).
 * For each clinic, identifies leads whose data has exceeded the configurable
 * retention period and delegates anonymisation to ErasureService.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lead, LeadDocument } from '../../database/schemas/lead.schema';
import { Clinic, ClinicDocument } from '../../database/schemas/clinic.schema';
import {
  Conversation,
  ConversationDocument,
} from '../../database/schemas/conversation.schema';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { ErasureService } from '../erasure/erasure.service';
import { ANONYMISED_VALUE } from '../gdpr.types';

/** Default retention period when clinic does not specify one. */
const DEFAULT_RETENTION_MONTHS = 12;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

/**
 * Constructor for RetentionService.
 * @param leadModel - The Mongoose model for leads.
 * @param clinicModel - The Mongoose model for clinics.
 * @param conversationModel - The Mongoose model for conversations.
 * @param auditLogModel - The Mongoose model for audit logs.
 * @param erasureService - The service that anonymises patient data based on retention settings.
 */
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
    private readonly erasureService: ErasureService,
  ) {}

  /** Daily 02:00 — low traffic window. */
  @Cron('0 2 * * *')
  /**
   * Runs a daily job to anonymise patient data based on clinic retention settings.
   *
   * Queries the clinics, then for each clinic, queries the leads
   * with updatedAt older than the retention period. Each lead is passed
   * to the erasePatientData method for anonymisation.
   *
   * After anonymisation, a summary audit log is created with the total
   * number of anonymised leads.
   */
  async runRetentionCleanup(): Promise<void> {
    this.logger.log('RETENTION_CLEANUP_START');
    const clinics = await this.clinicModel.find({ isActive: true }).lean();
    let totalAnonymised = 0;

    for (const clinic of clinics) {
      const retentionMonths =
        (clinic as any).dataRetentionMonths ?? DEFAULT_RETENTION_MONTHS;
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - retentionMonths);

      const candidates = await this.leadModel.find({
        clinicId: clinic._id,
        updatedAt: { $lt: cutoff },
        firstName: { $ne: ANONYMISED_VALUE },
      }).lean();

      let clinicCount = 0;
      for (const lead of candidates) {
        // Skip if there's a recent conversation (still active)
        const recentConv = await this.conversationModel.findOne({
          leadId: lead._id,
          lastMessageAt: { $gte: cutoff },
        });
        if (recentConv) continue;

        try {
          await this.erasureService.erasePatientData(
            (lead._id as any).toString(),
            'retention_job',
          );
          clinicCount++;
        } catch (error) {
          this.logger.error(
            `Retention erasure failed — leadId: ${(lead._id as any).toString()}, ` +
            `clinicId: ${(clinic._id as any).toString()}: ${(error as Error).message}`,
          );
        }
      }

      if (clinicCount > 0) {
        this.logger.log(
          `RETENTION_CLEANUP clinicId=${(clinic._id as any).toString()} anonymised=${clinicCount}`,
        );
      }
      totalAnonymised += clinicCount;
    }

    // Summary audit log
    if (totalAnonymised > 0) {
      await this.auditLogModel.create({
        action: 'data.retention_cleanup',
        entityType: 'system',
        severity: 'info',
        changes: { totalAnonymised },
      });
    }

    this.logger.log(`RETENTION_CLEANUP_END total=${totalAnonymised}`);
  }
}
