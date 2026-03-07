
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateAiSettingsDto } from './ai-settings.dto';

/**
 * Validates a plain object against the constraints defined in UpdateAiSettingsDto.
 * @param plain - The plain object to validate
 * @returns A promise that resolves to an array of validation errors
 */
async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateAiSettingsDto, plain);
  return validate(dto);
}

describe('UpdateAiSettingsDto', () => {
  /**
   * Tests that the DTO accepts a valid full payload
   */
  it('should accept a valid full payload', async () => {
    const errors = await validateDto({
      tone: 'friendly',
      greetingTemplate: 'Hello {{firstName}}',
      customInstructions: 'Mention parking',
      qualificationQuestions: [
        { key: 'urgency', label: 'Urgency', enabled: true },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  /**
   * Tests that the DTO accepts an empty object (all fields are optional)
   */
  it('should accept an empty object (all fields optional)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  /**
   * Tests that the DTO rejects an invalid tone value
   */
  it('should reject an invalid tone value', async () => {
    const errors = await validateDto({ tone: 'aggressive' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('tone');
  });

  /**
   * Tests that the DTO rejects greetingTemplate exceeding 500 characters
   */
  it('should reject greetingTemplate exceeding 500 characters', async () => {
    const errors = await validateDto({ greetingTemplate: 'a'.repeat(501) });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('greetingTemplate');
  });

  /**
   * Tests that the DTO accepts greetingTemplate of exactly 500 characters
   */
  it('should accept greetingTemplate of exactly 500 characters', async () => {
    const errors = await validateDto({ greetingTemplate: 'a'.repeat(500) });
    expect(errors).toHaveLength(0);
  });

  /**
   * Tests that the DTO rejects customInstructions exceeding 1000 characters
   */
  it('should reject customInstructions exceeding 1000 characters', async () => {
    const errors = await validateDto({ customInstructions: 'b'.repeat(1001) });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('customInstructions');
  });

  /**
   * Tests that the DTO accepts customInstructions of exactly 1000 characters
   */
  it('should accept customInstructions of exactly 1000 characters', async () => {
    const errors = await validateDto({ customInstructions: 'b'.repeat(1000) });
    expect(errors).toHaveLength(0);
  });

  /**
   * Tests that the DTO rejects qualificationQuestions with missing key
   */
  it('should reject qualificationQuestions with missing key', async () => {
    const errors = await validateDto({
      qualificationQuestions: [{ label: 'Urgency', enabled: true }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });

  /**
   * Tests that the DTO rejects qualificationQuestions with non-boolean enabled
   */
  it('should reject qualificationQuestions with non-boolean enabled', async () => {
    const errors = await validateDto({
      qualificationQuestions: [{ key: 'urgency', label: 'Urgency', enabled: 'yes' }],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

