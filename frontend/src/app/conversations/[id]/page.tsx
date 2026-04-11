'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/apiAxios';
import ConversationDetail from '@/components/Conversations/ConversationDetail';
import LiveChat from '@/components/Conversations/LiveChat';
import EscalatedConversationView from '@/components/Conversations/EscalatedConversationView';


interface ConversationData {
  conversation: {
    _id: string;
    phase: string;
    channel: string;
    messageCount: number;
    startedAt: string;
    lastMessageAt: string;
  };
  messages: Array<{
    id: string;
    sender: 'ai' | 'lead';
    content: string;
    timestamp: string;
  }>;
  clinic: {
    id: string;
    name: string;
  } | null;
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    issue: string;
    postcode: string;
    leadSource: string;
  } | null;
}

/**
 * Conversation detail page.
 * Routes Booking-phase leads to the live AI chat,
 * and all other phases to a static read-only conversation view.
 */
export default function ConversationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<ConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        // Use api.get() instead of fetch() - it adds the JWT token!
        const res = await api.get(`/conversations/${id}`);
        setData(res.data);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch conversation:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load conversation');
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <h1>Loading conversation...</h1>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 32 }}>
        <h1>Conversation not found</h1>
        <p>{error || 'No conversation data available for this ID.'}</p>
      </div>
    );
  }

  // Escalated conversations always land on the read-only view —
  // no composer is rendered and the backend also rejects any
  // stray POST to messages on this phase (defence in depth).
  if (data.conversation.phase === 'escalated') {
    return <EscalatedConversationView conversationId={id} />;
  }

  // Show chat for booking, qualifying, and greeting phases
  if (['booking', 'qualifying', 'greeting'].includes(data.conversation.phase)) {
    return <LiveChat conversationId={id} />;
  }

  // All other phases show the static read-only conversation detail
  // Convert API data to the format ConversationDetail expects
  const conversationDetail = {
    id: data.conversation._id,
    patientName: data.lead
      ? `${data.lead.firstName} ${data.lead.lastName || ''}`.trim()
      : 'Unknown',
    phone: data.lead?.phone || 'N/A',
    email: data.lead?.email || 'N/A',
    clinic: data.clinic?.name || 'Unknown Clinic',
    leadSource: data.lead?.leadSource || 'Unknown',
    issue: data.lead?.issue || 'Not specified',
    postcode: data.lead?.postcode || 'N/A',
    urgency: 'Routine', // Could be added to API response if needed
    phase: data.conversation.phase.charAt(0).toUpperCase() + data.conversation.phase.slice(1),
    startedAt: new Date(data.conversation.startedAt).toLocaleString(),
    lastMessageAt: data.conversation.lastMessageAt
      ? new Date(data.conversation.lastMessageAt).toLocaleString()
      : 'No messages yet',
    messageCount: data.conversation.messageCount,
    messages: data.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      content: m.content,
      timestamp: new Date(m.timestamp).toLocaleTimeString(),
    })),
  };

  return <ConversationDetail conversation={conversationDetail} />;
}
