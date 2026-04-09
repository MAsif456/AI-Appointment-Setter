import { IsArray, IsOptional, IsString } from "class-validator";

export class InboundWebhookDto {
  @IsString()
  type: string;

  @IsString()
  locationId: string;

  @IsString()
  contactId: string;

  @IsString()
  conversationId: string;

  @IsString()
  messageId: string;

  @IsString()
  body: string;

  @IsString()
  direction: string;

  @IsString()
  messageType: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  dateAdded?: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];
}
