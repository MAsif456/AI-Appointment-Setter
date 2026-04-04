// Ref: GHL Send Message API — Email type uses `html` + `subject` fields.
//   GHL Conversations API — Send a New Message endpoint
// Inline styles are required because email clients strip <style> blocks.

/**
 * Escapes special HTML characters in a given string.
 * Replaces & with &amp;, < with &lt;, > with &gt;, and " with &quot;.
 * This is necessary because some email clients strip <style> blocks, so we need to use escaped characters.
 * @param text The string to escape
 * @returns The escaped string
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wraps an AI plain-text response in minimal HTML for email delivery.
 * Uses inline styles because most email clients ignore <style> blocks.
 */
export function formatEmailHtml(plainText: string, clinicName: string): string {
  const escaped = escapeHtml(plainText);
  const bodyHtml = escaped.replace(/\n/g, '<br>');

  return [
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#333;">',
    `<p>${bodyHtml}</p>`,
    `<p style="color:#888;font-size:12px;margin-top:20px;">&mdash; ${escapeHtml(clinicName)}</p>`,
    '</div>',
  ].join('');
}

/**
 * Builds a subject line that keeps the email thread grouped.
 * First message omits "Re:" so it starts a new thread;
 * subsequent messages include "Re:" so email clients thread them.
 */
export function formatEmailSubject(
  clinicName: string,
  isFirstMessage: boolean,
): string {
  const base = `${clinicName} - Your appointment enquiry`;
  return isFirstMessage ? base : `Re: ${base}`;
}
