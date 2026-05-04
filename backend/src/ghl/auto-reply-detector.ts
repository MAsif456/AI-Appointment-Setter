// Ref: RFC 3834 — Recommendations for Automatic Responses to Electronic Mail
//   https://datatracker.ietf.org/doc/html/rfc3834
// Ref: RFC 2369 — The Use of URLs as Meta-Syntax for Core Mail List Commands
//   https://www.rfc-editor.org/rfc/rfc2369
//   Defines List-Unsubscribe and other mailing-list headers; their presence
//   is the formal indicator of bulk/list email.
//
// GHL's InboundMessage webhook does not forward raw email headers like
// Auto-Submitted or Precedence, so we rely on content-based heuristics
// using the fields GHL does provide: subject, body, and from.

const AUTO_REPLY_SUBJECT_PATTERNS = [
  /\bauto[\s-]?reply\b/i,
  /\bautomatic reply\b/i,
  /\bout of (?:the )?office\b/i,
  /\bdelivery (?:status )?notification\b/i,
  /\bundeliverable\b/i,
  /\bmail delivery failed\b/i,
  /\bfailure notice\b/i,
  /\bdelivered\b.*\bnot read\b/i,
  /\babsence\b/i,
];

const AUTO_REPLY_SENDER_PATTERNS = [
  /^no[_-]?reply@/i,
  /^mailer-daemon@/i,
  /^postmaster@/i,
  /^auto-?responder@/i,
];

const AUTO_REPLY_BODY_PATTERNS = [
  /\bi(?:'m| am) (?:currently )?out of the office\b/i,
  /\bthis is an auto(?:matic|mated|[\s-]generated) (?:response|reply|message|email)\b/i,
  /\bdo not reply to this (?:email|message)\b/i,
  /\bthis mailbox is not monitored\b/i,
];

// Ref: RFC 3834 Section 3 — auto-responders SHOULD NOT reply to bulk/newsletter mail
//   https://datatracker.ietf.org/doc/html/rfc3834#section-3
// Ref: CAN-SPAM Act (15 U.S.C. § 7704) — requires commercial email to include
//   a clear opt-out/unsubscribe mechanism, which is why legitimate bulk emails
//   always contain "unsubscribe" links that we can detect as heuristics.
//   https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
// Ref: RFC 2369 — List-Unsubscribe header (formal indicator of mailing list mail)
//   https://www.rfc-editor.org/rfc/rfc2369
//
// GHL does not expose List-Id or List-Unsubscribe headers (RFC 2919), so we
// rely on body-content heuristics to detect marketing/newsletter emails that
// should not trigger an AI response.
const NEWSLETTER_BODY_PATTERNS = [
  /\bunsubscribe\b.*\bfrom this\b/i,
  /\bmanage your (?:email )?preferences\b/i,
  /\byou are receiving this (?:email |message )?because\b/i,
  /\bview (?:this email )?in (?:your )?browser\b/i,
  /\bclick here to unsubscribe\b/i,
  /\bopt[\s-]?out\b.*\b(?:email|mailing list)\b/i,
];

export interface AutoReplyCheckInput {
  subject?: string;
  body?: string;
  from?: string;
}

/**
 * Detects whether an email is an auto-reply based on its subject, body, and sender.
 * @param {AutoReplyCheckInput} input - object containing subject, body, and from fields.
 * @returns {boolean} - true if the email is an auto-reply, false otherwise.
 */
export function isAutoReply(input: AutoReplyCheckInput): boolean {
  const { subject, body, from } = input;

  if (subject) {
    for (const pattern of AUTO_REPLY_SUBJECT_PATTERNS) {
      if (pattern.test(subject)) return true;
    }
  }

  if (from) {
    for (const pattern of AUTO_REPLY_SENDER_PATTERNS) {
      if (pattern.test(from)) return true;
    }
  }

  if (body) {
    for (const pattern of AUTO_REPLY_BODY_PATTERNS) {
      if (pattern.test(body)) return true;
    }
    for (const pattern of NEWSLETTER_BODY_PATTERNS) {
      if (pattern.test(body)) return true;
    }
  }

  return false;
}
