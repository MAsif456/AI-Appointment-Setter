export interface ConfirmationDetails {
  clinicName: string;
  clinicAddress?: string;
  appointmentDate: string;
  appointmentTime: string;
  itemsToBring?: string;
}

/**
 * Builds a concise booking confirmation message for SMS/chat delivery.
 * @param {ConfirmationDetails} details - The appointment and clinic details.
 * @returns {string} - The formatted confirmation message.
 */
export function buildConfirmationMessage(details: ConfirmationDetails): string {
  const lines: string[] = [];

  lines.push("Appointment Confirmed!");
  lines.push("");
  lines.push(`${details.appointmentDate} at ${details.appointmentTime}`);
  lines.push(`${details.clinicName}`);

  if (details.clinicAddress) {
    lines.push(details.clinicAddress);
  }

  if (details.itemsToBring) {
    lines.push("");
    lines.push(`Please bring: ${details.itemsToBring}`);
  }

  lines.push("");
  lines.push("Need to reschedule or cancel? Just reply to this message.");

  return lines.join("\n");
}

/**
 * Formats an ISO 8601 datetime string into British English date and time.
 * @param {string} datetime - ISO 8601 datetime string.
 * @returns {{ date: string; time: string }} - Formatted date and time strings.
 */
export function formatDateBritish(datetime: string): {
  date: string;
  time: string;
} {
  const d = new Date(datetime);

  // Use Europe/London so BST/GMT is handled automatically regardless of server timezone
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';

  const dayName = get('weekday');
  const dayNum = parseInt(get('day'), 10);
  const monthName = get('month');
  const suffix = getDaySuffix(dayNum);

  const hour = get('hour');
  const minute = get('minute');
  const dayPeriod = get('dayPeriod').toUpperCase(); // 'am'→'AM'
  const timeStr =
    minute === '00'
      ? `${hour}:00 ${dayPeriod}`
      : `${hour}:${minute} ${dayPeriod}`;

  return {
    date: `${dayName} ${dayNum}${suffix} ${monthName}`,
    time: timeStr,
  };
}

/**
 * Returns the day suffix for a given day number (1-31).
 * @example getDaySuffix(1) // "st"
 * @example getDaySuffix(2) // "nd"
 * @example getDaySuffix(3) // "rd"
 * @example getDaySuffix(11) // "th"
 * @example getDaySuffix(12) // "th"
 * @example getDaySuffix(13) // "th"
 * @example getDaySuffix(14) // "th"
 */
function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
