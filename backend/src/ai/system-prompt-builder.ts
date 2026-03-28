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
  /** Display texts of previously offered slots — injected so the AI never contradicts itself */
  previouslyOfferedSlots?: string[];
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
    '- Do NOT ask if they are a new or returning patient',
    '- Ask the lead when they would like to come in — e.g. "When would you like to come in? We can do same-day, this week, or further ahead."',
    '- Keep questions natural, not a rigid checklist',
    '- IMPORTANT: You MUST complete this stage before offering any appointment slots. Even if AVAILABLE SLOTS are shown below, do NOT offer them until the lead has told you their preferred timeframe.',
    '- EXCEPTION: If the lead has already stated when they want to come in (e.g. "same day", "this week", "next week", "tomorrow"),',
    '  skip straight to STAGE 4.',
    '- Once the lead has stated their preferred timeframe, move IMMEDIATELY to Stage 4 — do NOT ask vague questions like "which day would you prefer?" or "what day works for you?". Instead, present concrete available slot options right away.',
    '',
    'STAGE 4 - OFFER SLOT:',
    '- IMPORTANT: Do NOT enter this stage until Stages 1–3 are fully complete (greeting done, postcode checked, urgency/preference asked).',
    '- If a DAY AVAILABILITY section is shown below, present available days (Mon–Fri) and mention any fully booked days. Ask the lead to pick a day. Do NOT offer specific times yet.',
    '- If an AVAILABLE SLOTS section is shown below, use it to offer real times IMMEDIATELY — do NOT ask "which day would you prefer?" or any other open-ended question. Present the concrete slot options directly.',
    '- Present slots in natural British English (e.g. "Tuesday 17th March at 2pm")',
    '- Offer a maximum of 3 slots, prioritised by urgency',
    '- Make it clear the lead can request different dates or times if the offered slots don\'t suit',
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
    // Inject previously offered slots so the AI can reference them accurately
    ...(slotOptions?.previouslyOfferedSlots?.length
      ? [
          '=== PREVIOUSLY OFFERED SLOTS ===',
          'These are the exact slots you previously offered to the lead (for reference only — do NOT re-offer these if the AVAILABLE SLOTS section above has different slots):',
          ...slotOptions.previouslyOfferedSlots.map((s, i) => `${i + 1}. ${s}`),
          '',
        ]
      : []),
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
    '- NEVER ask if the lead is a new or returning patient',
    '- CRITICAL: Only offer slots listed in the AVAILABLE SLOTS section above. NEVER invent, guess, or re-offer slots from conversation history that are not in the current AVAILABLE SLOTS section.',
    '- If the lead references a slot you previously offered (listed in PREVIOUSLY OFFERED SLOTS), acknowledge it accurately with the correct date and time. Never deny offering a slot that is listed there.',
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
      const slots = ctx.ambiguousSlots ?? [];
      const options = slots.map(s => s.displayText).join(', ') || '';
      // Determine the distinguishing attribute to help the AI ask a focused question
      const days = slots.map(s => {
        const m = s.displayText.match(/^(\w+)\s/);
        return m ? m[1] : '';
      });
      const times = slots.map(s => {
        const m = s.displayText.match(/at\s+(.+)$/i);
        return m ? m[1] : '';
      });
      const allSameTime = new Set(times.filter(Boolean)).size <= 1;
      const allSameDay = new Set(days.filter(Boolean)).size <= 1;
      let clarifyHint: string;
      if (allSameTime && !allSameDay) {
        // Same time, different days — ask which day
        clarifyHint = `All matched slots are at ${times[0]}. Ask: "I have slots at ${times[0]} on ${days.join(', ')} — which day works best for you?"`;
      } else if (allSameDay && !allSameTime) {
        // Same day, different times — ask which time
        clarifyHint = `All matched slots are on ${days[0]}. Ask: "I have ${days[0]} at ${times.join(', ')} — which time works best for you?"`;
      } else {
        clarifyHint = `Ask: "I have ${options} — which one works best for you?"`;
      }
      return [
        `The lead's reply matched multiple slots: ${options}.`,
        'CRITICAL: Do NOT pick one arbitrarily. You MUST ask the lead to clarify which one they want.',
        clarifyHint,
      ];
    }
    case 'DIFFERENT_DATE': {
      const dateLabel = ctx.requestedDate ? ` for ${ctx.requestedDate}` : '';
      return [
        `The lead has requested different availability${dateLabel}. The system has fetched fresh slots for this request.`,
        'CRITICAL: If slots ARE listed in the AVAILABLE SLOTS section, they ARE available for the time the lead asked for.',
        'Offer them directly. Do NOT say "unfortunately we don\'t have availability" or "no appointments available"',
        'when slots are listed — that would be incorrect.',
        'Do NOT re-offer any previously offered slots that are not in the current AVAILABLE SLOTS section.',
        'If the AVAILABLE SLOTS section says "No slots are currently available", tell the lead:',
        '"Our availability only extends about 4 months ahead. I don\'t have any slots for that date yet — would you like to try a closer date, or I can ask my team to check?"',
        'Do NOT fall back to previously offered slots when no new slots are available.',
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
        'Ask what dates or times would work better so you can fetch new availability.',
        'Respond: "No problem! What dates or times would work better for you?"',
        'Do NOT re-offer the same slots. Wait for the lead to provide new preferences.',
        'Once they provide a preference, present concrete slot options directly — do NOT ask vague follow-up questions.',
      ];
    case 'DAY_OVERVIEW': {
      const lines = [
        'The lead has asked about availability for a week range.',
      ];
      if (ctx.timePreference && /\d/.test(ctx.timePreference)) {
        lines.push(
          `The lead specifically asked about ${ctx.timePreference} slots.`,
          `The DAY AVAILABILITY section above shows ONLY days that have a ${ctx.timePreference} slot available.`,
          `If no days are available, tell the lead: "I don't have any ${ctx.timePreference} slots available that week, but I can check other times or a different week if you'd like."`,
        );
      } else {
        lines.push(
          'The DAY AVAILABILITY section above shows which weekdays have openings and which are fully booked.',
        );
      }
      lines.push(
        'Present this information naturally and ask the lead to pick a day.',
        'Do NOT offer specific time slots yet — wait for the lead to choose a day first.',
      );
      return lines;
    }
  }
}
