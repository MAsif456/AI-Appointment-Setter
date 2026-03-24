import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';
import { SlotSelectionIntent } from './slot-selector.types';
import { UrgencyContext } from './urgency-detector.types';
import { PROMPT_EMERGENCY, PROMPT_URGENT, PROMPT_ROUTINE } from './urgency-messages';

// Tone instruction mappings for conversation style
const TONE_INSTRUCTIONS: Record<string, string> = {
  Friendly:
    'Use a warm, casual, and conversational tone. Be approachable and empathetic.',
  Professional:
    'Use a formal, businesslike, and respectful tone. Be courteous and precise.',
};

/** Context describing the lead's slot-selection reply. */
export interface SlotSelectionContext {
  intent: SlotSelectionIntent;
  /** The slot the lead confirmed (SLOT_SELECTED only) */
  selectedSlot?: { displayText: string };
  /** All matching slots when the reply was ambiguous (AMBIGUOUS only) */
  ambiguousSlots?: { displayText: string }[];
  /** Day name the lead asked for instead (DIFFERENT_DATE only) */
  requestedDate?: string;
  /** Time-of-day preference expressed by the lead (DIFFERENT_TIME only) */
  timePreference?: string;
}

/** Options for injecting available slot context into the system prompt. */
export interface SlotPromptOptions {
  /** Pre-built prompt section from buildSlotPromptSection() */
  slotSection: string;
  /** Optional detection result from the slot-selector — guides AI response */
  selectionContext?: SlotSelectionContext;
}


/** Builds the system prompt for the Groq AI based on lead, clinic, and urgency data. */
export function buildSystemPrompt(
  leadInfo: LeadInfo,
  clinicConfig: ClinicConfig,
  slotOptions?: SlotPromptOptions,
  urgencyContext?: UrgencyContext,
): string {
  const tone =
    TONE_INSTRUCTIONS[clinicConfig.tone] || TONE_INSTRUCTIONS['Friendly'];

  const serviceAreas = clinicConfig.serviceAreas?.length
    ? clinicConfig.serviceAreas.join(', ')
    : '';

  const parts: string[] = [
    `You are the booking receptionist for ${clinicConfig.name}.`,
    tone,
    '',
    '=== CONVERSATION FLOW (follow in order) ===',
    '',
    'STAGE 1 - GREETING:',
    `- Greet ${leadInfo.firstName} by name`,
    leadInfo.issue
      ? `- Acknowledge their issue (${leadInfo.issue})`
      : '- Ask what they need help with',
    '- Ask for their postcode to check clinic coverage',
    '',
    'STAGE 2 - POSTCODE CHECK:',
    '- When they give a postcode, check if it starts with a served prefix',
    serviceAreas ? `- Served prefixes: ${serviceAreas}` : '- Accept any postcode',
    '- If valid, confirm and move on. If outside area, let them know politely',
    '',
    'STAGE 3 - QUALIFICATION:',
    '- Do NOT ask about urgency — the system detects this automatically from context',
    '- Ask if they are a new or returning patient',
    '- Keep questions natural, not a rigid checklist',
    '',
    'STAGE 4 - OFFER SLOT:',
    '- Use the AVAILABLE SLOTS section below to offer real times',
    '- Present slots in natural British English (e.g. "Tuesday 17th March at 2pm")',
    '- Offer a maximum of 3 slots, prioritised by urgency',
    '- If no slots available, ask the lead for an alternative date',
    '',
    'STAGE 5 - CONFIRM BOOKING:',
    '- Confirm: date, time, clinic name, and what to expect',
    '- Let them know a confirmation will follow',
    '- Ask if there is anything else they need',
    '',
    '=== PATIENT INFO ===',
    `Name: ${leadInfo.firstName}${leadInfo.lastName ? ' ' + leadInfo.lastName : ''}`,
    leadInfo.issue ? `Issue: ${leadInfo.issue}` : '',
    leadInfo.phone ? `Phone: ${leadInfo.phone}` : '',
    '',
    // Inject available slots when provided
    slotOptions?.slotSection || '',
    '',
    // Inject urgency context when provided
    ...buildUrgencyContextLines(urgencyContext),
    '',
    '=== RULES ===',
    '- Keep each response to 1-3 short sentences',
    '- Do NOT use emojis or hashtags',
    '- Do NOT reveal what technology or system powers you',
    '- Sound like a real person at the clinic reception desk',
    '- Only move to the next stage when the current one is complete',
    '- Be helpful and proactive in suggesting next steps',
  ];

  if (clinicConfig.customInstructions) {
    parts.push(`- ${clinicConfig.customInstructions}`);
  }

  // Inject slot-selection status so the AI knows what to say next
  const ctx = slotOptions?.selectionContext;
  if (ctx) {
    parts.push('', '=== SLOT SELECTION STATUS ===');
    parts.push(...buildSelectionStatusLines(ctx));
  }

  return parts.filter(Boolean).join('\n');
}

/**
 * Generates urgency-context lines for the system prompt.
 * Guides the AI on how to handle the conversation based on detected urgency.
 */
function buildUrgencyContextLines(ctx?: UrgencyContext): string[] {
  if (!ctx || ctx.level === 'unknown') return [];

  const lines = ['=== URGENCY CONTEXT ==='];
  switch (ctx.level) {
    case 'emergency': lines.push(...PROMPT_EMERGENCY); break;
    case 'urgent':    lines.push(...PROMPT_URGENT);    break;
    case 'routine':   lines.push(...PROMPT_ROUTINE);   break;
  }
  return lines;
}

/** Generates instructional lines for the SLOT SELECTION STATUS section. */
function buildSelectionStatusLines(ctx: SlotSelectionContext): string[] {
  switch (ctx.intent) {
    case 'SLOT_SELECTED':
      return [
        `The lead has confirmed: "${ctx.selectedSlot?.displayText}".`,
        'Proceed to confirm the booking details (date, time, clinic name).',
        'Let them know a confirmation will follow.',
      ];
    case 'AMBIGUOUS': {
      const options = ctx.ambiguousSlots?.map(s => s.displayText).join(' or ') ?? '';
      return [
        `The lead's reply matched multiple slots: ${options}.`,
        `Ask them to clarify, e.g. "I have ${options} — which works best for you?"`,
      ];
    }
    case 'DIFFERENT_DATE':
      return [
        `The lead is asking for availability on ${ctx.requestedDate} instead.`,
        `Apologise the offered slots don't suit and offer to check ${ctx.requestedDate}.`,
        'The updated slots (if any) are shown in the AVAILABLE SLOTS section above.',
      ];
    case 'DIFFERENT_TIME':
      return [
        `The lead prefers ${ctx.timePreference} slots.`,
        'The updated slots reflecting this preference are shown in the AVAILABLE SLOTS section above.',
        'Offer them naturally.',
      ];
    case 'NONE_SUITABLE':
      return [
        "None of the offered slots work for the lead.",
        'Respond: "No problem! When would work better for you?"',
      ];
  }
}
