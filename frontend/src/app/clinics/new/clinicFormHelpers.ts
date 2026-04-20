import type { WeekHours } from '@/components/clinics/BusinessHoursSection';

/** Default business hours — weekdays open 09:00–17:00, weekends closed. */
export function getDefaultHours(): WeekHours {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours: WeekHours = {};
  for (const day of days) {
    hours[day] = {
      open: !['Saturday', 'Sunday'].includes(day),
      start: '09:00',
      end: '17:00',
    };
  }
  return hours;
}

/** Form values used by the add clinic page. */
export interface ClinicFormValues {
  clinicName: string;
  address: string;
  phoneNumber: string;
  ghlLocationId: string;
  ghlCalendarId: string;
  serviceAreas: string[];
}

/**
 * Validates the required clinic form fields.
 * Returns a record of field-name to error message.
 * An empty record means all fields are valid.
 */
export function validateClinicForm(values: ClinicFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.clinicName.trim()) {
    errors.clinicName = 'Clinic name is required';
  } else if (values.clinicName.trim().length < 2) {
    errors.clinicName = 'Clinic name must be at least 2 characters';
  }

  if (!values.ghlLocationId.trim()) {
    errors.ghlLocationId = 'GHL Location ID is required';
  } else if (!/^[a-zA-Z0-9_]+$/.test(values.ghlLocationId.trim())) {
    errors.ghlLocationId = 'GHL Location ID must be alphanumeric';
  }

  if (!values.ghlCalendarId.trim()) {
    errors.ghlCalendarId = 'GHL Calendar ID is required';
  } else if (!/^[a-zA-Z0-9_]+$/.test(values.ghlCalendarId.trim())) {
    errors.ghlCalendarId = 'GHL Calendar ID must be alphanumeric';
  }

  if (!values.address.trim()) {
    errors.address = 'Address is required';
  }

  if (!values.phoneNumber.trim()) {
    errors.phoneNumber = 'Phone number is required';
  } else if (!/^(\+44\s?|0)\d[\d\s]{8,12}$/.test(values.phoneNumber.trim())) {
    errors.phoneNumber = 'Enter a valid UK phone number (e.g. 029 2034 5678 or +44 29 2034 5678)';
  }

  if (values.serviceAreas.length === 0) {
    errors.serviceAreas = 'At least one service area is required';
  } else {
    const invalid = values.serviceAreas.find((p) => !/^[A-Z]{1,4}$/.test(p));
    if (invalid) {
      errors.serviceAreas = `"${invalid}" is not a valid postcode prefix (e.g. CF, NP, SA)`;
    }
  }

  return errors;
}
