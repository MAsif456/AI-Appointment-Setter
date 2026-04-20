import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SendMessageDto {
  @IsEnum(["SMS", "WhatsApp", "FB", "IG", "Email", "Live_Chat", "Custom"])
  type: string;

  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  /** MongoDB clinic ID — used to look up the per-clinic GHL API key. */
  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  html?: string;

  /** GHL conversation ID - threads messages in the same email conversation. */
  @IsOptional()
  @IsString()
  conversationId?: string;

  /** Email Message-ID from the inbound email — used to set In-Reply-To for threading. */
  @IsOptional()
  @IsString()
  emailMessageId?: string;

  /** GHL Location ID — required by GHL API to identify the sub-account. */
  @IsOptional()
  @IsString()
  locationId?: string;
}
