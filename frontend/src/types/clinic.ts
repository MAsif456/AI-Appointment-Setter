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

/** Top-level clinic entity used for listing and detail views. */
export interface Clinic {
  _id: string;
  name: string;
  isActive: boolean;
}
