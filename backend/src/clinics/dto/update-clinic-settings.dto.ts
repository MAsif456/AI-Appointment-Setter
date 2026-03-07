/**
 * DTOs for the PATCH /clinics/:id/settings endpoint.
 *
 * All fields are optional; only the fields included in the request body
 * will be applied to the clinic document in the database.
 */

/** Shape of a single day's opening hours inside the request body. */
export interface BusinessHoursDto {
  day: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

/** Shape of a single service area entry inside the request body. */
export interface ServiceAreaDto {
  postcodePrefix: string;
  description?: string;
}

/** Request body accepted by PATCH /clinics/:id/settings. */
export interface UpdateClinicSettingsDto {
  name?: string;
  address?: string;
  phone?: string;
  ghlLocationId?: string;
  serviceAreas?: ServiceAreaDto[];
  businessHours?: BusinessHoursDto[];
}

