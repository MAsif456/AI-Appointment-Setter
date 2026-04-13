/**
 * Cross-collection anonymisation service for UK GDPR right to erasure (Article 17).
 *
 * Ref: ICO Right to Erasure
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
 *
 * Uses ordered sequential writes with a compensating journal (ErasureRecord)
 * because MongoDB Atlas M0 does not support multi-document transactions.
 * The ErasureRecord tracks per-collection progress, enabling idempotent resume
 * from partial failures — a saga pattern variant.
 *
 * Anonymisation (not pseudonymisation) is used because after erasure AppointHealth
 * has no legitimate purpose to re-identify patients. Per ICO/Recital 26,
 * anonymised data falls outside GDPR scope entirely.
 * Ref: ICO What is Personal Data (anonymisation vs pseudonymisation)
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/personal-information-what-is-it/what-is-personal-data/what-is-personal-data-about/
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lead, LeadDocument } from '../../database/schemas/lead.schema';
import { Message, MessageDocument } from '../../database/schemas/message.schema';
import {
  Conversation,
  ConversationDocument,
} from '../../database/schemas/conversation.schema';
import {
  Appointment,
  AppointmentDocument,
} from '../../database/schemas/appointment.schema';
import {
  PatientHistory,
  PatientHistoryDocument,
} from '../../database/schemas/patient-history.schema';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import {
  ErasureRecord,
  ErasureRecordDocument,
} from '../../database/schemas/erasure-record.schema';
import { ANONYMISED_VALUE } from '../gdpr.types';

@Injectable()
export class ErasureService {
  private readonly logger = new Logger(ErasureService.name);

/**
 * Constructor for ErasureService.
 * @param leadModel - The Mongoose model for leads.
 * @param messageModel - The Mongoose model for messages.
 * @param conversationModel - The Mongoose model for conversations.
 * @param appointmentModel - The Mongoose model for appointments.
 * @param patientHistoryModel - The Mongoose model for patient history.
 * @param auditLogModel - The Mongoose model for audit logs.
 * @param erasureModel - The Mongoose model for erase records.
 */
  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(PatientHistory.name) private readonly patientHistoryModel: Model<PatientHistoryDocument>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(ErasureRecord.name) private readonly erasureModel: Model<ErasureRecordDocument>,
  ) {}

/**
 * Anonymises all patient data associated with a given lead.
 *
 * @param leadId - The ID of the lead to erase.
 * @param requestedBy - The staff member or system that initiated this erase.
 * @returns The created ErasureRecord document.
 *
 * @throws NotFoundException if the lead does not exist.
 */
  async erasePatientData(
    leadId: string,
    requestedBy: string,
  ): Promise<ErasureRecordDocument> {
    const lead = await this.leadModel.findById(leadId);
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    // Idempotency: return existing completed record
    const existing = await this.erasureModel.findOne({
      originalLeadId: leadId,
      status: 'completed',
    });
    if (existing) return existing;

    const clinicId = lead.clinicId;
    const collectionsProcessed: Record<string, number> = {};

    // Create or resume the erasure journal
    let record = await this.erasureModel.findOne({
      originalLeadId: leadId,
      status: { $in: ['in_progress', 'partial_failure'] },
    });
    if (!record) {
      record = await this.erasureModel.create({
        originalLeadId: leadId,
        clinicId,
        status: 'in_progress',
        requestedBy,
        collectionsProcessed: {},
      });
    }

    const leadObjectId = new Types.ObjectId(leadId);

    try {
      // Step 1: PatientHistory — first to prevent returning-patient detection mid-erasure
      const phResult = await this.patientHistoryModel.updateMany(
        { clinicId, phone: { $ne: ANONYMISED_VALUE } },
        {
          $set: {
            phone: ANONYMISED_VALUE,
            email: ANONYMISED_VALUE,
            firstName: ANONYMISED_VALUE,
            lastName: ANONYMISED_VALUE,
            validatedPostcode: ANONYMISED_VALUE,
            phoneHash: null,
          },
        },
      );
      collectionsProcessed.patientHistory = phResult.modifiedCount;

      // Step 2: Appointments
      const apptResult = await this.appointmentModel.updateMany(
        { leadId: leadObjectId },
        { $set: { notes: ANONYMISED_VALUE, cancellationReason: ANONYMISED_VALUE } },
      );
      collectionsProcessed.appointments = apptResult.modifiedCount;

      // Step 3: Messages
      const conversations = await this.conversationModel.find(
        { leadId: leadObjectId },
        { _id: 1 },
      );
      const convIds = conversations.map((c) => c._id);
      const msgResult = await this.messageModel.updateMany(
        { conversationId: { $in: convIds } },
        { $set: { content: ANONYMISED_VALUE } },
      );
      collectionsProcessed.messages = msgResult.modifiedCount;

      // Step 4: Conversations — flag as anonymised
      const convResult = await this.conversationModel.updateMany(
        { leadId: leadObjectId },
        { $set: { isAnonymised: true } },
      );
      collectionsProcessed.conversations = convResult.modifiedCount;

      // Step 5: Lead — last, because prior steps reference it
      await this.leadModel.findByIdAndUpdate(leadId, {
        $set: {
          firstName: ANONYMISED_VALUE,
          lastName: ANONYMISED_VALUE,
          phone: ANONYMISED_VALUE,
          email: ANONYMISED_VALUE,
          postcode: ANONYMISED_VALUE,
          issue: ANONYMISED_VALUE,
          ghlContactId: ANONYMISED_VALUE,
          phoneHash: null,
          'consent.optedIn': false,
        },
      });
      collectionsProcessed.lead = 1;

      // Update journal to completed
      record.collectionsProcessed = collectionsProcessed;
      record.status = 'completed';
      await this.erasureModel.findByIdAndUpdate(record._id, {
        $set: { collectionsProcessed, status: 'completed' },
      });

      // Audit log (ConsentRecords are intentionally NOT anonymised — retained
      // as proof of lawful processing per ICO guidance, Recital 42
      // Ref: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/)
      await this.auditLogModel.create({
        clinicId,
        action: 'data.erased',
        entityType: 'lead',
        entityId: leadId,
        changes: collectionsProcessed,
        severity: 'warning',
        metadata: { requestedBy },
      });

      this.logger.log(
        `ERASURE_COMPLETED leadId=${leadId} collections=${JSON.stringify(collectionsProcessed)}`,
      );

      return record;
    } catch (error) {
      // Partial failure — record progress for resumable retry
      await this.erasureModel.findByIdAndUpdate(record._id, {
        $set: {
          collectionsProcessed,
          status: 'partial_failure',
          errorDetails: (error as Error).message,
        },
      });
      this.logger.error(
        `ERASURE_PARTIAL_FAILURE leadId=${leadId} error=${(error as Error).message}`,
      );
      throw error;
    }
  }

  /** Returns the most recent erasure record for a lead, or null if none exists. */
  async getErasureStatus(leadId: string): Promise<ErasureRecordDocument | null> {
    return this.erasureModel
      .findOne({ originalLeadId: leadId })
      .sort({ createdAt: -1 })
      .exec();
  }
}
