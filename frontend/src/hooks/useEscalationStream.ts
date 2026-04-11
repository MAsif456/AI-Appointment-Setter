'use client';

/**
 * React hook that subscribes the current staff user to incoming
 * escalation events and keeps the in-memory list reconciled.
 *
 * Contract:
 *  - On mount: hits `listUnresolvedEscalations()` to seed the queue,
 *    then opens an SSE connection (or attaches to the mock pub/sub).
 *  - On each event: calls `onEvent` with the new notification so the
 *    context layer can merge it into state and re-render the bell.
 *  - On (re)connect: re-hits the list endpoint to reconcile anything
 *    missed during a disconnect — SSE alone is lossy across drops.
 *
 * The hook is deliberately dumb: it owns no state itself and leaves
 * storage/merging to the context that consumes it. This keeps the
 * unit test surface tiny and separates the transport concern from
 * presentation.
 */

import { useEffect } from 'react';
import {
  fetchStreamToken,
  listUnresolvedEscalations,
} from '@/lib/escalationApi';
import {
  MOCKS_ENABLED,
  subscribeMockStream,
} from '@/mocks/escalationHandlers';
import type { EscalationNotification } from '@/types/escalation';

interface Options {
  // Called every time the server pushes a brand-new escalation.
  onEvent: (event: EscalationNotification) => void;
  // Called after every (re)connect with the reconciled snapshot so
  // the context can replace its list rather than merge-append.
  onReconcile: (items: EscalationNotification[]) => void;
  // Gate the hook on authentication — the parent context only mounts
  // us when a staff user is logged in, but we double-check here so
  // an accidental admin render never opens a stream.
  enabled: boolean;
}

export function useEscalationStream({
  onEvent,
  onReconcile,
  enabled,
}: Options): void {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let eventSource: EventSource | null = null;
    let unsubscribeMock: (() => void) | null = null;

    // Seed the queue first so the bell has a count even before any
    // fresh event arrives.
    const reconcile = async () => {
      try {
        const items = await listUnresolvedEscalations();
        if (!cancelled) onReconcile(items);
      } catch {
        // The context already shows an empty state on failure; a
        // retry will happen on the next reconnect.
      }
    };

    const openStream = async () => {
      await reconcile();
      if (cancelled) return;

      if (MOCKS_ENABLED) {
        // Mock pub/sub — no real network. Matches the "escalation"
        // event contract from the plan.
        unsubscribeMock = subscribeMockStream((e) => {
          if (!cancelled) onEvent(e);
        });
        return;
      }

      // Real SSE: fetch a short-lived token first because EventSource
      // cannot carry the Authorization header.
      const { token } = await fetchStreamToken();
      const base =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      eventSource = new EventSource(
        `${base}/notifications/stream?token=${encodeURIComponent(token)}`,
      );

      eventSource.addEventListener('escalation', (msg: MessageEvent) => {
        try {
          const parsed = JSON.parse(msg.data) as EscalationNotification;
          if (!cancelled) onEvent(parsed);
        } catch {
          // Malformed event — drop it rather than crash the stream.
        }
      });

      // Browsers auto-reconnect on drop; piggyback a reconcile on
      // every error event so we don't miss anything across gaps.
      eventSource.onerror = () => {
        if (!cancelled) reconcile();
      };
    };

    openStream();

    return () => {
      cancelled = true;
      eventSource?.close();
      unsubscribeMock?.();
    };
  }, [enabled, onEvent, onReconcile]);
}
