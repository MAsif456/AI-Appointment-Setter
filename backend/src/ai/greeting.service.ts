import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from './groq.service';
import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';
import { buildGreetingPrompt } from './prompt-builder';
import { ReturningPatientResult } from '../patient-history/patient-history.service';

/**
 * Greeting-specific logic for generating personalised AI greetings.
 * Handles template substitution and delegates AI generation to GroqService.
 */
@Injectable()
export class GreetingService {
  private readonly logger = new Logger(GreetingService.name);

  constructor(private readonly groqService: GroqService) {}

  /**
   * Generates a personalised greeting for a new lead.
   * Uses a custom template if available; otherwise calls the Groq API.
   * @param leadInfo - The lead's personal details and issue
   * @param clinicConfig - The clinic's configuration including tone and template
   * @returns The greeting string, or null if generation fails
   */
  async generateGreeting(
    leadInfo: LeadInfo,
    clinicConfig: ClinicConfig,
  ): Promise<string | null> {
    // Check for custom template first — no AI call needed
    if (clinicConfig.greetingTemplate) {
      this.logger.log(
        `Using custom template for clinic: ${clinicConfig.name}`,
      );
      return this.applyTemplate(clinicConfig.greetingTemplate, leadInfo, clinicConfig);
    }

    // Build prompt and call Groq API
    const prompt = buildGreetingPrompt(leadInfo, clinicConfig);
    this.logger.log(`Generating AI greeting for lead: ${leadInfo.firstName}`);

    const greeting = await this.groqService.generateResponse(prompt);

    if (!greeting) {
      this.logger.warn(
        `Failed to generate greeting for lead: ${leadInfo.firstName}`,
      );
      return null;
    }

    return greeting;
  }

  /**
   * Generates a personalised greeting for a returning patient.
   * Uses the clinic's returningPatientGreetingTemplate if configured;
   * otherwise calls the Groq API with a prompt tailored to the confidence level.
   *
   * @param leadInfo - The lead's personal details from the webhook payload
   * @param clinicConfig - The clinic configuration including optional returning patient template
   * @param returningPatient - The matched patient history record with confidence level
   * @returns The greeting string, or null if generation fails
   */
  async generateReturningPatientGreeting(
    leadInfo: LeadInfo,
    clinicConfig: ClinicConfig,
    returningPatient: ReturningPatientResult,
  ): Promise<string | null> {
    // Template-first: use the clinic's custom returning patient template if set
    if (clinicConfig.returningPatientGreetingTemplate) {
      this.logger.log(
        `Using returning patient template for clinic: ${clinicConfig.name}`,
      );
      return this.applyTemplate(
        clinicConfig.returningPatientGreetingTemplate,
        leadInfo,
        clinicConfig,
      );
    }

    // Build an AI prompt appropriate to the confidence level
    const prompt = this.buildReturningPatientPrompt(leadInfo, clinicConfig, returningPatient);
    this.logger.log(
      `Generating returning patient greeting for lead: ${leadInfo.firstName} (confidence: ${returningPatient.confidence})`,
    );

    const greeting = await this.groqService.generateResponse(prompt);

    if (!greeting) {
      this.logger.warn(
        `Failed to generate returning patient greeting for lead: ${leadInfo.firstName}`,
      );
      return null;
    }

    return greeting;
  }

  /**
   * Builds a Groq prompt for a returning patient greeting.
   * Warmth and wording vary by confidence level:
   *   high/medium: "Welcome back, [name]!"
   *   stale: "It's been a while" variant
   *
   * @param leadInfo - Lead details for personalisation
   * @param clinicConfig - Clinic name and tone
   * @param returningPatient - Matched history record
   * @returns A formatted prompt string
   */
  private buildReturningPatientPrompt(
    leadInfo: LeadInfo,
    clinicConfig: ClinicConfig,
    returningPatient: ReturningPatientResult,
  ): string {
    const isStale = returningPatient.confidence === 'stale';
    const openingInstruction = isStale
      ? `The patient has contacted before but it has been a while. Open warmly, e.g. "It's been a while, great to hear from you again, ${leadInfo.firstName}!"`
      : `Greet the patient as a returning patient, e.g. "Welcome back, ${leadInfo.firstName}!"`;

    const parts: string[] = [
      `You are the receptionist for ${clinicConfig.name}.`,
      `${openingInstruction}`,
      'Then in the same message ask whether their contact details are still the same.',
      'Keep the response to 2 sentences maximum.',
      'Use British English spelling.',
      'Do NOT use emojis or hashtags.',
      'Do NOT reveal what technology or system powers you.',
      'Keep the response under 160 characters.',
    ];

    if (clinicConfig.customInstructions) {
      parts.push(`Additional instructions: ${clinicConfig.customInstructions}`);
    }

    return parts.join('\n');
  }

  /**
   * Replaces {{placeholder}} variables in a greeting template with actual values.
   * Supported variables: firstName, lastName, clinicName, issue.
   * @param template - The template string with {{variable}} placeholders
   * @param leadInfo - The lead data for variable substitution
   * @param clinicConfig - The clinic data for variable substitution
   * @returns The template with all placeholders replaced
   */
  private applyTemplate(
    template: string,
    leadInfo: LeadInfo,
    clinicConfig: ClinicConfig,
  ): string {
    const variables: Record<string, string> = {
      firstName: leadInfo.firstName,
      lastName: leadInfo.lastName ?? '',
      clinicName: clinicConfig.name,
      issue: leadInfo.issue ?? '',
    };

    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => variables[key] ?? '',
    );
  }
}
