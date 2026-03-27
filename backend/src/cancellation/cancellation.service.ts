/**
 * Core cancellation business logic.
 *
 * Handles policy evaluation, GHL appointment cancellation, audit trail
 * creation, contact tag updates, and clinic notification.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Conversation, ConversationDocument } from '../database/schemas/conversation.schema';
import { Appointment, AppointmentDocument } from '../database/schemas/appointment.schema';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { GhlApiService } from '../ghl/ghl-api.service';
import { formatDateBritish } from '../appointments/confirmation-message.builder';
import { PolicyResult, CancellationResult } from './cancellation.types';

@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);

  constructor(
    @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
    private readonly ghlApiService: GhlApiService,
  ) {}

  /**
   * Loads the confirmed appointment linked to a conversation.
   * @returns The appointment document, or null if none exists or it is not confirmed.
   */
  async checkAppointmentExists(conversationId: Types.ObjectId): Promise<AppointmentDocument | null> {
    const conversation = await this.conversationModel.findById(conversationId).exec();
    if (!conversation?.appointmentId) return null;

    const appointment = await this.appointmentModel.findById(conversation.appointmentId).exec();
    if (!appointment || appointment.status !== 'confirmed') return null;

    return appointment;
  }

  /**
   * Builds the confirmation prompt shown to the lead before cancelling.
   * Uses British English date formatting from the existing confirmation-message builder.
   */
  buildConfirmationPrompt(appointment: AppointmentDocument): string {
    const { date, time } = formatDateBritish(appointment.appointmentDate.toISOString());
    return `Just to confirm, you'd like to cancel your appointment on ${date} at ${time}. Is that correct?`;
  }

  /**
   * Evaluates the clinic's cancellation policy against the appointment time.
   * @returns Policy result indicating whether a fee warning is needed.
   */
  async evaluatePolicy(appointment: AppointmentDocument, clinicId: Types.ObjectId): Promise<PolicyResult> {
    const clinic = await this.clinicModel.findById(clinicId).exec();
    const policy = clinic?.cancellationPolicy;

    // Default: no fee, 24-hour notice
    const noticeHours = policy?.noticeHours ?? 24;
    const feeEnabled = policy?.feeEnabled ?? false;
    const feeDescription = policy?.feeDescription ?? '';

    const hoursUntilAppointment = (appointment.appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);
    const withinNotice = hoursUntilAppointment < noticeHours;

    let warningMessage: string | undefined;
    if (withinNotice && feeEnabled) {
      // Template-first: use clinic's custom message if configured
      warningMessage = policy?.cancellationMessage
        ? this.applyTemplate(policy.cancellationMessage, feeDescription, noticeHours)
        : `Cancellations within ${noticeHours} hours may incur a fee of ${feeDescription}. Would you like to proceed or reschedule instead?`;
    }

    return { withinNotice, feeEnabled, feeDescription, warningMessage };
  }

  /**
   * Executes the full cancellation: GHL API call, local DB updates, tags, and audit trail.
   * Returns null-safe result — GHL failures are logged but don't crash the flow.
   */
  async executeCancellation(
    conversationId: Types.ObjectId,
    appointmentId: Types.ObjectId,
    contactId: string,
    reason?: string,
  ): Promise<CancellationResult> {
    const appointment = await this.appointmentModel.findById(appointmentId).exec();
    if (!appointment) {
      return { success: false, message: 'Appointment not found.' };
    }

    // Cancel in GHL (null-on-failure — log but continue)
    const ghlResult = await this.ghlApiService.cancelAppointment(appointment.ghlAppointmentId);
    if (!ghlResult) {
      this.logger.warn(`GHL cancellation returned null for appointment ${appointmentId}. Proceeding with local update.`);
    }

    // Update appointment status locally
    const { date, time } = formatDateBritish(appointment.appointmentDate.toISOString());
    await this.appointmentModel.findByIdAndUpdate(appointmentId, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason,
    });

    // Soft-delete: move appointment data to cancelledAppointments audit array
    await this.conversationModel.findByIdAndUpdate(conversationId, {
      phase: 'cancelled',
      appointmentId: null,
      cancellationReason: reason,
      $push: {
        cancelledAppointments: {
          appointmentId,
          ghlAppointmentId: appointment.ghlAppointmentId,
          appointmentDate: appointment.appointmentDate,
          displayText: `${date} at ${time}`,
          cancelledAt: new Date(),
          cancelledBy: 'lead',
          cancellationReason: reason,
        },
      },
    });

    // Update GHL contact tags (fire-and-forget, failures are logged internally)
    await this.ghlApiService.addContactTag(contactId, 'cancelled');
    await this.ghlApiService.removeContactTag(contactId, 'appointment-booked');

    this.logger.log(`Appointment ${appointmentId} cancelled for contact ${contactId}`);

    return {
      success: true,
      message: "Your appointment has been cancelled. Feel free to book again anytime!",
    };
  }

  /** Substitutes {{placeholder}} variables in a cancellation message template. */
  private applyTemplate(template: string, feeDescription: string, noticeHours: number): string {
    return template
      .replace(/\{\{feeDescription\}\}/g, feeDescription)
      .replace(/\{\{noticeHours\}\}/g, String(noticeHours));
  }
}
