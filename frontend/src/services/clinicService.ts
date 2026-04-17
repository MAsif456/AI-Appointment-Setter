import type { WeekHours } from '@/components/clinics/BusinessHoursSection';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface ClinicFormData {
  clinicName: string;
  address: string;
  phoneNumber: string;
  ghlLocationId: string;
  ghlCalendarId: string;
  serviceAreas: string;
  servicesOffered: string;
  appointmentDuration: number;
  dataRetentionMonths: number;
  businessHours: WeekHours;
}

export interface ApiError {
  status: number;
  message: string;
}

/** Transform the flat frontend form state into the shape the backend DTO expects. */
function toCreateClinicPayload(data: ClinicFormData) {
  const serviceAreas = data.serviceAreas
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .map((postcodePrefix) => ({ postcodePrefix }));

  const services = data.servicesOffered
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name }));

  const businessHours = Object.entries(data.businessHours).map(
    ([day, hours]) => ({
      day: day.toLowerCase(),
      isOpen: hours.open,
      openTime: hours.start,
      closeTime: hours.end,
    }),
  );

  return {
    name: data.clinicName,
    ghlLocationId: data.ghlLocationId,
    ghlCalendarId: data.ghlCalendarId,
    address: data.address || undefined,
    phone: data.phoneNumber || undefined,
    defaultAppointmentDuration: data.appointmentDuration,
    serviceAreas: serviceAreas.length > 0 ? serviceAreas : undefined,
    services: services.length > 0 ? services : undefined,
    businessHours,
  };
}

/** POST a new clinic to the backend. Throws an ApiError on failure. */
export async function createClinic(data: ClinicFormData) {
  const response = await fetch(`${API_BASE}/clinics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toCreateClinicPayload(data)),
  });

  const body = await response.json();

  if (!response.ok) {
    const error: ApiError = {
      status: response.status,
      message: body.message ?? 'Something went wrong',
    };
    throw error;
  }

  return body;
}
