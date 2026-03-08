import { Clinic } from '@/types/clinic';

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
