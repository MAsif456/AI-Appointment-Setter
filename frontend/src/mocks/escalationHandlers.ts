/**
 * In-memory mock backend for the escalation feature.
 *
 * Commit 1 ships the frontend ahead of the backend so the UI can be
 * exercised end-to-end against this file. Commit 2 will delete this
 * module and `escalationApi.ts` will fall through to real endpoints.
 *
 * We deliberately avoid pulling MSW into the project for this —
 * a plain in-process store + `setInterval` is enough to prove the
 * UI works, and leaves no runtime cost after the file is removed.
 */

import type { EscalationNotification } from '@/types/escalation';

// Feature-flag the mock mode so Commit 2 can flip one constant off
// rather than touch every call site. Defaulted to `true` for now.
export const MOCKS_ENABLED = true;

// Single source of truth for the mocked queue. Mutated in place so
// that ack/resolve calls from the UI produce visible state changes.
const store: EscalationNotification[] = [
  {
    id: 'mock-1',
    conversationId: 'conv-1',
    leadId: 'lead-1',
    leadName: 'Jane Doe',
    leadPhone: '+447700900123',
    clinicId: 'clinic-1',
    clinicName: 'Smile Dental Bristol',
    trigger: 'failed_understanding',
    reason: '3 consecutive AI comprehension failures',
    createdAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    acknowledgedByMe: false,
    resolvedAt: null,
  },
  {
    id: 'mock-2',
    conversationId: 'conv-2',
    leadId: 'lead-2',
    leadName: 'John Smith',
    leadPhone: '',
    clinicId: 'clinic-1',
    clinicName: 'Smile Dental Bristol',
    trigger: 'emergency',
    reason: 'Emergency keyword detected: "chest pain"',
    createdAt: new Date(Date.now() - 60_000).toISOString(),
    acknowledgedByMe: false,
    resolvedAt: null,
  },
];

// Subscribers receive every mutation so the SSE hook can re-render.
type Listener = (e: EscalationNotification) => void;
const listeners = new Set<Listener>();

/** Returns a snapshot so callers cannot mutate the store directly. */
export function listMockEscalations(): EscalationNotification[] {
  return store.filter((e) => !e.resolvedAt).map((e) => ({ ...e }));
}

export function getMockEscalation(id: string): EscalationNotification | null {
  const hit = store.find((e) => e.id === id);
  return hit ? { ...hit } : null;
}

export function acknowledgeMock(id: string): void {
  const hit = store.find((e) => e.id === id);
  if (hit) hit.acknowledgedByMe = true;
}

export function resolveMock(id: string): void {
  const hit = store.find((e) => e.id === id);
  if (hit) hit.resolvedAt = new Date().toISOString();
}

/** Subscribe to future mock escalation events. Returns an unsubscribe. */
export function subscribeMockStream(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Drops a fresh escalation into the store and notifies subscribers,
 * simulating a backend push. Exposed so developer tooling (or a
 * simple button in dev) can trigger test events during smoke testing.
 */
export function pushMockEscalation(
  partial?: Partial<EscalationNotification>,
): EscalationNotification {
  const next: EscalationNotification = {
    id: `mock-${Date.now()}`,
    conversationId: `conv-${Date.now()}`,
    leadId: `lead-${Date.now()}`,
    leadName: 'Test Lead',
    leadPhone: '+447700900999',
    clinicId: 'clinic-1',
    clinicName: 'Smile Dental Bristol',
    trigger: 'failed_understanding',
    reason: '3 consecutive AI comprehension failures',
    createdAt: new Date().toISOString(),
    acknowledgedByMe: false,
    resolvedAt: null,
    ...partial,
  };
  store.push(next);
  listeners.forEach((cb) => cb({ ...next }));
  return next;
}
