import { plainToInstance } from "class-transformer";
import { validate, ValidationError } from "class-validator";
import { GhlContactCreateDto } from "./ghl-contact-create.dto";
import { GhlInboundMessageDto } from "./ghl-inbound-message.dto";

/** Result of running the discriminated GHL payload validator. */
export type GhlValidationResult =
  | { valid: true; type: "ContactCreate"; dto: GhlContactCreateDto }
  | { valid: true; type: "InboundMessage"; dto: GhlInboundMessageDto }
  | { valid: true; type: "Unknown"; dto: null }
  | { valid: false; type: string; errors: ValidationError[] };

/**
 * Picks the strict DTO matching the payload's `type` discriminator and
 * runs class-validator over it. Replaces the legacy "@Allow() everything"
 * pattern in GhlWebhookValidatedDto with explicit, per-event validation.
 *
 * Unknown event types pass through with `valid: true, type: "Unknown",
 * dto: null` — the existing service contract is to log and ignore those
 * (rather than fail) so an unrecognised event from a future GHL release
 * does not block the request and trigger retry storms.
 *
 * @param payload - Raw object from the parsed webhook body.
 * @returns Discriminated result the caller can switch on.
 */
export async function validateGhlPayload(
  payload: Record<string, unknown>,
): Promise<GhlValidationResult> {
  const type = typeof payload.type === "string" ? payload.type : "";

  if (type === "ContactCreate") {
    const dto = plainToInstance(GhlContactCreateDto, payload);
    const errors = await validate(dto);
    return errors.length === 0
      ? { valid: true, type: "ContactCreate", dto }
      : { valid: false, type, errors };
  }

  if (type === "InboundMessage") {
    const dto = plainToInstance(GhlInboundMessageDto, payload);
    const errors = await validate(dto);
    return errors.length === 0
      ? { valid: true, type: "InboundMessage", dto }
      : { valid: false, type, errors };
  }

  return { valid: true, type: "Unknown", dto: null };
}
