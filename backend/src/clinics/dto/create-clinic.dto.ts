import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

const VALID_DAYS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
] as const;

const VALID_DURATIONS = [15, 20, 30, 45, 60, 75, 90, 105, 120];

export class BusinessHoursDto {
  @IsIn(VALID_DAYS, { message: 'Day must be a valid weekday name (lowercase)' })
  day: string;

  @IsBoolean()
  isOpen: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'openTime must be in HH:MM 24-hour format' })
  openTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'closeTime must be in HH:MM 24-hour format' })
  closeTime?: string;
}

export class ServiceAreaDto {
  @IsString()
  @Matches(/^[A-Z]{1,4}$/, { message: 'Postcode prefix must be 1–4 uppercase letters (e.g. CF, NP, SA)' })
  postcodePrefix: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ServiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsOptional()
  durationMinutes?: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateClinicDto {
  @IsString()
  @IsNotEmpty({ message: 'Clinic name is required' })
  @MinLength(2, { message: 'Clinic name must be at least 2 characters' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'GHL Location ID is required' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'GHL Location ID must be alphanumeric' })
  ghlLocationId: string;

  @IsString()
  @IsNotEmpty({ message: 'GHL Calendar ID is required' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'GHL Calendar ID must be alphanumeric' })
  ghlCalendarId: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsOptional()
  @Matches(/^(\+44\s?|0)\d[\d\s]{8,12}$/, { message: 'Enter a valid UK phone number (e.g. 029 2034 5678 or +44 29 2034 5678)' })
  phone?: string;

  @IsOptional()
  @IsIn(VALID_DURATIONS, { message: 'Appointment duration must be 15, 20, 30, 45, 60, 75, 90, 105, or 120 minutes' })
  defaultAppointmentDuration?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAreaDto)
  @IsOptional()
  serviceAreas?: ServiceAreaDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceDto)
  @IsOptional()
  services?: ServiceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessHoursDto)
  @IsOptional()
  businessHours?: BusinessHoursDto[];
}
