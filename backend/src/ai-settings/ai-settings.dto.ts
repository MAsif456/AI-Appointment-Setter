/**
 * Imports from class-validator and class-transformer.
 * Used to validate and transform data in the AI settings DTO.
 */
import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Enum for the possible AI tones.
 * The AI tone determines how the AI interacts with patients.
 */
export enum AIToneEnum {
  /**
   * Friendly tone: Warm and casual, uses emojis sparingly.
   */
  Friendly = "friendly",

  /**
   * Professional tone: Formal and businesslike.
   */
  Professional = "professional",

  /**
   * Balanced tone: Mix of friendly and professional.
   */
  Balanced = "balanced",
}
/**
 * DTO for a single qualification question.
 * Contains the key, label, and enabled state of the question.
 */
export class QualificationQuestionDto {
  /**
   * The key of the qualification question.
   * Must be a string.
   */
  @IsString()
  key: string;

  /**
   * The label of the qualification question.
   * Must be a string.
   */
  @IsString()
  label: string;

  /**
   * Whether the qualification question is enabled.
   * Must be a boolean.
   */
  @IsBoolean()
  enabled: boolean;
}

/**
 * DTO for updating AI settings.
 * Contains optional fields for tone, greeting template, qualification questions, and custom instructions.
 */
export class UpdateAiSettingsDto {
  /**
   * The tone of the AI, if provided.
   * Must be one of 'friendly', 'professional', or 'balanced'.
   */
  @IsOptional()
  @IsEnum(AIToneEnum, {
    message: "Tone must be friendly, professional, or balanced",
  })
  tone?: AIToneEnum;

  /**
   * The greeting template to use when generating messages, if provided.
   * Must not exceed 500 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: "Greeting template must not exceed 500 characters",
  })
  greetingTemplate?: string;

  /**
   * The qualification questions to ask patients, if provided.
   * Must be an array of QualificationQuestionDto objects.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QualificationQuestionDto)
  qualificationQuestions?: QualificationQuestionDto[];

  /**
   * Custom instructions to display to patients, if provided.
   * Must not exceed 1000 characters.
   */
  @IsOptional()
  @IsString()
  @MaxLength(1000, {
    message: "Custom instructions must not exceed 1000 characters",
  })
  customInstructions?: string;
}
