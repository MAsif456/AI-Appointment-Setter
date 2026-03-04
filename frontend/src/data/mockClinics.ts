/**
 * Mock clinic data for front-end development.
 * Replace with API calls once the backend is ready.
 */

import { Clinic } from '@/types/clinic';

/** Sample clinics matching the prototype designs. */
export const mockClinics: Clinic[] = [
  {
    id: '1',
    name: 'Newport Sports Clinic',
    status: 'active',
    aiConfiguration: {
      tone: 'professional',
      greetingMessage:
        'Good day {{firstName}}, thank you for contacting {{clinicName}}. I can assist you with booking an appointment. May I gather some information?',
      qualificationQuestions: [
        { id: 'postcode', label: 'Postcode', enabled: false, required: true },
        { id: 'urgency', label: 'Urgency', enabled: true, required: false },
        { id: 'preferred-time', label: 'Preferred Time', enabled: false, required: false },
        { id: 'service-type', label: 'Service Type', enabled: true, required: false },
      ],
      customInstructions: 'Emphasize expertise in sports injuries for athletes.',
    },
    services: {
      servicesOffered: ['Sports massage', 'Injury assessment', 'Rehabilitation', 'Performance coaching'],
      serviceAreaPrefixes: ['NP', 'CF'],
    },
  },
  {
    id: '2',
    name: 'Cardiff Wellness Centre',
    status: 'active',
    aiConfiguration: {
      tone: 'friendly',
      greetingMessage:
        'Hi {{firstName}}! Welcome to {{clinicName}}. How can I help you today?',
      qualificationQuestions: [
        { id: 'postcode', label: 'Postcode', enabled: true, required: true },
        { id: 'urgency', label: 'Urgency', enabled: false, required: false },
        { id: 'preferred-time', label: 'Preferred Time', enabled: true, required: false },
        { id: 'service-type', label: 'Service Type', enabled: true, required: false },
      ],
      customInstructions: 'Always mention free parking.',
    },
    services: {
      servicesOffered: ['General physiotherapy', 'Acupuncture', 'Pilates'],
      serviceAreaPrefixes: ['CF'],
    },
  },
];

/**
 * Finds a clinic by its ID from the mock dataset.
 * @param id - The clinic identifier
 * @returns The matching clinic or undefined
 */
export function getClinicById(id: string): Clinic | undefined {
  return mockClinics.find((clinic) => clinic.id === id);
}
