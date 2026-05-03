import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { IsUkPhone } from "../../common/validation/is-uk-phone.validator";
import { IsUkPostcode } from "../../common/validation/is-uk-postcode.validator";
import { SanitisedString } from "../../common/validation/sanitised-string.decorator";

/**
 * Validated mirror of the LeadInfo interface used by the AI chat
 * pipeline. Strings are size-bounded so a malicious caller cannot
 * smuggle large payloads or NoSQL operator objects through the chat
 * endpoint and into the LLM prompt or persistence layer.
 */
export class LeadInfoDto {
  @SanitisedString({ max: 100 })
  firstName!: string;

  @IsOptional()
  @SanitisedString({ max: 100 })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: "email must be a valid email address" })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsUkPhone()
  phone?: string;

  @IsOptional()
  @SanitisedString({ max: 1000 })
  issue?: string;

  @IsOptional()
  @SanitisedString({ max: 100 })
  leadSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactId?: string;

  @IsOptional()
  @IsUkPostcode()
  validatedPostcode?: string;

  @IsOptional()
  @IsBoolean()
  isReturningPatient?: boolean;

  @IsOptional()
  @IsBoolean()
  detailsJustUpdated?: boolean;
}

/** Per-clinic cancellation policy, validated when present. */
export class CancellationPolicyDto {
  @IsBoolean()
  feeEnabled!: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  feeAmount?: number;

  @IsOptional()
  @SanitisedString({ max: 500 })
  feeDescription?: string;

  @IsInt()
  @Min(0)
  noticeHours!: number;

  @IsOptional()
  @SanitisedString({ max: 1000 })
  cancellationMessage?: string;
}

/**
 * Validated mirror of the ClinicConfig interface. All free-text fields
 * are bounded; `tone` is constrained to the two values the prompt
 * builder knows how to handle.
 */
export class ClinicConfigDto {
  @IsString()
  @MaxLength(100)
  clinicId!: string;

  @SanitisedString({ max: 200 })
  name!: string;

  @IsIn(["Friendly", "Professional"], {
    message: "tone must be one of: Friendly, Professional",
  })
  tone!: "Friendly" | "Professional";

  @IsOptional()
  @SanitisedString({ max: 2000 })
  greetingTemplate?: string;

  @IsOptional()
  @SanitisedString({ max: 2000 })
  returningPatientGreetingTemplate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  patientDataExpiryDays?: number;

  @IsOptional()
  @IsString({ each: true })
  serviceAreas?: string[];

  @IsOptional()
  @SanitisedString({ max: 2000 })
  customInstructions?: string;

  @IsString()
  @MaxLength(100)
  ghlLocationId!: string;

  @IsBoolean()
  isActive!: boolean;

  @IsOptional()
  @IsString()
  ghlApiKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  dataRetentionMonths?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CancellationPolicyDto)
  cancellationPolicy?: CancellationPolicyDto;
}

/** Single entry in the conversation history sent by the client. */
export class ChatMessageDto {
  @IsIn(["assistant", "user"], {
    message: "role must be one of: assistant, user",
  })
  role!: "assistant" | "user";

  @SanitisedString({ max: 5000 })
  content!: string;
}
