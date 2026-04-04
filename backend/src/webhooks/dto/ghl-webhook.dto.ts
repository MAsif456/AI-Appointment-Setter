import { IsString, IsNotEmpty, IsOptional, ValidateNested, Allow } from "class-validator";
import { Type } from "class-transformer";

export class GhlLocationDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

/**
 * Validated DTO for incoming GHL webhook payloads.
 *
 * The global ValidationPipe uses `whitelist: true`, which strips properties
 * that lack class-validator decorators.  GHL payloads contain many dynamic
 * fields (contact details, message data, etc.) that the orchestrator needs,
 * so we mark known fields with @Allow() / @IsOptional() to prevent stripping.
 */
export class GhlWebhookValidatedDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @ValidateNested()
  @Type(() => GhlLocationDto)
  location: GhlLocationDto;

  /* GHL contact / event fields (passed through to orchestrator) */
  @IsOptional() @Allow() id?: string;
  @IsOptional() @Allow() first_name?: string;
  @IsOptional() @Allow() last_name?: string;
  @IsOptional() @Allow() phone?: string;
  @IsOptional() @Allow() email?: string;
  @IsOptional() @Allow() issue?: string;
  @IsOptional() @Allow() conversationId?: string;
  @IsOptional() @Allow() message?: unknown;

  [key: string]: unknown;
}

export interface GhlLocation {
  id?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface GhlWebhookPayload {
  type?: string;
  location?: GhlLocation;
  [key: string]: unknown;
}

export interface GhlContactCreatePayload extends GhlWebhookPayload {
  type: "ContactCreate";
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  issue?: string;
}

export interface GhlMessage {
  body?: string;
  type?: string;
  direction?: string;
  status?: string;
  subject?: string;
  contentType?: string;
  emailMessageId?: string;
}

export interface GhlInboundMessagePayload extends GhlWebhookPayload {
  type: "InboundMessage";
  id?: string;
  conversationId?: string;
  message?: GhlMessage;
}
