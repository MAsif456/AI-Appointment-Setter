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
export function buildConfirmationMessage(
  details: ConfirmationDetails,
): string {
  const lines: string[] = [];

  lines.push('Appointment Confirmed!');
  lines.push('');
  lines.push(`${details.appointmentDate} at ${details.appointmentTime}`);
  lines.push(`${details.clinicName}`);

  if (details.clinicAddress) {
    lines.push(details.clinicAddress);
  }

  if (details.itemsToBring) {
    lines.push('');
    lines.push(`Please bring: ${details.itemsToBring}`);
  }

  lines.push('');
  lines.push('Need to reschedule or cancel? Just reply to this message.');

  return lines.join('\n');
}

/**
 * Formats an ISO 8601 datetime string into British English date and time.
 * @param {string} datetime - ISO 8601 datetime string.
 * @returns {{ date: string; time: string }} - Formatted date and time strings.
 */
export function formatDateBritish(
  datetime: string,
): { date: string; time: string } {
  const d = new Date(datetime);

  const days = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday',
  ];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const dayName = days[d.getUTCDay()];
  const dayNum = d.getUTCDate();
  const suffix = getDaySuffix(dayNum);
  const monthName = months[d.getUTCMonth()];

  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const timeStr = minutes === 0
    ? `${displayHour}:00 ${ampm}`
    : `${displayHour}:${minutes.toString().padStart(2, '0')} ${ampm}`;

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
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
