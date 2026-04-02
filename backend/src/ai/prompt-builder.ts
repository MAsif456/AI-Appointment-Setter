import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';

// Tone instruction mappings
const TONE_INSTRUCTIONS: Record<string, string> = {
  Friendly:
    'Use a warm, casual, and conversational tone. Be approachable and empathetic.',
  Professional:
    'Use a formal, businesslike, and respectful tone. Be courteous and precise.',
};

/**
 * Builds a greeting prompt string for the Groq API based on lead and clinic data.
 * The prompt instructs the AI to act as a clinic receptionist without revealing
 * that it is an AI or disclosing any model information.
 * @param leadInfo - The lead's personal details and issue
 * @param clinicConfig - The clinic's tone, name, and custom instructions
 * @returns A formatted prompt string ready to send to the AI
 */
export function buildGreetingPrompt(
  leadInfo: LeadInfo,
  clinicConfig: ClinicConfig,
): string {
  const toneInstruction =
    TONE_INSTRUCTIONS[clinicConfig.tone] || TONE_INSTRUCTIONS['Friendly'];

  const parts: string[] = [
    `You are the receptionist for ${clinicConfig.name}.`,
    toneInstruction,
    `A new patient named ${leadInfo.firstName} has contacted the clinic.`,
  ];

  // Include the patient's issue if provided
  if (leadInfo.issue) {
    parts.push(`Their issue is: ${leadInfo.issue}.`);
  }

  parts.push(
    'Write a short greeting (2-3 sentences) that:',
    `- Addresses the patient by their first name (${leadInfo.firstName})`,
    '- Acknowledges their issue if mentioned',
    '- Asks for their postcode so you can check coverage',
    '- Does NOT use emojis or hashtags',
    '- Does NOT reveal what technology or system powers you',
    '- Sounds like a real person working at the clinic',
  );

  // Append custom clinic instructions if present
  if (clinicConfig.customInstructions) {
    parts.push(`Additional instructions: ${clinicConfig.customInstructions}`);
  }

  return parts.join('\n');
}
