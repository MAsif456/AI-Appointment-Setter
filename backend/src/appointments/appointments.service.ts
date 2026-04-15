import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  Appointment,
  AppointmentDocument,
} from "../database/schemas/appointment.schema";
import { Clinic, ClinicDocument } from "../database/schemas/clinic.schema";
import {
  Conversation,
  ConversationDocument,
} from "../database/schemas/conversation.schema";
import { Lead, LeadDocument } from "../database/schemas/lead.schema";
import { GhlApiService } from "../ghl/ghl-api.service";
import { PatientHistoryService } from "../patient-history/patient-history.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import {
  buildConfirmationMessage,
  formatDateBritish,
} from "./confirmation-message.builder";

export interface BookingResult {
  success: boolean;
  appointmentId?: string;
  ghlAppointmentId?: string;
  confirmationMessage?: string;
  error?: string;
  slotTaken?: boolean;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  /**
   * Constructor for AppointmentsService.
   * @param {Model<AppointmentDocument>} appointmentModel - Mongoose model for appointments.
   * @param {Model<ClinicDocument>} clinicModel - Mongoose model for clinics.
   * @param {Model<ConversationDocument>} conversationModel - Mongoose model for conversations.
   * @param {Model<LeadDocument>} leadModel - Mongoose model for leads (used for patient history).
   * @param {GhlApiService} ghlApiService - Service that interfaces with GHL's API.
   * @param {PatientHistoryService} patientHistoryService - Persists returning patient history after booking.
   */
  constructor(
    @InjectModel(Appointment.name)
    private readonly appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Clinic.name)
    private readonly clinicModel: Model<ClinicDocument>,
    @InjectModel(Conversation.name)
    private readonly conversationModel: Model<ConversationDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
    private readonly ghlApiService: GhlApiService,
    private readonly patientHistoryService: PatientHistoryService,
  ) {}

  /**
   * Books an appointment: creates it in GHL, stores locally, updates conversation.
   * @param {CreateAppointmentDto} dto - The appointment booking details.
   * @returns {Promise<BookingResult>} - The result of the booking attempt.
   */
  async bookAppointment(dto: CreateAppointmentDto): Promise<BookingResult> {
    if (!Types.ObjectId.isValid(dto.clinicId)) {
      return { success: false, error: "Invalid clinic ID" };
    }

    const clinic = await this.clinicModel.findById(dto.clinicId).exec();
    if (!clinic) {
      return { success: false, error: "Clinic not found" };
    }

    const duration = this.resolveDuration(clinic, dto.serviceType);
    const endTime = this.calculateEndTime(dto.startTime, duration);

    let ghlResponse: any;
    try {
      ghlResponse = await this.ghlApiService.createAppointment(
        clinic.ghlCalendarId,
        clinic.ghlLocationId,
        dto.contactId,
        dto.startTime,
        endTime,
      );
    } catch (error) {
      return this.handleGhlError(error, dto.contactId);
    }

    const appointment = await this.storeAppointment(
      dto,
      ghlResponse.id,
      duration,
    );

    const { date, time } = formatDateBritish(dto.startTime);

    await this.conversationModel.findByIdAndUpdate(dto.conversationId, {
      phase: "booked",
      appointmentId: appointment._id,
      ghlContactId: dto.contactId,
      $set: {
        'context.ghlAppointmentId': ghlResponse.id,
        'context.appointmentDate': date,
        'context.appointmentTime': time,
        'context.appointmentStartTime': dto.startTime,
      },
    });

    // Persist patient history so this lead can be recognised as returning in future conversations.
    // Load the lead to get phone, email, and name — these are the lookup keys.
    const conversation = await this.conversationModel
      .findById(dto.conversationId)
      .exec();
    const lead = await this.leadModel.findById(dto.leadId).lean().exec();
    if (lead) {
      await this.patientHistoryService.persistHistory(
        dto.clinicId,
        lead.phone,
        lead.email,
        lead.firstName,
        lead.lastName,
        conversation?.context?.get("validatedPostcode"),
        new Types.ObjectId(dto.conversationId),
      );
    }

    const confirmationMessage = buildConfirmationMessage({
      clinicName: clinic.name,
      clinicAddress: clinic.address,
      appointmentDate: date,
      appointmentTime: time,
      itemsToBring: clinic.itemsToBring,
    });

    this.logger.log(
      `Appointment booked: ${appointment._id} for contact ${dto.contactId}`,
    );

    return {
      success: true,
      appointmentId: appointment._id.toString(),
      ghlAppointmentId: ghlResponse.id,
      confirmationMessage,
    };
  }

  /**
   * Resolve the appointment duration for a given clinic and service type.
   * If no service type is provided, use the clinic's default appointment duration.
   * If the service type is found in the clinic's services, use the service's duration.
   * If the service type is not found, use the clinic's default appointment duration.
   * @returns The appointment duration in minutes.
   */
  private resolveDuration(
    clinic: ClinicDocument,
    serviceType?: string,
  ): number {
    if (!serviceType) return clinic.defaultAppointmentDuration;
    const service = clinic.services?.find((s) => s.name === serviceType);
    return service?.durationMinutes ?? clinic.defaultAppointmentDuration;
  }

  /**
   * Calculates the end time of an appointment given its start time and duration.
   * @param {string} startTime - The start time of the appointment in ISO 8601 format.
   * @param {number} minutes - The duration of the appointment in minutes.
   * @returns {string} - The end time of the appointment in ISO 8601 format.
   */
  private calculateEndTime(startTime: string, minutes: number): string {
    const end = new Date(startTime);
    end.setMinutes(end.getMinutes() + minutes);
    return end.toISOString();
  }

  /**
   * Handles errors from GHL's API when creating an appointment.
   * If the error is a 409 or 422, it means the slot is no longer available.
   * In this case, the function logs a warning and returns a booking result with an error message and a flag indicating that the slot was taken.
   * Otherwise, the function logs an error and returns a booking result with an error message.
   * @param {any} error - The error object from GHL's API.
   * @param {string} contactId - The ID of the contact for whom the appointment was being booked.
   * @returns {BookingResult} - The result of the booking attempt.
   */
  private handleGhlError(error: any, contactId: string): BookingResult {
    const status = error?.response?.status;
    const responseMessage: string = error?.response?.data?.message ?? '';
    const isSlotUnavailable =
      status === 409 ||
      status === 422 ||
      (status === 400 && responseMessage.toLowerCase().includes('no longer available'));
    if (isSlotUnavailable) {
      this.logger.warn(`Slot no longer available for contact ${contactId}`);
      return {
        success: false,
        error: "Slot no longer available",
        slotTaken: true,
      };
    }
    const responseData = error?.response?.data;
    this.logger.error(
      `GHL appointment creation failed: ${error.message}` +
      (responseData ? ` — GHL response: ${JSON.stringify(responseData)}` : ''),
    );
    return { success: false, error: "Failed to create appointment" };
  }

  /**
   * Stores an appointment in the database.
   * @param {CreateAppointmentDto} dto - The appointment booking details.
   * @param {string} ghlAppointmentId - The ID of the appointment created in GHL.
   * @param {number} duration - The duration of the appointment in minutes.
   * @returns {Promise<AppointmentDocument>} - The stored appointment document.
   */
  private async storeAppointment(
    dto: CreateAppointmentDto,
    ghlAppointmentId: string,
    duration: number,
  ): Promise<AppointmentDocument> {
    const start = new Date(dto.startTime);
    // Extract HH:MM in UK local time (handles BST/GMT automatically)
    const appointmentTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(start);

    return this.appointmentModel.create({
      clinicId: new Types.ObjectId(dto.clinicId),
      leadId: new Types.ObjectId(dto.leadId),
      conversationId: new Types.ObjectId(dto.conversationId),
      ghlAppointmentId,
      appointmentDate: start,
      appointmentTime,
      durationMinutes: duration,
      serviceType: dto.serviceType,
      status: "confirmed",
    });
  }
}
