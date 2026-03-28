import { IsString, IsNotEmpty, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class GhlLocationDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class GhlWebhookValidatedDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @ValidateNested()
  @Type(() => GhlLocationDto)
  location: GhlLocationDto;

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
}

export interface GhlInboundMessagePayload extends GhlWebhookPayload {
  type: "InboundMessage";
  id?: string;
  conversationId?: string;
  message?: GhlMessage;
}
