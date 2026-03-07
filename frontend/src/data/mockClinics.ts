/**
 * Mock clinic data — retained as a reference / fallback.
 * The application now fetches real data from the backend API.
 */

/** Legacy mock clinics (untyped to avoid coupling to the updated Clinic interface). */
export const mockClinics = [
  {
    _id: '1',
    name: 'Newport Sports Clinic',
    isActive: true,
  },
  {
    _id: '2',
    name: 'Cardiff Wellness Centre',
    isActive: true,
  },
];
