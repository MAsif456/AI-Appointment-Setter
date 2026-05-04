/** DTOs for the PATCH /clinics/:id/settings endpoint.
 *
 * All fields are optional for partial updates, but validated when present.
 * Name, address, phone, and service areas must not be empty if provided.
 */

import { Type } from "class-transformer";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  IsNumber,
  Min,
  Max,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { IsUkPhone } from "../../common/validation/is-uk-phone.validator";
import { SanitisedString } from "../../common/validation/sanitised-string.decorator";

const VALID_DURATIONS = [15, 20, 30, 45, 60, 75, 90, 105, 120];

/** Shape of a single day's opening hours inside the request body. */
export class UpdateBusinessHoursDto {
  @IsString()
  day: string;

  @IsBoolean()
  isOpen: boolean;

  @IsOptional()
  @IsString()
  openTime?: string;

  @IsOptional()
  @IsString()
  closeTime?: string;
}

/** Shape of a single service entry inside the request body. */
export class UpdateServiceDto {
  @SanitisedString({ max: 200 })
  name: string;

  @IsNumber()
  @IsOptional()
  durationMinutes?: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsOptional()
  @SanitisedString({ max: 1000 })
  description?: string;
}

/** Shape of a single service area entry inside the request body. */
export class UpdateServiceAreaDto {
  @IsString()
  @Matches(/^[A-Z]{1,4}$/, {
    message:
      "Postcode prefix must be 1–4 uppercase letters (e.g. CF, NP, SA)",
  })
  postcodePrefix: string;

  @IsOptional()
  @SanitisedString({ max: 500 })
  description?: string;
}

/** Request body accepted by PATCH /clinics/:id/settings. */
export class UpdateClinicSettingsDto {
  @IsOptional()
  @SanitisedString({ max: 200, min: 2 })
  name?: string;

  @IsOptional()
  @SanitisedString({ max: 500 })
  address?: string;

  @IsOptional()
  @IsUkPhone()
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "GHL Location ID must be alphanumeric (underscore and hyphen allowed)",
  })
  ghlLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      "GHL Calendar ID must be alphanumeric (underscore and hyphen allowed)",
  })
  ghlCalendarId?: string;

  @IsOptional()
  @IsIn(VALID_DURATIONS, {
    message:
      "Appointment duration must be 15, 20, 30, 45, 60, 75, 90, 105, or 120 minutes",
  })
  defaultAppointmentDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  dataRetentionMonths?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateServiceAreaDto)
  serviceAreas?: UpdateServiceAreaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateServiceDto)
  services?: UpdateServiceDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBusinessHoursDto)
  businessHours?: UpdateBusinessHoursDto[];
}