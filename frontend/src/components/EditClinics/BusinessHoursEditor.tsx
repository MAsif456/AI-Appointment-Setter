import styles from "./clinics.module.css";
import type { BusinessHours } from "./types";
import { DAYS_ORDER, capitalizeDay } from "./utils";

type Props = {
  value: BusinessHours[];
  onChange: (hours: BusinessHours[]) => void;
};

export default function BusinessHoursEditor({ value, onChange }: Props) {
  const orderedDays = DAYS_ORDER;

  const hoursByDay = new Map((value ?? []).map((b) => [b.day, b]));

  const handleChange = (
    day: string,
    field: "isOpen" | "openTime" | "closeTime",
    newValue: boolean | string
  ) => {
    const existing = value ?? [];
    const idx = existing.findIndex((b) => b.day === day);
    const current =
      idx >= 0
        ? existing[idx]
        : {
            day,
            isOpen: false,
          };

    const updated: BusinessHours = {
      ...current,
      [field]: newValue,
    };

    const next = [...existing];
    if (idx >= 0) {
      next[idx] = updated;
    } else {
      next.push(updated);
    }

    onChange(next);
  };

  return (
    <table className={styles.hoursTable}>
      <thead>
        <tr>
          <th>Day</th>
          <th>Open</th>
          <th>From</th>
          <th>To</th>
        </tr>
      </thead>
      <tbody>
        {orderedDays.map((day) => {
          const row =
            hoursByDay.get(day) ?? ({
              day,
              isOpen: false,
              openTime: "",
              closeTime: "",
            } as BusinessHours);

          return (
            <tr key={day}>
              <td>{capitalizeDay(day)}</td>
              <td>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={row.isOpen}
                  onChange={(e) =>
                    handleChange(day, "isOpen", e.target.checked)
                  }
                />
              </td>
              <td>
                <input
                  type="time"
                  className={styles.timeInput}
                  value={row.openTime ?? ""}
                  onChange={(e) =>
                    handleChange(day, "openTime", e.target.value)
                  }
                  disabled={!row.isOpen}
                />
              </td>
              <td>
                <input
                  type="time"
                  className={styles.timeInput}
                  value={row.closeTime ?? ""}
                  onChange={(e) =>
                    handleChange(day, "closeTime", e.target.value)
                  }
                  disabled={!row.isOpen}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

