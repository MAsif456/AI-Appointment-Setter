import { Type } from "class-transformer";
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { SanitisedString } from "../../common/validation/sanitised-string.decorator";
import { GhlLocationDto } from "./ghl-contact-create.dto";

/** Validated `message` block of an InboundMessage payload. */
export class GhlInboundMessageBodyDto {
  @IsOptional()
  @SanitisedString({ max: 5000 })
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  direction?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @SanitisedString({ max: 500 })
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  emailMessageId?: string;
}

/**
 * Strict DTO for the GHL `InboundMessage` event.
 *
 * As with GhlContactCreateDto, only the fields actually consumed by the
 * orchestrator (and a couple of useful diagnostic fields) are listed.
 * The whitelist + forbidNonWhitelisted ValidationPipe drops everything
 * else.
 */
export class GhlInboundMessageDto {
  @IsIn(["InboundMessage"], { message: "type must be 'InboundMessage'" })
  type!: "InboundMessage";

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
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  conversationId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => GhlInboundMessageBodyDto)
  message?: GhlInboundMessageBodyDto;
}
