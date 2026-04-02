'use client';

import { useParams } from 'next/navigation';
import { mockConversations } from '@/data/mockConversations';
import { mockConversationDetails } from '@/data/mockConversationDetails';
import ConversationDetail from '@/components/Conversations/ConversationDetail';
import BookingChat from '@/components/Conversations/BookingChat';

/**
 * Conversation detail page.
 * Routes Booking-phase leads to the live AI chat,
 * and all other phases to a static read-only conversation view.
 */
export default function ConversationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const conv = mockConversations.find((c) => c.id === id);

  if (!conv) {
    return (
      <div style={{ padding: 32 }}>
        <h1>Conversation not found</h1>
        <p>No conversation data available for this ID.</p>
      </div>
    );
  }

  // Booking-phase leads open the live interactive AI chat
  if (conv.phase === 'Booking') {
    return (
      <BookingChat
        leadName={conv.patientName}
        clinicName={conv.clinic}
      />
    );
  }

  // All other phases show the static read-only conversation detail
  const detail = mockConversationDetails[id];

  if (!detail) {
    return (
      <div style={{ padding: 32 }}>
        <h1>Conversation details not found</h1>
        <p>No message history available for this conversation.</p>
      </div>
    );
  }

  return <ConversationDetail conversation={detail} />;
}
