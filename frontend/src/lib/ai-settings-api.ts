/**
 * API functions for fetching and updating clinic AI settings.
 * Wraps the generic apiFetch helper with typed clinic-specific calls.
 */
import { apiFetch } from './api';
import { AISettings } from '@/types/clinic';

/**
 * Fetches the current AI settings for a specific clinic.
 * @param clinicId - The MongoDB ObjectId of the clinic
 * @returns The clinic's AI settings with server-applied defaults
 */
export async function fetchAiSettings(clinicId: string): Promise<AISettings> {
  return apiFetch<AISettings>(`/api/clinics/${clinicId}/ai-settings`);
}

/**
 * Saves updated AI settings for a specific clinic.
 * @param clinicId - The MongoDB ObjectId of the clinic
 * @param settings - The AI settings fields to update
 * @returns The updated AI settings from the server
 */
export async function saveAiSettings(
  clinicId: string,
  settings: Partial<AISettings>,
): Promise<AISettings> {
  return apiFetch<AISettings>(`/api/clinics/${clinicId}/ai-settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
