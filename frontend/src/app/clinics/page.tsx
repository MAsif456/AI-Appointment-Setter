import ClinicList from "@/components/EditClinicsDetails/ClinicList";
import ClinicDetail from "@/components/EditClinicsDetails/ClinicDetail";
import type { Clinic } from "@/components/EditClinicsDetails/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Fetches every clinic from the API.
 * Returns an empty array on any error so the page still renders.
 */
async function fetchClinics(): Promise<Clinic[]> {
  try {
    const res = await fetch(`${API_URL}/clinics`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/**
 * Fetches a single clinic by its MongoDB ID.
 * Returns null if the clinic is not found or the request fails.
 * @param id - The clinic's MongoDB ObjectId string.
 */
async function fetchClinic(id: string): Promise<Clinic | null> {
  const res = await fetch(`${API_URL}/clinics/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

type PageProps = {
  searchParams: Promise<{ clinicId?: string }>;
};

export default async function ClinicsPage({ searchParams }: PageProps) {
  const { clinicId } = await searchParams;

  if (clinicId) {
    const clinic = await fetchClinic(clinicId);
    if (!clinic) return <p>Clinic not found.</p>;
    return <ClinicDetail initialClinic={clinic} />;
  }

  const clinics = await fetchClinics();
  return <ClinicList clinics={clinics} />;
}
