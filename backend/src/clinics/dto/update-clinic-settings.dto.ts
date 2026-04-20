/**
 * DTOs for the PATCH /clinics/:id/settings endpoint.
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
  Matches,
  ValidateNested,
} from "class-validator";

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

/** Shape of a single service area entry inside the request body. */
export class UpdateServiceAreaDto {
  @IsString()
  @Matches(/^[A-Z]{1,4}$/, {
    message:
      "Postcode prefix must be 1–4 uppercase letters (e.g. CF, NP, SA)",
  })
  postcodePrefix: string;

  @IsString()
  @IsOptional()
  description?: string;
}

/** Request body accepted by PATCH /clinics/:id/settings. */
export class UpdateClinicSettingsDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Clinic name must not be empty" })
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Address must not be empty" })
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Phone number must not be empty" })
  @Matches(/^(\+44\s?|0)\d[\d\s]{8,12}$/, {
    message:
      "Enter a valid UK phone number (e.g. 029 2034 5678 or +44 29 2034 5678)",
  })
  phone?: string;

  @IsOptional()
  @IsString()
  ghlLocationId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateServiceAreaDto)
  serviceAreas?: UpdateServiceAreaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateBusinessHoursDto)
  businessHours?: UpdateBusinessHoursDto[];
}
