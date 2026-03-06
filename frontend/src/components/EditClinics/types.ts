export type ServiceArea = {
  postcodePrefix: string;
  description?: string;
};

export type BusinessHours = {
  day: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
};

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

