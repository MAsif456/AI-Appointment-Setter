import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  AppointmentsService,
  BookingResult,
} from './appointments.service';
import { SlotsService } from './services/slots.service';
import { FetchSlotsQueryDto } from './dto/fetch-slots.dto';
import { IdempotencyInterceptor } from './idempotency.interceptor';

@Controller('appointments')
export class AppointmentsController {
  private readonly logger = new Logger(AppointmentsController.name);

/**
 * Constructor for AppointmentsController.
 * @param {AppointmentsService} appointmentsService - The appointments service.
 * @param {SlotsService} slotsService - The slots service.
 */
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly slotsService: SlotsService,
  ) {}

  @Get('slots')
  /**
   * Retrieves available appointment slots for a clinic.
   * Fetches real slots from GHL via SlotsService and maps them
   * to the Slot interface used by the formatter and prompt builder.
   * @param {FetchSlotsQueryDto} query - The query parameters for fetching slots.
   * @returns {Promise<Slot[]>} - The available slots.
   */
  async getAvailableSlots(@Query() query: FetchSlotsQueryDto) {
    return this.slotsService.fetchAvailableSlots(
      query.clinicId,
      new Date(query.startDate),
      new Date(query.endDate),
    );
  }

  @Post('book')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(IdempotencyInterceptor)
/**
 * Books an appointment via GHL Calendar and stores it locally.
 * Protected by the IdempotencyInterceptor to prevent duplicate bookings
 * from network retries or double-submissions (IETF Idempotency-Key pattern).
 * @param {CreateAppointmentDto} dto - The booking request details.
 * @returns {Promise<BookingResult>} - The booking result.
 */
  async bookAppointment(
    @Body() dto: CreateAppointmentDto,
  ): Promise<BookingResult> {
    this.logger.log(`Booking request for contact ${dto.contactId}`);
    return this.appointmentsService.bookAppointment(dto);
  }
}
