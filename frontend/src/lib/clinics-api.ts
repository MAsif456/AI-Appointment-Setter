/**
 * API functions for fetching clinic data from the backend.
 */
import { apiFetch } from './api';
import { Clinic } from '@/types/clinic';

/**
 * Fetches all clinics from the backend.
 * @returns Array of clinic summaries
 */
export async function fetchClinics(): Promise<Clinic[]> {
  return apiFetch<Clinic[]>('/clinics');
}

/**
 * Fetches a single clinic by its MongoDB ObjectId.
 * @param clinicId - The clinic's ID
 * @returns The clinic document
 */
export async function fetchClinicById(clinicId: string): Promise<Clinic> {
  return apiFetch<Clinic>(`/clinics/${clinicId}`);
}
