import { IsNotEmpty, IsOptional, IsString, IsDateString, IsBoolean } from 'class-validator';

export class FetchSlotsDto {
  @IsNotEmpty()
  @IsString()
  clinicId: string;

  @IsNotEmpty()
  @IsString()
  leadId: string;

  @IsOptional()
  @IsDateString()
  preferredDate?: string; // ISO date string

  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

  @IsOptional()
  @IsString()
  serviceType?: string;
}