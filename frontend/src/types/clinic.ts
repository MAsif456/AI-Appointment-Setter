/**
 * Type definitions for clinic entities and AI configuration.
 * These types model the data structures used across the clinic detail pages.
 */

/** Possible tones the AI can adopt when interacting with patients. */
export type AITone = 'friendly' | 'professional' | 'balanced';

/** A qualification question the AI can ask during conversations. */
export interface QualificationQuestion {
  id: string;
  label: string;
  enabled: boolean;
  required: boolean;
}

/** AI configuration settings for a specific clinic. */
export interface AIConfiguration {
  tone: AITone;
  greetingMessage: string;
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

/** Top-level clinic entity combining identity, AI config, and services. */
export interface Clinic {
  id: string;
  name: string;
  status: ClinicStatus;
  aiConfiguration: AIConfiguration;
  services: ServicesAndLocations;
}
