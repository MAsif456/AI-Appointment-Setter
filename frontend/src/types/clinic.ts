/**
 * Type definitions for clinic entities and AI configuration.
 * These types model the data structures used across the clinic detail pages.
 */

/** Possible tones the AI can adopt when interacting with patients. */
export type AITone = 'friendly' | 'professional' | 'balanced';

/** A qualification question the AI can ask during conversations. */
export interface QualificationQuestion {
  key: string;
  label: string;
  enabled: boolean;
}

/** AI settings response shape matching the backend API. */
export interface AISettings {
  tone: AITone;
  greetingTemplate: string;
  qualificationQuestions: QualificationQuestion[];
  customInstructions: string;
}

/** Services and location data for a clinic. */
export interface ServicesAndLocations {
  servicesOffered: string[];
  serviceAreaPrefixes: string[];
}

/** Status of a clinic — determines visibility and behaviour. */
export type ClinicStatus = 'active' | 'inactive' | 'pending';

/** Shape of a service area object. */
export interface ServiceArea {
  postcodePrefix: string;
  description?: string;
}

/** A service offered by the clinic (e.g. "Sports injury" · 30 min). */
export interface Service {
  name: string;
  durationMinutes?: number;
  price?: number;
  description?: string;
}

/** Shape of a single day's business hours. */
export interface BusinessHours {
  day: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

/** Shape of a clinic object returned by the backend API. */
export interface Clinic {
  _id: string;
  name: string;
  ghlLocationId: string;
  ghlCalendarId: string;
  address?: string;
  phone?: string;
  email?: string;
  serviceAreas: ServiceArea[];
  services?: Service[];
  businessHours: BusinessHours[];
  todayLeadsCount: number;
  todayBookingsCount: number;
  monthLeadsCount: number;
  monthBookingsCount: number;
  isActive: boolean;
  defaultAppointmentDuration: number;
  dataRetentionMonths?: number;
  createdAt: string;
  updatedAt: string;
}
