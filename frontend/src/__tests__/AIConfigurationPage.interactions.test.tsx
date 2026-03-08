/**
 * Tests for AI Configuration page user interactions and save behaviour.
 *
 * Covers: selecting tone, editing greeting, toggling questions,
 * typing custom instructions, save success/error toasts,
 * disabled button while saving, correct payload, and toast auto-dismiss.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('AIConfigurationPage – interactions & save', () => {
  useAiConfigSetup(mockFetchAiSettings, mockSaveAiSettings);

  it('should allow selecting a different tone', async () => {
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    const professionalRadio = screen.getByDisplayValue('professional') as HTMLInputElement;
    fireEvent.click(professionalRadio);
    expect(professionalRadio.checked).toBe(true);
  });

  it('should allow editing the greeting template', async () => {
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    const textareas = screen.getAllByRole('textbox');
    const greetingTextarea = textareas.find(
      (el) => (el as HTMLTextAreaElement).value === defaultSettings.greetingTemplate,
    ) as HTMLTextAreaElement;

    fireEvent.change(greetingTextarea, {
      target: { value: 'Hi {{firstName}}, welcome!' },
    });
    expect(greetingTextarea.value).toBe('Hi {{firstName}}, welcome!');
  });

  it('should allow toggling qualification questions', async () => {
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    const checkboxes = screen.getAllByRole('checkbox');
    const urgencyCheckbox = checkboxes[0] as HTMLInputElement;
    expect(urgencyCheckbox.checked).toBe(true);

    fireEvent.click(urgencyCheckbox);
    expect(urgencyCheckbox.checked).toBe(false);
  });

  it('should allow typing custom instructions', async () => {
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    const textareas = screen.getAllByRole('textbox');
    const instructionsTextarea = textareas.find(
      (el) => (el as HTMLTextAreaElement).value === '',
    ) as HTMLTextAreaElement;

    fireEvent.change(instructionsTextarea, {
      target: { value: 'Always mention free parking' },
    });
    expect(instructionsTextarea.value).toBe('Always mention free parking');
  });

  it('should show success toast after saving settings', async () => {
    mockSaveAiSettings.mockResolvedValue({ ...defaultSettings });
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully')).toBeTruthy();
    });
    expect(mockSaveAiSettings).toHaveBeenCalledTimes(1);
  });

  it('should show error toast when save fails', async () => {
    mockSaveAiSettings.mockRejectedValue(new Error('Validation failed'));
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeTruthy();
    });
  });

  it('should show generic error message for non-Error exceptions', async () => {
    mockSaveAiSettings.mockRejectedValue('unknown error');
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to save settings')).toBeTruthy();
    });
  });

  it('should disable save button while saving', async () => {
    mockSaveAiSettings.mockReturnValue(new Promise(() => {}));
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      const savingButton = screen.getByRole('button', { name: /saving/i });
      expect(savingButton).toBeDisabled();
    });
  });

  it('should send current form state when saving', async () => {
    mockSaveAiSettings.mockResolvedValue({ ...defaultSettings });
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    // Change tone to professional
    fireEvent.click(screen.getByDisplayValue('professional'));

    // Disable "Preferred time of day" question
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    // Add custom instructions
    const textareas = screen.getAllByRole('textbox');
    const instructionsTextarea = textareas.find(
      (el) => (el as HTMLTextAreaElement).value === '',
    ) as HTMLTextAreaElement;
    fireEvent.change(instructionsTextarea, {
      target: { value: 'Always mention free parking' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(mockSaveAiSettings).toHaveBeenCalledWith('clinic_123', {
        tone: 'professional',
        greetingTemplate: defaultSettings.greetingTemplate,
        qualificationQuestions: [
          { key: 'urgency', label: 'Urgency', enabled: true },
          { key: 'preferred_time', label: 'Preferred time of day', enabled: false },
        ],
        customInstructions: 'Always mention free parking',
      });
    });
  });

  it('should auto-dismiss toast after 4 seconds', async () => {
    mockSaveAiSettings.mockResolvedValue({ ...defaultSettings });
    render(<AIConfigurationPage />);
    await waitForPageLoad();

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully')).toBeTruthy();
    });

    jest.advanceTimersByTime(4000);

    await waitFor(() => {
      expect(screen.queryByText('Settings saved successfully')).toBeNull();
    });
  });
});
