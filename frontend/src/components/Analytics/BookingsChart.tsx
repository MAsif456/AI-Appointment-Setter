'use client';

import dynamic from 'next/dynamic';
import type { DailyDataPoint } from '@/types/analytics';
import styles from './BookingsChart.module.css';

// Dynamically import Recharts to avoid SSR issues with browser-dependent SVG APIs
const LineChart = dynamic(() => import('recharts').then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import('recharts').then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(
  () => import('recharts').then((m) => m.ResponsiveContainer),
  { ssr: false },
);

interface BookingsChartProps {
  /** Array of daily data points for the line chart. */
  data: DailyDataPoint[];
  /** Optional chart title displayed above the chart. */
  title?: string;
}

/**
 * Line chart component for displaying bookings over time.
 * Uses Recharts with dynamic imports to prevent SSR hydration issues.
 */
export default function BookingsChart({ data, title = 'Bookings Over Time' }: BookingsChartProps) {
  /** Formats ISO date strings to shorter display labels (e.g. 'Mar 20'). */
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  };

  const formattedData = data.map((d) => ({ ...d, label: formatDate(d.date) }));

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.chartWrapper}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#4361ee"
              strokeWidth={2}
              dot={{ fill: '#4361ee', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
