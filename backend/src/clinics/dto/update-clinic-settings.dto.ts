export interface BusinessHoursDto {
  day: string;
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
}

export interface ServiceAreaDto {
  postcodePrefix: string;
  description?: string;
}

export interface UpdateClinicSettingsDto {
  name?: string;
  address?: string;
  phone?: string;
  ghlLocationId?: string;
  serviceAreas?: ServiceAreaDto[];
  businessHours?: BusinessHoursDto[];
}

