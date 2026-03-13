/**
 * Plain TypeScript interfaces describing the shape of GoHighLevel (GHL) webhook payloads.
 *
 * No class-validator decorators are used here because GHL webhook bodies vary significantly
 * in shape depending on the event type. Rejecting unknown fields at the DTO layer would cause
 * GHL to retry indefinitely, so the controller accepts a permissive Record<string, unknown>
 * and the service casts to these interfaces for type-safe field access.
 *
 * Field names reflect GHL's actual standard data format:
 *   - Location ID is nested under location.id (not a root-level field)
 *   - Contact fields at root level use snake_case (first_name, last_name)
 *   - Message content is nested under message.body
 */

/** Nested location object included on all GHL webhook payloads. */
export interface GhlLocation {
  /** The GHL Location ID — used to look up the corresponding clinic. */
  id?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

/**
 * Base shape common to all GHL webhook event payloads.
 * Additional fields may be present and are carried through as unknown keys.
 */
export interface GhlWebhookPayload {
  /**
   * Discriminates between event types (e.g. 'ContactCreate', 'InboundMessage').
   * This field is added as a custom key-value pair in the GHL Automation workflow —
   * it is not part of GHL's standard data.
   */
  type?: string;
  /** Nested location object — use location.id for clinic lookup. */
  location?: GhlLocation;
  /** Allow any additional fields GHL may include in the payload. */
  [key: string]: unknown;
}

/**
 * Shape of a ContactCreate event payload.
 * Sent by GHL when a new contact fills in a form on the platform.
 * Contact fields arrive at root level in snake_case format.
 */
export interface GhlContactCreatePayload extends GhlWebhookPayload {
  type: 'ContactCreate';
  /** The contact's first name. */
  first_name?: string;
  /** The contact's last name. */
  last_name?: string;
  /** The contact's phone number. */
  phone?: string;
  /** The contact's email address. */
  email?: string;
  /**
   * The presenting issue or reason for contact.
   * Populated from a custom GHL form field configured per clinic.
   */
  issue?: string;
}

/**
 * Nested message object included on conversation/message event payloads.
 * Accessed via payload.message.body for the message text.
 */
export interface GhlMessage {
  /** The body text of the message. */
  body?: string;
  /** The message channel type (e.g. 'SMS', 'WhatsApp'). */
  type?: string;
  /** Direction of the message — 'inbound' or 'outbound'. */
  direction?: string;
  /** Delivery status of the message. */
  status?: string;
}

/**
 * Shape of an InboundMessage event payload.
 * Sent by GHL when a lead sends a message via SMS, WhatsApp, Facebook, etc.
 * Message content is nested under the message object.
 */
export interface GhlInboundMessagePayload extends GhlWebhookPayload {
  type: 'InboundMessage';
  /** The GHL contact identifier — present at root level as 'id'. */
  id?: string;
  /** The GHL conversation this message belongs to. */
  conversationId?: string;
  /** Nested message object — use message.body for the text content. */
  message?: GhlMessage;
}
