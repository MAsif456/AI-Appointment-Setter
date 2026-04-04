'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { BackArrowIcon } from '@/components/Icons';
import styles from './LiveChat.module.css';
import ChatPanel, { DisplayMessage } from './ChatPanel';
import ChatSidebar, { LeadDetails, ClinicDetails } from './ChatSidebar';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface LiveChatProps {
  conversationId: string;
}

/**
 * Interactive live chat that loads a conversation from MongoDB,
 * auto-triggers the AI greeting on mount, and lets the user
 * chat with the booking assistant in real time.
 */
export default function LiveChat({ conversationId }: LiveChatProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<LeadDetails | null>(null);
  const [clinic, setClinic] = useState<ClinicDetails | null>(null);
  const [phase, setPhase] = useState('greeting');
  const startedRef = useRef(false);


  /** Loads conversation data from the API and triggers the greeting */
  const initConversation = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const detailRes = await fetch(`${API_BASE}/conversations/${conversationId}`);
      const detail = await detailRes.json();

      if (detail.lead) setLead(detail.lead);
      if (detail.clinic) setClinic(detail.clinic);
      if (detail.conversation?.phase) setPhase(detail.conversation.phase);


      // Load any existing messages
      if (detail.messages?.length > 0) {
        setMessages(
          detail.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
          })),
        );
        setLoading(false);
        return;
      }

      // No messages yet — trigger the AI greeting
      const startRes = await fetch(
        `${API_BASE}/conversations/${conversationId}/start`,
        { method: 'POST' },
      );
      const startData = await startRes.json();

      if (startData.greeting) {
        setMessages([
          { id: 'greeting', sender: 'ai', content: startData.greeting },
        ]);
        setPhase('greeting');
      } else {
        setError(
          'Failed to generate greeting. Check backend is running and GROQ_API_KEY is set.',
        );
      }
    } catch {
      setError('Could not connect to backend at ' + API_BASE);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    initConversation();
  }, [initConversation]);

  /** Sends a user message and gets the AI reply */
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      sender: 'lead',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userMsg.content }),
        },
      );
      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, sender: 'ai', content: data.reply },
        ]);
        if (data.phase) setPhase(data.phase);
      } else {
        setError('AI failed to respond. Please try again.');
      }
    } catch {
      setError('Could not connect to backend.');
    } finally {
      setLoading(false);
    }
  };
    
    return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <Link href="/conversations" className={styles.backLink}>
          <BackArrowIcon className={styles.backIcon} />
          Back to Conversations
        </Link>

      </div>
      <h1 className={styles.title}>
        {`Live Chat${lead ? ` with ${[lead.firstName, lead.lastName].filter(Boolean).join(' ')}` : ''}`}
      </h1>

      <div className={styles.layout}>
        <ChatPanel
          messages={messages}
          loading={loading}
          error={error}
          input={input}
          clinicName={clinic?.name ?? 'Loading...'}
          onInputChange={setInput}
          onSend={sendMessage}
        />
        <ChatSidebar
          lead={lead}
          clinic={clinic}
          phase={phase}
          messageCount={messages.length}
        />
      </div>
    </div>
  );
}
