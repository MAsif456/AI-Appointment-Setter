'use client';

import FormCard from '@/components/FormCard/FormCard';
import styles from './BusinessHoursSection.module.css';

export interface DayHours {
  open: boolean;
  start: string;
  end: string;
}

export type WeekHours = Record<string, DayHours>;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface BusinessHoursSectionProps {
  hours: WeekHours;
  onChange: (day: string, field: keyof DayHours, value: string | boolean) => void;
}

/** Weekly business hours editor with open/close toggles and time inputs per day. */
export default function BusinessHoursSection({ hours, onChange }: BusinessHoursSectionProps) {
  return (
    <FormCard title="Business Hours">
      {DAYS.map((day) => {
        const dayKey = day in hours ? day : day.toLowerCase();
        const dayHours =
          hours[dayKey] ??
          hours[day] ??
          hours[day.toLowerCase()] ?? {
            open: false,
            start: '09:00',
            end: '17:00',
          };
        return (
          <div key={day} className={styles.row}>
            <span className={styles.dayName}>{day}</span>
            <input
              className={styles.timeInput}
              type="time"
              value={dayHours.start}
              disabled={!dayHours.open}
              onChange={(e) => onChange(dayKey, 'start', e.target.value)}
            />
            <span className={styles.toLabel}>to</span>
            <input
              className={styles.timeInput}
              type="time"
              value={dayHours.end}
              disabled={!dayHours.open}
              onChange={(e) => onChange(dayKey, 'end', e.target.value)}
            />
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={dayHours.open}
                onChange={(e) => onChange(dayKey, 'open', e.target.checked)}
                className={styles.checkbox}
              />
              Open
            </label>
          </div>
        );
      })}
    </FormCard>
  );
}
