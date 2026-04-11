/**
 * Typed client for the escalation REST endpoints.
 *
 * Proxies directly to the backend via the shared `apiAxios` instance;
 * the Commit-1 MSW-style mock store has been removed now that the
 * NestJS endpoints are live.
 */

import api from '@/lib/apiAxios';
import type {
  EscalationNotification,
  StreamTokenResponse,
} from '@/types/escalation';

/** Fetch all unresolved escalations the current staff member can see. */
export async function listUnresolvedEscalations(): Promise<
  EscalationNotification[]
> {
  const res = await api.get('/escalations', {
    params: { unresolved: true },
  });
  return res.data.items;
}

/** Fetch a single escalation along with the embedded chat transcript. */
export async function getEscalation(
  id: string,
): Promise<EscalationNotification | null> {
  const res = await api.get(`/escalations/${id}`);
  return res.data;
}

/**
 * Dismiss this escalation for the calling staff member only.
 * Other staff on the same clinic still see it on their bell.
 */
export async function acknowledgeEscalation(id: string): Promise<void> {
  await api.post(`/escalations/${id}/acknowledge`);
}

/**
 * Mark the escalation resolved clinic-wide. Called when the lead
 * has actually been phoned and the issue is handled.
 */
export async function resolveEscalation(id: string): Promise<void> {
  await api.post(`/escalations/${id}/resolve`);
}

/**
 * Request a short-lived JWT usable in the SSE stream URL.
 *
 * EventSource cannot send `Authorization` headers, so we fetch a
 * narrow-scoped token and pass it as a query string parameter.
 */
export async function fetchStreamToken(): Promise<StreamTokenResponse> {
  const res = await api.get('/notifications/stream-token');
  return res.data;
}
