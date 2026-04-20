'use client';

/**
 * Wrapper that renders the escalated chat transcript with a big
 * warning banner and — crucially — no message composer.
 *
 * This is one half of the "defence in depth" strategy for the
 * read-only requirement: the client never renders a composer and
 * the backend separately rejects POSTs to escalated conversations.
 * Either failure mode alone would be fine, both together make
 * accidental replies impossible.
 */

import styles from '../Notifications/Notifications.module.css';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'lead';
  content: string;
  timestamp: string;
}

interface Props {
  leadName: string;
  leadPhone: string;
  messages: ChatMessage[];
}

export default function ReadOnlyChatShell({
  leadName,
  leadPhone,
  messages,
}: Props) {
  const bannerText = leadPhone
    ? `READ-ONLY — CALL LEAD DIRECTLY ON ${leadPhone}`
    : 'READ-ONLY — NO PHONE ON FILE, CHECK GHL';

  return (
    <div style={{ padding: 24 }}>
      <div className={styles.readOnlyBanner} role="alert">
        {bannerText}
      </div>

      <h1 style={{ marginBottom: 16 }}>
        Escalated conversation — {leadName}
      </h1>

      <div
        data-testid="readonly-transcript"
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          background: '#f9fafb',
          maxHeight: 600,
          overflowY: 'auto',
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
            No messages on this conversation yet.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              marginBottom: 12,
              padding: '10px 14px',
              borderRadius: 8,
              maxWidth: '75%',
              background: msg.sender === 'ai' ? '#ffffff' : '#111827',
              color: msg.sender === 'ai' ? '#1a1a2e' : '#ffffff',
              border: msg.sender === 'ai' ? '1px solid #e5e7eb' : 'none',
              marginLeft: msg.sender === 'ai' ? 0 : 'auto',
            }}
          >
            <div style={{ fontSize: 14 }}>{msg.content}</div>
            <div
              style={{
                fontSize: 11,
                color: msg.sender === 'ai' ? '#6b7280' : 'rgba(255,255,255,0.7)',
                marginTop: 4,
              }}
            >
              {msg.sender === 'ai' ? 'AI' : 'Lead'} · {msg.timestamp}
            </div>
          </div>
        ))}
      </div>

      {/*
        Intentionally NO composer here. Unit tests assert that no
        input / textarea / send button exists in this subtree.
      */}
    </div>
  );
}
