'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Legacy live chat demo page.
 * Redirects to the conversations list — live chat is now accessed
 * by clicking on a Booking-phase lead in the conversations table.
 */
export default function LiveChatPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/conversations');
  }, [router]);

  return (
    <div style={{ padding: 32, color: '#6b7280' }}>
      Redirecting to conversations...
    </div>
  );
}
