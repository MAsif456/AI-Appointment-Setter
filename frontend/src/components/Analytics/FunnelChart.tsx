'use client';

import dynamic from 'next/dynamic';
import type { ConversionFunnel } from '@/types/analytics';
import styles from './FunnelChart.module.css';

// Dynamically import Recharts to avoid SSR issues with browser-dependent SVG APIs
const BarChart = dynamic(() => import('recharts').then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false });

interface FunnelChartProps {
  /** Funnel stage counts. */
  funnel: ConversionFunnel;
}

/** Colour mapping for each funnel stage. */
const STAGE_COLOURS = ['#111827', '#2ec4b6', '#9b5de5', '#00b894'];

/**
 * Horizontal bar chart showing the conversion funnel.
 * Uses Recharts BarChart with vertical layout for axis-based visualisation.
 */
export default function FunnelChart({ funnel }: FunnelChartProps) {
  const data = [
    { name: 'Leads', value: funnel.leads },
    { name: 'Qualified', value: funnel.qualified },
    { name: 'Booking Started', value: funnel.bookingStarted },
    { name: 'Booked', value: funnel.booked },
  ];

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Conversion Funnel</h3>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 14, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={STAGE_COLOURS[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
