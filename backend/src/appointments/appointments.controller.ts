import { Controller, Get, Query, UseGuards } from '@nestjs/common';
//import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SlotsService } from './services/slots.service';
import { FetchSlotsQueryDto } from './dto/fetch-slots.dto';

@Controller('appointments')
//@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Get('slots')
  async getAvailableSlots(@Query() query: FetchSlotsQueryDto) {
    return this.slotsService.fetchAvailableSlots(
      query.clinicId,
      new Date(query.startDate),
      new Date(query.endDate),
    );
  }
}