/**
 * Shared helpers and constants for AIConfigurationPage tests.
 *
 * NOTE: jest.mock() calls must remain in each test file because
 * Jest hoists them at compile time and they only work at the top
 * level of test modules.
 */
import { waitFor, screen } from '@testing-library/react';

export const defaultSettings = {
  tone: 'friendly' as const,
  greetingTemplate: 'Hello {{firstName}}! Welcome to {{clinicName}}.',
  qualificationQuestions: [
    { key: 'urgency', label: 'Urgency', enabled: true },
    { key: 'preferred_time', label: 'Preferred time of day', enabled: true },
  ],
  customInstructions: '',
};

/**
 * Common beforeEach/afterEach hooks for AI configuration tests.
 * Call this inside a describe() block.
 */
export function useAiConfigSetup(
  mockFetchAiSettings: jest.Mock,
  mockSaveAiSettings: jest.Mock,
) {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchAiSettings.mockReset();
    mockSaveAiSettings.mockReset();
    mockFetchAiSettings.mockResolvedValue({ ...defaultSettings });
  });

  afterEach(() => {
    jest.useRealTimers();
  });
}

/**
 * Waits for the page to finish loading by checking for the Tone heading.
 */
export async function waitForPageLoad() {
  await waitFor(() => {
    expect(screen.getByText('Tone')).toBeTruthy();
  });
}
