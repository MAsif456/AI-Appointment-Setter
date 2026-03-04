import Link from 'next/link';
import { mockClinics } from '@/data/mockClinics';

/**
 * Clinics listing page. Displays all clinics as clickable cards.
 * Each card links to the clinic's detail view.
 */
export default function ClinicsPage() {
  return (
    <div>
      <h1>Clinics</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
        {mockClinics.map((clinic) => (
          <Link
            key={clinic.id}
            href={`/clinics/${clinic.id}/ai-configuration`}
            style={{
              display: 'block',
              padding: 16,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#1a1a2e',
            }}
          >
            <strong>{clinic.name}</strong>
            <span style={{
              marginLeft: 10,
              padding: '2px 10px',
              background: clinic.status === 'active' ? '#dcfce7' : '#f3f4f6',
              color: clinic.status === 'active' ? '#16a34a' : '#6b7280',
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
            }}>
              {clinic.status.charAt(0).toUpperCase() + clinic.status.slice(1)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
