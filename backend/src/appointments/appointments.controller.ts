import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  AppointmentsService,
  BookingResult,
} from './appointments.service';

@Controller('appointments')
export class AppointmentsController {
  private readonly logger = new Logger(AppointmentsController.name);

/**
 * Constructor for AppointmentsController.
 * @param {AppointmentsService} appointmentsService - The appointments service.
 */
  constructor(
    private readonly appointmentsService: AppointmentsService,
  ) {}

  /**
   * Books an appointment via GHL Calendar and stores it locally.
   * @param {CreateAppointmentDto} dto - The booking request details.
   * @returns {Promise<BookingResult>} - The booking result.
   */
  @Post('book')
  @HttpCode(HttpStatus.OK)
  /**
   * Books an appointment via GHL Calendar and stores it locally.
   * @param {CreateAppointmentDto} dto - The booking request details.
   * @returns {Promise<BookingResult>} - The booking result.
   * @example
   * const dto = {
   *   clinicId: '507f1f77bcf86cd799439011',
   *   contactId: 'ghl_contact_123',
   *   conversationId: '507f1f77bcf86cd799439012',
   *   leadId: '507f1f77bcf86cd799439013',
   *   startTime: '2026-03-17T14:00:00Z',
   *   serviceType: 'Physiotherapy',
   * };
   * const result = await bookAppointment(dto);
   * // result is a Booking result object
   */
  async bookAppointment(
    @Body() dto: CreateAppointmentDto,
  ): Promise<BookingResult> {
    this.logger.log(`Booking request for contact ${dto.contactId}`);
    return this.appointmentsService.bookAppointment(dto);
  }
}
