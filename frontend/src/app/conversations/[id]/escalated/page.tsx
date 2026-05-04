'use client';

/**
 * Dedicated route for viewing an escalated conversation read-only.
 * Split from the main `/conversations/[id]` route so the URL alone
 * signals intent ("this is the escalated view") and deep links from
 * the escalation panel always land on the safe, no-composer UI.
 */

import { useParams } from 'next/navigation';
import EscalatedConversationView from '@/components/Conversations/EscalatedConversationView';

export default function EscalatedConversationPage() {
  const params = useParams();
  const id = params.id as string;

  return <EscalatedConversationView conversationId={id} />;
}
