/**
 * HTML email template for appointment reminders.
 * Extracted from reminder.handler to keep that file under 200 lines.
 */
import { format } from 'date-fns';
import { AppointmentDocument } from '../database/schemas/appointment.schema';
import { ClinicDocument } from '../database/schemas/clinic.schema';

/**
 * Generate a professional HTML email reminder.
 * Uses an inline-styled, mobile-friendly layout compatible with all major email clients.
 */
export function generateReminderEmailHtml(
  appointment: AppointmentDocument,
  clinic: ClinicDocument,
  hoursBeforeAppointment: number,
): string {
  const appointmentDate = new Date(appointment.appointmentDate);
  const dayName = format(appointmentDate, 'EEEE');
  const dateFormatted = format(appointmentDate, 'do MMMM yyyy');
  const timeFormatted = appointment.appointmentTime;
  const clinicAddress = clinic.address || '';
  const clinicPhone = (clinic as any).phone || '';

  const daysUntil = Math.floor(hoursBeforeAppointment / 24);
  let urgencyLine: string;
  if (hoursBeforeAppointment === 1) {
    urgencyLine = 'Your appointment is in <strong>1 hour</strong>.';
  } else if (hoursBeforeAppointment === 24) {
    urgencyLine = 'Your appointment is <strong>tomorrow</strong>.';
  } else if (hoursBeforeAppointment === 48) {
    urgencyLine = 'Your appointment is <strong>in 2 days</strong>.';
  } else {
    urgencyLine = `Your appointment is <strong>in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}</strong>.`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Appointment Reminder</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a56db;border-radius:8px 8px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">${clinic.name}</p>
              <p style="margin:8px 0 0;font-size:13px;color:#bfdbfe;">Appointment Reminder</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hello,</p>
              <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${urgencyLine} We look forward to seeing you soon.</p>

              <!-- Appointment details card -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.8px;">Appointment Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
                      <tr>
                        <td style="padding:6px 0;width:36px;vertical-align:top;">
                          <span style="font-size:16px;">📅</span>
                        </td>
                        <td style="padding:6px 0;vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:#6b7280;">Date</p>
                          <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#111827;">${dayName}, ${dateFormatted}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;width:36px;vertical-align:top;">
                          <span style="font-size:16px;">🕐</span>
                        </td>
                        <td style="padding:6px 0;vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:#6b7280;">Time</p>
                          <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#111827;">${timeFormatted}</p>
                        </td>
                      </tr>
                      ${clinicAddress ? `<tr>
                        <td style="padding:6px 0;width:36px;vertical-align:top;">
                          <span style="font-size:16px;">📍</span>
                        </td>
                        <td style="padding:6px 0;vertical-align:top;">
                          <p style="margin:0;font-size:14px;color:#6b7280;">Location</p>
                          <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#111827;">${clinicAddress}</p>
                        </td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
                If you need to reschedule or cancel your appointment, please reply to this email or contact us directly.
              </p>

              ${clinicPhone ? `<p style="margin:0;font-size:14px;color:#374151;">Questions? Call us on <strong>${clinicPhone}</strong>.</p>` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 8px 8px;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                This is an automated reminder from ${clinic.name}.<br/>
                ${clinicAddress ? `${clinicAddress}` : ''}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
