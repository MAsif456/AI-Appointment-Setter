
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { defaultSettings, useAiConfigSetup, waitForPageLoad } from './AIConfigurationPage.setup';

const mockFetchAiSettings = jest.fn();
const mockSaveAiSettings = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'clinic_123' }),
}));

jest.mock('@/lib/ai-settings-api', () => ({
  fetchAiSettings: (...args: unknown[]) => mockFetchAiSettings(...args),
  saveAiSettings: (...args: unknown[]) => mockSaveAiSettings(...args),
}));

import AIConfigurationPage from '@/app/clinics/[id]/ai-configuration/page';

/**
 * Tests for AIConfigurationPage loading, rendering, and population of form elements with fetched settings.
 */
describe('AIConfigurationPage – loading & rendering', () => {
  useAiConfigSetup(mockFetchAiSettings, mockSaveAiSettings);

  /**
   * Verifies that the page renders a loading state while fetching settings.
   */
  it('should show loading state while fetching settings', () => {
    mockFetchAiSettings.mockReturnValue(new Promise(() => {}));
    render(<AIConfigurationPage />);
    expect(screen.getByText(/loading ai settings/i)).toBeTruthy();
  });

  /**
   * Verifies that the page renders an error state when fetching settings fails.
   */
  it('should show error state when fetch fails', async () => {
    mockFetchAiSettings.mockRejectedValue(new Error('Network error'));
    render(<AIConfigurationPage />);

    await waitFor(() => {
      expect(screen.getByText(/error: network error/i)).toBeTruthy();
    });
  });

  /**
   * Verifies that all AI config sections are rendered after loading.
   */
  it('should render all AI config sections after loading', async () => {
    render(<AIConfigurationPage />);

    await waitForPageLoad();
    expect(screen.getByText('Greeting Message')).toBeTruthy();
    expect(screen.getByText('Qualification Questions')).toBeTruthy();
    expect(screen.getByText('Custom Instructions')).toBeTruthy();
    expect(screen.getByRole('button', { name: /save settings/i })).toBeTruthy();
  });

  /**
   * Verifies that the form is populated with fetched settings.
   */
  it('should populate form with fetched settings', async () => {
    render(<AIConfigurationPage />);

    await waitForPageLoad();

    const friendlyRadio = screen.getByDisplayValue('friendly') as HTMLInputElement;
    expect(friendlyRadio.checked).toBe(true);

    const textareas = screen.getAllByRole('textbox');
    const greetingTextarea = textareas.find(
      (el) => (el as HTMLTextAreaElement).value === defaultSettings.greetingTemplate,
    );
    expect(greetingTextarea).toBeTruthy();
  });

  /**
   * Verifies that the fetchSettings function is called with the correct clinic ID.
   */
  it('should fetch settings for the correct clinic ID', async () => {
    render(<AIConfigurationPage />);    await waitFor(() => {
      expect(mockFetchAiSettings).toHaveBeenCalledWith('clinic_123');
    });
  });
});
