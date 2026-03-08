/** Shape of a service area object. */
export interface ServiceArea {
  postcodePrefix: string;
  description?: string;
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
  todayLeadsCount: number;
  todayBookingsCount: number;
  monthLeadsCount: number;
  monthBookingsCount: number;
  isActive: boolean;
  defaultAppointmentDuration: number;
  createdAt: string;
  updatedAt: string;
}
