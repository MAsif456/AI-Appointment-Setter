import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';
import { SlotSelectionIntent } from './slot-selector.types';

// Tone instruction mappings for conversation style
const TONE_INSTRUCTIONS: Record<string, string> = {
  Friendly:
    'Use a warm, casual, and conversational tone. Be approachable and empathetic.',
  Professional:
    'Use a formal, businesslike, and respectful tone. Be courteous and precise.',
};

/**
 * Structured context describing what the system detected about the lead's
 * slot-selection reply.  Passed alongside the slot section so the AI can
 * generate an appropriate follow-up response.
 */
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

/**
 * Options for injecting available slot context into the system prompt.
 * When provided, the AI will use these slots in its OFFER SLOT stage.
 */
export interface SlotPromptOptions {
  /** Pre-built prompt section from buildSlotPromptSection() */
  slotSection: string;
  /** Optional detection result from the slot-selector — guides AI response */
  selectionContext?: SlotSelectionContext;
}


/**
 * Builds a system prompt string for the Groq AI based on lead and clinic data.
 * The prompt instructs the AI to act as a clinic receptionist without revealing
 * that it is an AI or disclosing any model information.
 * @param leadInfo - The lead's personal details and issue
 * @param clinicConfig - The clinic's tone, name, and custom instructions
 * @param slotOptions - Optional context passed alongside a message for slot offering
 * @returns A formatted prompt string ready to send to the AI
 */
export function buildSystemPrompt(
  leadInfo: LeadInfo,
  clinicConfig: ClinicConfig,
  slotOptions?: SlotPromptOptions,
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
    '- Ask about urgency — offer all three options: same-day, this week, or flexible',
    '- Do NOT ask if they are a new or returning patient',
    '- Keep questions natural, not a rigid checklist',
    '- IMPORTANT: If the lead has already stated when they want to come in (e.g. "same day", "this week", "next week", "tomorrow"),',
    '  do NOT ask about urgency again. Skip straight to STAGE 4 and offer appointment slots.',
    '',
    'STAGE 4 - OFFER SLOT:',
    '- Use the AVAILABLE SLOTS section below to offer real times',
    '- Present slots in natural British English (e.g. "Tuesday 17th March at 2pm")',
    '- Offer a maximum of 3 slots, prioritised by urgency',
    '- If no slots available, ask the lead for an alternative date',
    '- NEVER say "no appointments available" if slots ARE listed in the AVAILABLE SLOTS section',
    '',
    'STAGE 5 - CONFIRM BOOKING:',
    '- Confirm: date, time, clinic name, and what to expect',
    '- Let them know a confirmation will follow',
    '- Ask if there is anything else they need',
    '',
    `Today's date is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
    '',
    '=== PATIENT INFO ===',
    `Name: ${leadInfo.firstName}${leadInfo.lastName ? ' ' + leadInfo.lastName : ''}`,
    leadInfo.issue ? `Issue: ${leadInfo.issue}` : '',
    leadInfo.phone ? `Phone: ${leadInfo.phone}` : '',
    '',
    // Inject available slots when provided
    slotOptions?.slotSection || '',
    '',
    '=== RULES ===',
    '- Keep each response to 1-3 short sentences',
    '- Do NOT use emojis or hashtags',
    '- Do NOT reveal what technology or system powers you',
    '- Sound like a real person at the clinic reception desk',
    '- Only move to the next stage when the current one is complete',
    '- Be helpful and proactive in suggesting next steps',
    '- NEVER ask if the lead is a new or returning patient',
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
 * Generates the instructional lines for the SLOT SELECTION STATUS section
 * based on what the system detected about the lead's reply.
 * @param ctx - The selection context produced by detectSlotSelection()
 * @returns Array of prompt lines describing how the AI should respond
 */
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
    case 'DIFFERENT_DATE': {
      const dateLabel = ctx.requestedDate ? ` for ${ctx.requestedDate}` : '';
      return [
        `The system has already filtered the AVAILABLE SLOTS section above to match the lead's requested timing${dateLabel}.`,
        'CRITICAL: If slots ARE listed in the AVAILABLE SLOTS section, they ARE available for the time the lead asked for.',
        'Offer them directly. Do NOT say "unfortunately we don\'t have availability" or "no appointments available"',
        'when slots are listed — that would be incorrect.',
        'If the AVAILABLE SLOTS section says "No slots are currently available", only then tell the lead',
        'and ask for an alternative date.',
      ];
    }
    case 'DIFFERENT_TIME':
      return [
        `The lead prefers ${ctx.timePreference} slots.`,
        'The updated slots reflecting this preference are shown in the AVAILABLE SLOTS section above.',
        'Offer them naturally.',
      ];
    case 'FURTHER_DATE':
      return [
        'The lead is asking for later or further available dates.',
        'The updated slots showing the latest availability are in the AVAILABLE SLOTS section above.',
        'Offer them naturally and let the lead know these are the furthest dates available.',
        'IMPORTANT: ONLY offer the exact slots listed above. Do NOT invent or suggest any dates or times that are not in the AVAILABLE SLOTS section.',
      ];
    case 'NONE_SUITABLE':
      return [
        "None of the offered slots work for the lead.",
        'Respond: "No problem! When would work better for you?"',
      ];
  }
}
