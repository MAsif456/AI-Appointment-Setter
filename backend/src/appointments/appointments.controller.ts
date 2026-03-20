import { Controller, Post, Body, UseGuards } from '@nestjs/common';
//import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SlotsService } from './services/slots.service';
import { FetchSlotsDto } from './dto/fetch-slots.dto';
import { OfferSlotsResponseDto } from './dto/offer-slots-response.dto';

@Controller('appointments')
//@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Post('fetch-slots')
  async fetchSlots(@Body() dto: FetchSlotsDto): Promise<OfferSlotsResponseDto> {
    return this.slotsService.fetchAndOfferSlots(dto);
  }
}