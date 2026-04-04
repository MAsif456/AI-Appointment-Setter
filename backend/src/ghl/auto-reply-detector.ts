// Ref: RFC 3834 — Recommendations for Automatic Responses to Electronic Mail
//   https://datatracker.ietf.org/doc/html/rfc3834
// Ref: arp242.net/autoreply.html — comprehensive auto-reply detection guide
//   https://www.arp242.net/autoreply.html
// Ref: jitbit.com — Outlook-specific auto-reply header patterns
//   https://www.jitbit.com/maxblog/18-detecting-outlook-autoreply-ooof-emails/
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
  }

  return false;
}
