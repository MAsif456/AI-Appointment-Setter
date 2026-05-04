import { Type } from "class-transformer";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsIn,
  Matches,
  MaxLength,
  ArrayMinSize,
  ValidateNested,
} from "class-validator";
import { IsUkPhone } from "../../common/validation/is-uk-phone.validator";
import { SanitisedString } from "../../common/validation/sanitised-string.decorator";

const VALID_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const VALID_DURATIONS = [15, 20, 30, 45, 60, 75, 90, 105, 120];

export class BusinessHoursDto {
  @IsIn(VALID_DAYS, { message: "Day must be a valid weekday name (lowercase)" })
  day: string;

  @IsBoolean()
  isOpen: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "openTime must be in HH:MM 24-hour format",
  })
  openTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "closeTime must be in HH:MM 24-hour format",
  })
  closeTime?: string;
}

export class ServiceAreaDto {
  @IsString()
  @Matches(/^[A-Z]{1,4}$/, {
    message: "Postcode prefix must be 1–4 uppercase letters (e.g. CF, NP, SA)",
  })
  postcodePrefix: string;

  @IsOptional()
  @SanitisedString({ max: 500 })
  description?: string;
}

export class ServiceDto {
  // Service name is bounded so a malicious caller cannot smuggle a megabyte
  // of text into the clinic record via the services array.
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

export class CreateClinicDto {
  // 2-200 char clinic name; trimmed and Unicode-normalised on parse.
  @SanitisedString({ max: 200, min: 2 })
  name: string;

  @IsString()
  @IsNotEmpty({ message: "GHL Location ID is required" })
  @MaxLength(100)
  // GHL identifiers are opaque tokens — alphanumeric plus `_` and `-`
  // (real GHL Location IDs commonly contain hyphens). Anything outside
  // this set is almost certainly an injection attempt.
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "GHL Location ID must be alphanumeric (underscore and hyphen allowed)",
  })
  ghlLocationId: string;

  @IsString()
  @IsNotEmpty({ message: "GHL Calendar ID is required" })
  @MaxLength(100)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: "GHL Calendar ID must be alphanumeric (underscore and hyphen allowed)",
  })
  ghlCalendarId: string;

  @SanitisedString({ max: 500 })
  address: string;

  // Canonical UK phone validation lives in @IsUkPhone — see
  // common/validation/uk-formats.ts for the single regex source.
  @IsUkPhone()
  phone: string;

  @IsOptional()
  @IsIn(VALID_DURATIONS, {
    message:
      "Appointment duration must be 15, 20, 30, 45, 60, 75, 90, 105, or 120 minutes",
  })
  defaultAppointmentDuration?: number;

  @IsArray()
  // @IsNotEmpty treats `[]` as a present, truthy value — use ArrayMinSize
  // so the AC ("at least one service area is required") is actually
  // enforced for empty arrays.
  @ArrayMinSize(1, { message: "At least one service area is required" })
  @ValidateNested({ each: true })
  @Type(() => ServiceAreaDto)
  serviceAreas: ServiceAreaDto[];

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
