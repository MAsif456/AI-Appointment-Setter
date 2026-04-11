'use client';

/**
 * Full-page read-only view for an escalated conversation.
 *
 * Loads the conversation + lead from the existing conversations
 * endpoint (it already contains everything we need), renders the
 * transcript through `ReadOnlyChatShell`, and exposes acknowledge
 * and resolve actions against the escalation context.
 *
 * Finding the matching escalation record is a best-effort lookup
 * by `conversationId` against the in-memory context; if none is
 * found, the page still renders the read-only transcript without
 * the acknowledge controls (covers the case where a staff member
 * bookmarked the URL after resolution).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/apiAxios';
import { useEscalationNotifications } from '@/contexts/EscalationNotificationContext';
import ReadOnlyChatShell from './ReadOnlyChatShell';

interface ConversationResponse {
  conversation: {
    _id: string;
    phase: string;
    startedAt: string;
    lastMessageAt: string;
  };
  messages: Array<{
    id: string;
    sender: 'ai' | 'lead';
    content: string;
    timestamp: string;
  }>;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  } | null;
}

interface Props {
  conversationId: string;
}

export default function EscalatedConversationView({
  conversationId,
}: Props) {
  const { items, acknowledge, resolve } = useEscalationNotifications();
  const [data, setData] = useState<ConversationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The matching escalation — may be undefined if the staff member
  // landed here from a bookmark after the clinic resolved it.
  const escalation = items.find(
    (e) => e.conversationId === conversationId,
  );

  useEffect(() => {
    api
      .get(`/conversations/${conversationId}`)
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(
          err.response?.data?.message || 'Failed to load conversation',
        ),
      );
  }, [conversationId]);

  if (error) {
    return <div style={{ padding: 32 }}>Error: {error}</div>;
  }

  if (!data) {
    return <div style={{ padding: 32 }}>Loading conversation…</div>;
  }

  const leadName = data.lead
    ? `${data.lead.firstName} ${data.lead.lastName || ''}`.trim()
    : 'Unknown lead';
  const leadPhone = escalation?.leadPhone || data.lead?.phone || '';

  const formattedMessages = data.messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    content: m.content,
    timestamp: new Date(m.timestamp).toLocaleTimeString(),
  }));

  return (
    <div>
      <div style={{ padding: '16px 24px 0' }}>
        <Link href="/escalations">&larr; Back to escalations</Link>
      </div>

      <ReadOnlyChatShell
        leadName={leadName}
        leadPhone={leadPhone}
        messages={formattedMessages}
      />

      {escalation && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '0 24px 32px',
            maxWidth: 900,
          }}
        >
          <button
            type="button"
            onClick={() => acknowledge(escalation.id)}
            disabled={escalation.acknowledgedByMe}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: escalation.acknowledgedByMe
                ? '#f3f4f6'
                : '#fff',
              cursor: escalation.acknowledgedByMe
                ? 'not-allowed'
                : 'pointer',
              fontWeight: 600,
            }}
          >
            {escalation.acknowledgedByMe
              ? 'Acknowledged'
              : 'Acknowledge'}
          </button>
          <button
            type="button"
            onClick={() => resolve(escalation.id)}
            style={{
              padding: '10px 16px',
              borderRadius: 6,
              border: 'none',
              background: '#16a34a',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Mark resolved
          </button>
        </div>
      )}
    </div>
  );
}
