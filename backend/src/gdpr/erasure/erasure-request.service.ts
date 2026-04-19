/**
 * Manages the erasure approval workflow — staff request, admins approve/reject.
 *
 * Implements the principle of least privilege: staff members can initiate
 * erasure requests but cannot execute them. Only admins can approve, which
 * triggers the actual data anonymisation via ErasureService.
 *
 * Ref: OWASP Broken Access Control (A01:2021) — least privilege
 *   https://owasp.org/Top10/A01_2021-Broken_Access_Control/
 * Ref: ICO Right to Erasure — organisational measures
 *   https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-erasure/
 */
import {
  Injectable, Logger, NotFoundException, ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ErasureRequest,
  ErasureRequestDocument,
} from '../../database/schemas/erasure-request.schema';
import { Lead, LeadDocument } from '../../database/schemas/lead.schema';
import { Clinic, ClinicDocument } from '../../database/schemas/clinic.schema';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { ErasureService } from './erasure.service';
import { InboxNotificationService } from '../../notifications/inbox-notification.service';

@Injectable()
export class ErasureRequestService {
  private readonly logger = new Logger(ErasureRequestService.name);

  constructor(
    @InjectModel(ErasureRequest.name)
    private readonly requestModel: Model<ErasureRequestDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    @InjectModel(Clinic.name)
    private readonly clinicModel: Model<ClinicDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    private readonly erasureService: ErasureService,
    private readonly inboxNotificationService: InboxNotificationService,
  ) {}

  /** Staff creates a new erasure request. */
  async createRequest(
    leadId: string,
    requestedBy: string,
    reason: string,
  ): Promise<ErasureRequestDocument> {
    const lead = await this.leadModel.findById(leadId);
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    // Prevent duplicate pending requests
    const existing = await this.requestModel.findOne({
      leadId: new Types.ObjectId(leadId),
      status: 'pending',
    });
    if (existing) {
      throw new ConflictException('An erasure request is already pending for this lead');
    }

    const request = await this.requestModel.create({
      leadId: new Types.ObjectId(leadId),
      clinicId: lead.clinicId,
      status: 'pending',
      requestedBy,
      reason,
    });

    const clinic = await this.clinicModel.findById(lead.clinicId, 'name').lean();

    await this.auditLogModel.create({
      clinicId: lead.clinicId,
      action: 'erasure.requested',
      entityType: 'lead',
      entityId: leadId,
      severity: 'warning',
      metadata: {
        patientName: `${lead.firstName} ${lead.lastName ?? ''}`.trim(),
        patientEmail: lead.email ?? 'unknown',
        clinicName: clinic?.name ?? 'Unknown',
        requestedBy,
        reason,
      },
    });

    const patientName = `${lead.firstName} ${lead.lastName ?? ''}`.trim();
    this.inboxNotificationService
      .createForAdmins(
        'gdpr_data_deletion',
        'Data deletion request',
        `${requestedBy} has requested erasure of patient data for ${patientName}`,
        request._id.toString(),
        'user',
      )
      .catch((err: Error) =>
        this.logger.warn(`Failed to create GDPR deletion notification: ${err.message}`),
      );

    this.logger.log(
      `ERASURE_REQUESTED leadId=${leadId} by=${requestedBy}`,
    );
    return request;
  }

  /** Admin approves — triggers actual erasure. */
  async approveRequest(
    requestId: string,
    reviewedBy: string,
  ): Promise<ErasureRequestDocument> {
    const request = await this.requestModel.findById(requestId);
    if (!request) throw new NotFoundException('Erasure request not found');
    if (request.status !== 'pending') {
      throw new ConflictException(`Request already ${request.status}`);
    }

    // Capture patient details before erasure anonymises them.
    const lead = await this.leadModel.findById(request.leadId, 'firstName lastName email').lean();
    const clinic = await this.clinicModel.findById(request.clinicId, 'name').lean();

    // Execute the actual erasure
    await this.erasureService.erasePatientData(
      request.leadId.toString(),
      `approved_by:${reviewedBy}`,
    );

    request.status = 'approved';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date();
    await request.save();

    await this.auditLogModel.create({
      clinicId: request.clinicId,
      action: 'erasure.approved',
      entityType: 'lead',
      entityId: request.leadId.toString(),
      severity: 'warning',
      metadata: {
        patientName: `${lead?.firstName ?? 'Unknown'} ${lead?.lastName ?? ''}`.trim(),
        patientEmail: lead?.email ?? 'unknown',
        clinicName: clinic?.name ?? 'Unknown',
        approvedBy: reviewedBy,
        requestId,
        originalRequestedBy: request.requestedBy,
        reason: request.reason,
      },
    });

    this.logger.log(
      `ERASURE_APPROVED requestId=${requestId} by=${reviewedBy}`,
    );
    return request;
  }

  /** Admin rejects — no data is deleted. */
  async rejectRequest(
    requestId: string,
    reviewedBy: string,
    rejectionReason?: string,
  ): Promise<ErasureRequestDocument> {
    const request = await this.requestModel.findById(requestId);
    if (!request) throw new NotFoundException('Erasure request not found');
    if (request.status !== 'pending') {
      throw new ConflictException(`Request already ${request.status}`);
    }

    request.status = 'rejected';
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason;
    await request.save();

    const lead = await this.leadModel.findById(request.leadId, 'firstName lastName email').lean();
    const clinic = await this.clinicModel.findById(request.clinicId, 'name').lean();

    await this.auditLogModel.create({
      clinicId: request.clinicId,
      action: 'erasure.rejected',
      entityType: 'lead',
      entityId: request.leadId.toString(),
      severity: 'info',
      metadata: {
        patientName: `${lead?.firstName ?? 'Unknown'} ${lead?.lastName ?? ''}`.trim(),
        patientEmail: lead?.email ?? 'unknown',
        clinicName: clinic?.name ?? 'Unknown',
        rejectedBy: reviewedBy,
        requestId,
        originalRequestedBy: request.requestedBy,
        rejectionReason: rejectionReason ?? 'none provided',
      },
    });

    this.logger.log(
      `ERASURE_REJECTED requestId=${requestId} by=${reviewedBy}`,
    );
    return request;
  }

  /** Lists erasure requests — optionally filtered by requester email. */
  async listRequests(requestedBy?: string): Promise<ErasureRequestDocument[]> {
    const filter = requestedBy ? { requestedBy } : {};
    return this.requestModel
      .find(filter)
      .populate('leadId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();
  }
}
