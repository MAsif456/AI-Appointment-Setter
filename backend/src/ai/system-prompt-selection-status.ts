/**
 * Generates the SLOT SELECTION STATUS and URGENCY CONTEXT prompt sections
 * for the system prompt builder. Extracted to keep system-prompt-builder.ts
 * under the 200-line limit.
 */
import { UrgencyContext } from './urgency-detector.types';
import { PROMPT_EMERGENCY, PROMPT_URGENT, PROMPT_ROUTINE } from './urgency-messages';
import { SlotSelectionContext } from './system-prompt-builder';

/** Generates urgency-context lines for the system prompt. */
export function buildUrgencyContextLines(ctx?: UrgencyContext): string[] {
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
export function buildSelectionStatusLines(ctx: SlotSelectionContext): string[] {
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
        clarifyHint = `All matched slots are at ${times[0]}. Ask: "I have slots at ${times[0]} on ${days.join(', ')} — which day works best for you?"`;
      } else if (allSameDay && !allSameTime) {
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
      const lines = ['The lead has asked about availability for a week range.'];
      if (ctx.timePreference && /\d/.test(ctx.timePreference)) {
        lines.push(
          `The lead specifically asked about ${ctx.timePreference} slots.`,
          `The DAY AVAILABILITY section above shows ONLY days that have a ${ctx.timePreference} slot available.`,
          `If no days are available, tell the lead: "I don't have any ${ctx.timePreference} slots available that week, but I can check other times or a different week if you'd like."`,
        );
      } else {
        lines.push('The DAY AVAILABILITY section above shows which weekdays have openings and which are fully booked.');
      }
      lines.push(
        'Present this information naturally and ask the lead to pick a day.',
        'Do NOT offer specific time slots yet — wait for the lead to choose a day first.',
      );
      return lines;
    }
  }
}
