import ClinicList from "@/components/EditClinics/ClinicList";
import ClinicDetail from "@/components/EditClinics/ClinicDetail";
import type { Clinic } from "@/components/EditClinics/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchClinics(): Promise<Clinic[]> {
  try {
    const res = await fetch(`${API_URL}/clinics`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

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
