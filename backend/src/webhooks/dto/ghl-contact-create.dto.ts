import { Type } from "class-transformer";
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { IsUkPhone } from "../../common/validation/is-uk-phone.validator";
import { SanitisedString } from "../../common/validation/sanitised-string.decorator";

/** Nested location block — only the id field is consumed downstream. */
export class GhlLocationDto {
  @IsString()
  @MaxLength(100)
  id!: string;
}

/**
 * Strict DTO for the GHL `ContactCreate` event.
 *
 * Only the fields the orchestrator actually reads are listed. The global
 * ValidationPipe runs with `whitelist: true`, so any other key on the
 * payload is silently dropped — the service only ever sees this shape.
 *
 * Phone is intentionally optional and uses the canonical UK validator,
 * because GHL forms occasionally omit the field altogether (e.g. when
 * the lead is collected via a comment-to-contact automation).
 */
export class GhlContactCreateDto {
  @IsIn(["ContactCreate"], { message: "type must be 'ContactCreate'" })
  type!: "ContactCreate";

  @IsOptional()
  @ValidateNested()
  @Type(() => GhlLocationDto)
  location?: GhlLocationDto;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  locationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @IsOptional()
  @SanitisedString({ max: 100 })
  first_name?: string;

  @IsOptional()
  @SanitisedString({ max: 100 })
  last_name?: string;

  @IsOptional()
  @IsUkPhone()
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: "email must be a valid email address" })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @SanitisedString({ max: 1000 })
  issue?: string;

  @IsOptional()
  @SanitisedString({ max: 1000 })
  Issue?: string;
}
