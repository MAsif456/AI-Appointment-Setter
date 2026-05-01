import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/**
 * Set of GHL `messageType` values the orchestrator knows how to handle.
 * Anything outside this set will be rejected at the DTO boundary so
 * unexpected channels do not slip through to the service layer.
 *
 * Source of truth: orchestrator/orchestrator.prompts.ts
 * (mapMessageTypeToChannel).
 */
const VALID_MESSAGE_TYPES = [
  "SMS",
  "WhatsApp",
  "FB",
  "IG",
  "Email",
  "Live_Chat",
  "Live Chat",
] as const;

const VALID_DIRECTIONS = ["inbound", "outbound"] as const;

/**
 * Validated payload for POST /ghl/webhook/inbound.
 *
 * Length limits are deliberately tight: GHL identifiers are short opaque
 * strings, message bodies are bounded by the SMS/email caps applied
 * upstream by the carrier. The 5000-char ceiling on `body` matches the
 * acceptance criterion for inbound messages and prevents an attacker
 * from smuggling huge payloads into the conversation history.
 */
export class InboundWebhookDto {
  @IsString()
  @IsIn(["InboundMessage"], { message: "type must be 'InboundMessage'" })
  type: string;

  @IsString()
  @MaxLength(100)
  locationId: string;

  @IsString()
  @MaxLength(100)
  contactId: string;

  @IsString()
  @MaxLength(100)
  conversationId: string;

  @IsString()
  @MaxLength(100)
  messageId: string;

  @IsString()
  @MaxLength(5000, { message: "body must not exceed 5000 characters" })
  body: string;

  @IsString()
  @IsIn(VALID_DIRECTIONS, {
    message: "direction must be 'inbound' or 'outbound'",
  })
  direction: string;

  @IsString()
  @IsIn(VALID_MESSAGE_TYPES, {
    message: `messageType must be one of: ${VALID_MESSAGE_TYPES.join(", ")}`,
  })
  messageType: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  dateAdded?: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];
}
