/**
 * Typed client for the escalation REST endpoints.
 *
 * While `MOCKS_ENABLED` is on, every method proxies to the in-memory
 * `escalationHandlers` store so Commit 1 can ship without a backend.
 * Commit 2 will flip the flag and the real `apiAxios` calls will take
 * over — no call-site changes required.
 */

import api from '@/lib/apiAxios';
import type {
  EscalationNotification,
  StreamTokenResponse,
} from '@/types/escalation';
import {
  MOCKS_ENABLED,
  acknowledgeMock,
  getMockEscalation,
  listMockEscalations,
  resolveMock,
} from '@/mocks/escalationHandlers';

/** Fetch all unresolved escalations the current staff member can see. */
export async function listUnresolvedEscalations(): Promise<
  EscalationNotification[]
> {
  if (MOCKS_ENABLED) {
    return Promise.resolve(listMockEscalations());
  }
  const res = await api.get('/escalations', {
    params: { unresolved: true },
  });
  return res.data.items;
}

/** Fetch a single escalation along with the embedded chat transcript. */
export async function getEscalation(
  id: string,
): Promise<EscalationNotification | null> {
  if (MOCKS_ENABLED) {
    return Promise.resolve(getMockEscalation(id));
  }
  const res = await api.get(`/escalations/${id}`);
  return res.data;
}

/**
 * Dismiss this escalation for the calling staff member only.
 * Other staff on the same clinic still see it on their bell.
 */
export async function acknowledgeEscalation(id: string): Promise<void> {
  if (MOCKS_ENABLED) {
    acknowledgeMock(id);
    return;
  }
  await api.post(`/escalations/${id}/acknowledge`);
}

/**
 * Mark the escalation resolved clinic-wide. Called when the lead
 * has actually been phoned and the issue is handled.
 */
export async function resolveEscalation(id: string): Promise<void> {
  if (MOCKS_ENABLED) {
    resolveMock(id);
    return;
  }
  await api.post(`/escalations/${id}/resolve`);
}

/**
 * Request a short-lived JWT usable in the SSE stream URL.
 *
 * EventSource cannot send `Authorization` headers, so we fetch a
 * narrow-scoped token and pass it as a query string parameter.
 * The mock implementation returns a throwaway value.
 */
export async function fetchStreamToken(): Promise<StreamTokenResponse> {
  if (MOCKS_ENABLED) {
    return Promise.resolve({ token: 'mock-token', expiresInSec: 60 });
  }
  const res = await api.get('/notifications/stream-token');
  return res.data;
}
