import { Injectable, Logger } from '@nestjs/common';
import { GroqService } from './groq.service';
import { LeadInfo } from './interfaces/lead-info.interface';
import { ClinicConfig } from './interfaces/clinic-config.interface';
import { buildGreetingPrompt } from './prompt-builder';

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
