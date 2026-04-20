import type { ComponentType } from 'react';
import {
  BookingPhaseIcon,
  ConfirmedPhaseIcon,
  QualifiedPhaseIcon,
  DeclinedPhaseIcon,
} from '@/components/Icons';

/** Shape of a conversation returned by the API. */
export interface Conversation {
  _id: string;
  phase: string;
  isHighPriority: boolean;
  lastMessageAt: string | null;
  clinicId: { _id: string; name: string } | null;
  leadId: { _id: string; firstName: string; lastName: string; phone: string } | null;
  channel: string;
}

/** Maps each phase to its distinct icon component. */
export const PHASE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  booking: BookingPhaseIcon,
  booked: ConfirmedPhaseIcon,
  confirmed: ConfirmedPhaseIcon,
  qualified: QualifiedPhaseIcon,
  declined: DeclinedPhaseIcon,
  cancelled: DeclinedPhaseIcon,
  escalated: DeclinedPhaseIcon,
  stalled: DeclinedPhaseIcon,
};

/** Phases that always appear in the filter dropdown. */
export const KNOWN_PHASES = [
  'greeting', 'qualifying', 'qualified', 'booking',
  'confirmed', 'declined', 'escalated',
];

export const ITEMS_PER_PAGE = 10;

/** Capitalises the first letter of a phase for display. */
export function formatPhase(phase: string): string {
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/**
 * Returns a human-readable relative time string for a message timestamp.
 * @param timestamp - ISO date string or null
 */
export function formatTime(timestamp: string | null): string {
  if (!timestamp) return 'No messages yet';

  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

/** Builds the full patient name from a conversation's lead data. */
export function getPatientName(conv: Conversation): string {
  if (!conv.leadId) return 'Unknown';
  return [conv.leadId.firstName, conv.leadId.lastName].filter(Boolean).join(' ') || 'Unknown';
}
