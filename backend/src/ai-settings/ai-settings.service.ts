
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Clinic, ClinicDocument } from '../database/schemas/clinic.schema';
import { UpdateAiSettingsDto } from './ai-settings.dto';
import {
  DEFAULT_TONE,
  DEFAULT_GREETING_TEMPLATE,
  DEFAULT_QUALIFICATION_QUESTIONS,
} from './ai-settings.defaults';
/**
 * Interface for the AI settings response.
 * Contains the tone, greeting template, qualification questions, and custom instructions.
 */
export interface AiSettingsResponse {
  /**
   * The AI tone.
   */
  tone: string;
  /**
   * The greeting template for the AI to use when interacting with patients.
   */
  greetingTemplate: string;
  /**
   * The qualification questions the AI should ask patients.
   */
  qualificationQuestions: { key: string; label: string; enabled: boolean }[];
  /**
   * Custom instructions for the AI to follow when interacting with patients.
   */
  customInstructions: string;
}

/**
 * Service for handling AI settings.
 */
@Injectable()
export class AiSettingsService {
  /**
   * Constructor.
   * @param clinicModel - The Mongoose model for clinics.
   */
  constructor(
    @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument>,
  ) {}

  /**
   * Gets the AI settings for a clinic with the given ID.
   * If the clinic is not found, throws a NotFoundException.
   * @param clinicId - The ID of the clinic to get the AI settings for.
   * @returns The AI settings for the clinic.
   */
  async getAiSettings(clinicId: string): Promise<AiSettingsResponse> {
    const clinic = await this.clinicModel.findById(clinicId).lean().exec();
    if (!clinic) {
      throw new NotFoundException(`Clinic with ID "${clinicId}" not found`);
    }

    const config = clinic.aiConfig;
    return {
      tone: config?.tone ?? DEFAULT_TONE,
      greetingTemplate: config?.greetingTemplate ?? DEFAULT_GREETING_TEMPLATE,
      qualificationQuestions:
        config?.qualificationQuestions?.length > 0
          ? config.qualificationQuestions
          : DEFAULT_QUALIFICATION_QUESTIONS,
      // Handle legacy format where customInstructions was stored as string[]
      customInstructions: normalizeCustomInstructions(config?.customInstructions),
    };
  }

  /**
   * Updates the AI settings for a clinic with the given ID.
   * If the clinic is not found, throws a NotFoundException.
   * @param clinicId - The ID of the clinic to update the AI settings for.
   * @param updateDto - The updated AI settings.
   * @returns The updated AI settings.
   */
  async updateAiSettings(
    clinicId: string,
    updateDto: UpdateAiSettingsDto,
  ): Promise<AiSettingsResponse> {
    const setFields: Record<string, unknown> = {};
    if (updateDto.tone !== undefined) {
      setFields['aiConfig.tone'] = updateDto.tone;
    }
    if (updateDto.greetingTemplate !== undefined) {
      setFields['aiConfig.greetingTemplate'] = updateDto.greetingTemplate;
    }
    if (updateDto.qualificationQuestions !== undefined) {
      setFields['aiConfig.qualificationQuestions'] = updateDto.qualificationQuestions;
    }
    if (updateDto.customInstructions !== undefined) {
      setFields['aiConfig.customInstructions'] = updateDto.customInstructions;
    }

    const clinic = await this.clinicModel
      .findByIdAndUpdate(clinicId, { $set: setFields }, { new: true })
      .lean()
      .exec();

    if (!clinic) {
      throw new NotFoundException(`Clinic with ID "${clinicId}" not found`);
    }

    const config = clinic.aiConfig;
    return {
      tone: config?.tone ?? DEFAULT_TONE,
      greetingTemplate: config?.greetingTemplate ?? DEFAULT_GREETING_TEMPLATE,
      qualificationQuestions:
        config?.qualificationQuestions?.length > 0
          ? config.qualificationQuestions
          : DEFAULT_QUALIFICATION_QUESTIONS,
      customInstructions: normalizeCustomInstructions(config?.customInstructions),
    };
  }
}

/**
 * Converts customInstructions to a string, handling the legacy format
 * where it was stored as a string[] in older database documents.
 * @param value - The raw value from the database (string, string[], or undefined)
 * @returns A plain string
 */
function normalizeCustomInstructions(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'string') {
    return value;
  }
  return '';
}
