/**
 * Channel Adapter pattern — abstracts per-channel message formatting behind
 * a unified interface so the orchestrator is channel-agnostic.
 *
 * Ref: Hohpe, G. & Woolf, B. (2003). Enterprise Integration Patterns. Addison-Wesley.
 *   "Channel Adapter" — https://www.enterpriseintegrationpatterns.com/patterns/messaging/ChannelAdapter.html
 * Ref: Gamma, E. et al. (1994). Design Patterns. Addison-Wesley. "Strategy" pattern.
 *
 * Adding a new channel (e.g. WhatsApp) requires only a new adapter class —
 * existing orchestrator code does not need modification (Open/Closed Principle).
 */
import { formatEmailHtml, formatEmailSubject } from "./email-formatter";
import { stripEmailContent, isEmptyAfterStrip } from "./email-content-stripper";
import { isAutoReply, AutoReplyCheckInput } from "./auto-reply-detector";

/** Outbound formatting result — fields the GHL Send Message API expects. */
export interface OutboundFormatResult {
  html?: string;
  subject?: string;
}

/** Unified interface each channel adapter implements. */
export interface ChannelAdapter {
  /** Formats an AI plain-text response for outbound delivery. */
  formatOutbound(
    text: string,
    clinicName: string,
    isFirstMessage: boolean,
  ): OutboundFormatResult;

  /** Strips inbound message content to clean plain text for AI processing. */
  stripInbound(raw: string): string;

  /** Returns true if the inbound content is empty after stripping. */
  isEmptyAfterStrip(content: string): boolean;

  /** Returns true if the inbound message is an auto-reply that should be silently dropped. */
  isAutoReply(input: AutoReplyCheckInput): boolean;
}

/** Email channel — HTML formatting, signature stripping, auto-reply detection. */
export class EmailChannelAdapter implements ChannelAdapter {
  /**
   * Formats an AI plain-text response for outbound delivery over email.
   * @param {string} text - AI plain-text response
   * @param {string} clinicName - clinic name to include in the email subject and footer
   * @param {boolean} isFirstMessage - true if this is the first message in the conversation,
   *   false otherwise
   * @returns {OutboundFormatResult} - formatted email body and subject
   */
  formatOutbound(
    text: string,
    clinicName: string,
    isFirstMessage: boolean,
  ): OutboundFormatResult {
    return {
      html: formatEmailHtml(text, clinicName),
      subject: formatEmailSubject(clinicName, isFirstMessage),
    };
  }

  /**
   * Strips inbound message content to clean plain text for AI processing.
   * Wraps `stripEmailContent` to provide a unified interface for all channel adapters.
   * @param raw The raw HTML content of the inbound message.
   * @returns The sanitised text.
   */
  stripInbound(raw: string): string {
    return stripEmailContent(raw);
  }

  /**
   * Returns true if the given content is empty after stripping (i.e. it contains
   * no useful text after removing HTML tags, quoted replies, and other noise).
   * @param content The content to check.
   * @returns true if the content is empty after stripping, false otherwise.
   */
  isEmptyAfterStrip(content: string): boolean {
    return isEmptyAfterStrip(content);
  }

  /**
   * Detects whether an email is an auto-reply based on its subject, body, and sender.
   * @param {AutoReplyCheckInput} input - object containing subject, body, and from fields
   * @returns {boolean} - true if the email is an auto-reply, false otherwise
   */
  isAutoReply(input: AutoReplyCheckInput): boolean {
    return isAutoReply(input);
  }
}

export class SmsChannelAdapter implements ChannelAdapter {
  /**
   * Returns an empty OutboundFormatResult for SMS channel.
   * This implementation does not perform any formatting or stripping for SMS channel.
   * @param _text - AI plain-text response (not used)
   * @param _clinicName - clinic name (not used)
   * @param _isFirstMessage - true if this is the first message in the conversation, false otherwise (not used)
   * @returns An empty OutboundFormatResult object.
   */
  formatOutbound(
    _text: string,
    _clinicName: string,
    _isFirstMessage: boolean,
  ): OutboundFormatResult {
    return {};
  }

  /**
   * For SMS channel, does not strip any content from the inbound message.
   * SMS messages are never stripped empty, so this function always returns the raw message unchanged.
   * @param raw The raw HTML content of the inbound message.
   * @returns The sanitised text (always the same as the input).
   */
  stripInbound(raw: string): string {
    return raw;
  }

  /**
   * For SMS channel, this function always returns false.
   * SMS messages are never stripped empty, so this function always returns false.
   * @param _content The content to check.
   * @returns false
   */
  isEmptyAfterStrip(_content: string): boolean {
    return false;
  }

  /**
   * Returns true if the inbound message is an auto-reply that should be silently dropped.
   * Currently, this function always returns false, as auto-reply detection is email-only.
   * @param _input - object containing subject, body, and from fields.
   * @returns true if the email is an auto-reply, false otherwise.
   */
  isAutoReply(_input: AutoReplyCheckInput): boolean {
    return false;
  }
}

const emailAdapter = new EmailChannelAdapter();
const smsAdapter = new SmsChannelAdapter();


/**
 * Returns a ChannelAdapter instance based on the given channel.
 * @param channel The channel identifier ("email" or "sms").
 * @returns A ChannelAdapter instance for the given channel.
 */
export function getChannelAdapter(channel: string): ChannelAdapter {
  return channel === "email" ? emailAdapter : smsAdapter;
}
