import ClinicDetailHeader from '@/components/ClinicDetail/ClinicDetailHeader';
import ClinicDetailTabs from '@/components/ClinicDetail/ClinicDetailTabs';
import { getClinicById } from '@/data/mockClinics';
import { notFound } from 'next/navigation';

/** Route params shape for the [id] dynamic segment. */
interface ClinicLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

/**
 * Shared layout for all clinic detail sub-pages.
 * Renders the header (name, status, actions) and tab navigation,
 * then the active tab's content below.
 */
export default async function ClinicDetailLayout({ children, params }: ClinicLayoutProps) {
  const { id } = await params;
  const clinic = getClinicById(id);

  // Show 404 if the clinic doesn't exist
  if (!clinic) return notFound();

  return (
    <div>
      <ClinicDetailHeader name={clinic.name} status={clinic.status} />
      <ClinicDetailTabs clinicId={id} />
      {children}
    </div>
  );
}
