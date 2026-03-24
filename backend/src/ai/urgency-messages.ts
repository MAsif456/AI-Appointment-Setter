/**
 * Centralised urgency-related message templates and prompt fragments.
 *
 * Keeps hardcoded prose out of service and prompt-builder logic,
 * making it easy to review, translate, or A/B-test wording in one place.
 */

// System-prompt context lines (injected into the AI system prompt)

export const PROMPT_EMERGENCY = [
  'EMERGENCY: The patient has reported a potential medical emergency.',
  'Do NOT proceed with booking. Do NOT ask any more questions.',
  'Respond ONLY with: "This sounds like it needs urgent attention. '
    + "I've notified the clinic team right now, and someone will contact you "
    + 'very shortly. If this is a medical emergency, please call 999."',
] as const;

export const PROMPT_URGENT = [
  'The patient needs to be seen urgently.',
  'Prioritise the earliest available slot. Be empathetic about their concern.',
  'Skip unnecessary qualification questions — move quickly to slot offering.',
] as const;

export const PROMPT_ROUTINE = [
  'The patient is not in a rush. Proceed through normal qualification.',
  'Offer slots spread across different days for flexibility.',
] as const;

// Patient-facing messages (sent as AI replies)

export const PATIENT_EMERGENCY_RESPONSE =
  "This sounds like it needs urgent attention. I've notified the clinic team right now, " +
  'and someone will contact you very shortly. If this is a medical emergency, please call 999.';

export const PATIENT_NO_SLOTS_URGENT =
  "I can see we're quite fully booked at the moment, but I've flagged your case as " +
  'urgent with the team. Someone will be in touch shortly to find a time for you.';

// Staff notification templates

export function buildStaffAlert(
  lead: { firstName: string; lastName?: string; phone: string; issue?: string },
  reason: string,
): string {
  return [
    'URGENT ALERT',
    `Patient: ${lead.firstName}${lead.lastName ? ' ' + lead.lastName : ''} (${lead.phone})`,
    lead.issue ? `Issue: ${lead.issue}` : '',
    `Reason: ${reason}`,
    'Action required: Contact patient immediately.',
  ].filter(Boolean).join('\n');
}
