/** Shape of a clinic object returned by the backend API. */
export interface Clinic {
  _id: string;
  name: string;
  address: string;
  serviceAreas: string[];
  leads: number;
  bookings: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
