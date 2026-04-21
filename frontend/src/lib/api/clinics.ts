import { Clinic } from '@/types/clinic';
import api from '@/lib/apiAxios';

/** Base URL for the backend API. Falls back to localhost for local development. */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Fetches all clinics, optionally filtered by a search term.
 * @param search - partial clinic name to filter by
 */
export async function getClinics(search?: string): Promise<Clinic[]> {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await fetch(`${API_URL}/clinics${params}`);

  if (!res.ok) {
    throw new Error('Failed to fetch clinics');
  }

  return res.json();
}

/**
 * Fetches a single clinic by its id.
 * @param id - the clinic's MongoDB _id
 */
export async function getClinicById(id: string): Promise<Clinic> {
  const res = await fetch(`${API_URL}/clinics/${id}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch clinic ${id}`);
  }

  return res.json();
}

/**
 * Deactivates a clinic (sets isActive to false).
 * @param id - the clinic's MongoDB _id
 */
export async function deactivateClinic(id: string): Promise<Clinic> {
  const res = await fetch(`${API_URL}/clinics/${id}/deactivate`, {
    method: 'PATCH',
  });

  if (!res.ok) {
    throw new Error(`Failed to deactivate clinic ${id}`);
  }

  return res.json();
}

/**
 * Activates a clinic (sets isActive to true).
 * @param id - the clinic's MongoDB _id
 */
export async function activateClinic(id: string): Promise<Clinic> {
  const res = await fetch(`${API_URL}/clinics/${id}/activate`, {
    method: 'PATCH',
  });

  if (!res.ok) {
    throw new Error(`Failed to activate clinic ${id}`);
  }

  return res.json();
}

/**
 * Updates a clinic's basic settings (name, address, phone, etc.).
 * Only fields present in the body are applied.
 * @param id - the clinic's MongoDB _id
 * @param settings - partial settings to update
 */
export async function updateClinicSettings(
  id: string,
  settings: Partial<Clinic>,
): Promise<Clinic> {
  const res = await fetch(`${API_URL}/clinics/${id}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });

  if (!res.ok) {
    throw new Error(`Failed to update clinic settings for ${id}`);
  }

  return res.json();
}

/**
 * Saves a per-clinic GHL API key (and optional webhook URL).
 * The backend validates the key against GHL before storing it encrypted.
 * Uses apiAxios so the JWT token is automatically attached.
 * @throws Error with the backend message if the key is rejected.
 */
export async function updateClinicIntegration(
  id: string,
  ghlApiKey: string,
  webhookUrl?: string,
): Promise<void> {
  try {
    await api.put(`/clinics/${id}/integrations`, {
      ghlApiKey,
      ...(webhookUrl ? { webhookUrl } : {}),
    });
  } catch (err: any) {
    const message =
      err?.response?.data?.message ??
      err?.message ??
      'Failed to update integration settings';
    throw new Error(Array.isArray(message) ? message[0] : message);
  }
}

/**
 * Tests the stored GHL API key for a clinic against the live GHL API.
 * Uses apiAxios so the JWT token is automatically attached.
 * @returns `{ connected: boolean }`
 */
export async function testClinicIntegration(
  id: string,
): Promise<{ connected: boolean }> {
  const res = await api.post<{ connected: boolean }>(
    `/clinics/${id}/integrations/test`,
  );
  return res.data;
}

/**
 * Removes the stored GHL API key and webhook URL for a clinic.
 * Uses apiAxios so the JWT token is automatically attached.
 */
export async function disconnectClinicIntegration(id: string): Promise<void> {
  await api.delete(`/clinics/${id}/integrations`);
}
