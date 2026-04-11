'use client';

/**
 * App-wide store for the staff escalation bell.
 *
 * Holds the list of unresolved escalations plus local "dismissed"
 * state, and exposes acknowledge/resolve actions that go through
 * `escalationApi`. The actual transport is delegated to
 * `useEscalationStream` so this file is pure state + React glue.
 *
 * Mounted from `ConditionalLayout` only when the current user has
 * `role === "staff"`. Admins never render the provider and therefore
 * never see the bell — matching AC6 from the plan.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEscalationStream } from '@/hooks/useEscalationStream';
import {
  acknowledgeEscalation as apiAcknowledge,
  resolveEscalation as apiResolve,
} from '@/lib/escalationApi';
import type { EscalationNotification } from '@/types/escalation';

interface ContextValue {
  items: EscalationNotification[];
  unacknowledgedCount: number;
  acknowledge: (id: string) => Promise<void>;
  resolve: (id: string) => Promise<void>;
}

const Ctx = createContext<ContextValue | undefined>(undefined);

export function EscalationNotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<EscalationNotification[]>([]);

  // Merge a fresh event from the stream. De-duplicates by id so a
  // reconcile + a live push for the same notification don't double up.
  const handleEvent = useCallback((event: EscalationNotification) => {
    setItems((prev) => {
      const without = prev.filter((e) => e.id !== event.id);
      return [event, ...without];
    });
  }, []);

  // Replace the whole list — called by the hook after each (re)connect
  // so we don't try to diff against stale state.
  const handleReconcile = useCallback(
    (next: EscalationNotification[]) => setItems(next),
    [],
  );

  useEscalationStream({
    enabled: user?.role === 'staff',
    onEvent: handleEvent,
    onReconcile: handleReconcile,
  });

  const acknowledge = useCallback(async (id: string) => {
    // Optimistic update — the bell dims immediately even if the POST
    // is in flight. The card will only disappear from the panel when
    // the clinic-wide resolve fires.
    setItems((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, acknowledgedByMe: true } : e,
      ),
    );
    try {
      await apiAcknowledge(id);
    } catch {
      // Roll back on failure so the staff member can retry.
      setItems((prev) =>
        prev.map((e) =>
          e.id === id ? { ...e, acknowledgedByMe: false } : e,
        ),
      );
    }
  }, []);

  const resolve = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((e) => e.id !== id));
    try {
      await apiResolve(id);
    } catch {
      // Best-effort: reload on next reconcile. We don't restore the
      // card locally because the staff member has already moved on.
    }
  }, []);

  const unacknowledgedCount = useMemo(
    () => items.filter((e) => !e.acknowledgedByMe && !e.resolvedAt).length,
    [items],
  );

  const value = useMemo(
    () => ({ items, unacknowledgedCount, acknowledge, resolve }),
    [items, unacknowledgedCount, acknowledge, resolve],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEscalationNotifications(): ContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Returning an empty no-op context would hide real bugs like
    // forgetting to mount the provider — throw instead.
    throw new Error(
      'useEscalationNotifications must be used inside EscalationNotificationProvider',
    );
  }
  return ctx;
}
