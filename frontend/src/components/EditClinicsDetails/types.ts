/** A postcode area that a clinic covers, used to filter which patients the clinic serves. */
export type ServiceArea = {
  postcodePrefix: string;
  description?: string;
};

/** The opening hours for a single day of the week. */
export type BusinessHours = {
  day: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
};

/** A clinic record as returned from the API. */
export type Clinic = {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  ghlLocationId?: string;
  isActive: boolean;
  serviceAreas: ServiceArea[];
  businessHours: BusinessHours[];
  monthLeadsCount: number;
  monthBookingsCount: number;
};

