import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';

// Tone instruction mappings for conversation style
const TONE_INSTRUCTIONS: Record<string, string> = {
  Friendly:
    'Use a warm, casual, and conversational tone. Be approachable and empathetic.',
  Professional:
    'Use a formal, businesslike, and respectful tone. Be courteous and precise.',
};

/**
 * Options for injecting available slot context into the system prompt.
 * When provided, the AI will use these slots in its OFFER SLOT stage.
 */
export interface SlotPromptOptions {
  /** Pre-built prompt section from buildSlotPromptSection() */
  slotSection: string;
}

/**
 * Builds the system prompt that defines the AI's persona for multi-turn chats.
 * Includes explicit conversation flow stages to guide the booking process:
 * greeting → postcode → urgency/timing → offer slot → confirm booking.
 * @param leadInfo - The lead's personal details and issue
 * @param clinicConfig - The clinic's configuration
 * @param slotOptions - Optional slot context for the OFFER SLOT stage
 * @returns A system prompt string for the Groq chat API
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
    '- Ask about urgency (same-day, this week, or flexible)',
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

  return parts.filter(Boolean).join('\n');
}
