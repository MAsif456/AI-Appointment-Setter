'use client';

import { useState, useEffect } from 'react';
import LiveChat from './LiveChat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BookingChatProps {
  leadName: string;
  clinicName: string;
}

/**
 * Bridges the frontend mock conversation list to the MongoDB-backed live chat.
 * Fetches conversations from the API, finds the matching lead by name and clinic,
 * then renders the interactive LiveChat component with the MongoDB conversation ID.
 */
export default function BookingChat({ leadName, clinicName }: BookingChatProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/conversations`);
        const data = await res.json();

        // Find the conversation matching this lead by name and clinic
        const match = data.find((c: any) => {
          const name = `${c.leadId?.firstName ?? ''} ${c.leadId?.lastName ?? ''}`.trim();
          const clinic = c.clinicId?.name ?? '';
          return name === leadName && clinic === clinicName;
        });

        if (match) {
          setConversationId(match._id);
        } else {
          setError(
            `Could not find a conversation for ${leadName} at ${clinicName}. ` +
            'Make sure the backend is running and the database is seeded.',
          );
        }
      } catch {
        setError('Could not connect to backend. Make sure it is running.');
      }
    })();
  }, [leadName, clinicName]);

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: '#dc2626', background: '#fee2e2', padding: 16, borderRadius: 8 }}>
          {error}
        </p>
      </div>
    );
  }

  if (!conversationId) {
    return (
      <div style={{ padding: 32, color: '#6b7280' }}>
        Loading conversation...
      </div>
    );
  }

  return <LiveChat conversationId={conversationId} />;
}
