'use client';

import { useRef, useEffect } from 'react';
import { AIBotIcon } from '@/components/Icons';
import styles from './LiveChat.module.css';

/** A message displayed in the chat window */
export interface DisplayMessage {
  id: string;
  sender: 'ai' | 'lead';
  content: string;
}

interface ChatPanelProps {
  messages: DisplayMessage[];
  loading: boolean;
  error: string | null;
  input: string;
  clinicName: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

/**
 * Renders the chat window with message bubbles, typing indicator, and input.
 * AI messages show a round bot avatar on the left (WhatsApp-style layout).
 * Lead messages are right-aligned in blue.
 */
export default function ChatPanel({
  messages,
  loading,
  error,
  input,
  clinicName,
  onInputChange,
  onSend,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={styles.chatPanel}>
      <div className={styles.chatHeader}>
        <AIBotIcon className={styles.chatHeaderAvatar} />
        <div className={styles.chatHeaderInfo}>
          <div className={styles.chatHeaderTitle}>{clinicName}</div>
          <div className={styles.chatHeaderSub}>AI Booking Assistant</div>
        </div>
      </div>

      <div className={styles.messages}>
        {/* Spacer pushes messages to the bottom when few messages exist */}
        <div className={styles.messagesSpacer} />
        {messages.map((msg) =>
          msg.sender === 'ai' ? (
            <div key={msg.id} className={styles.aiRow}>
              <AIBotIcon className={styles.aiAvatar} />
              <div className={styles.aiMessage}>{msg.content}</div>
            </div>
          ) : (
            <div key={msg.id} className={styles.leadMessage}>
              {msg.content}
            </div>
          ),
        )}
        {loading && <TypingIndicator />}
        {error && <div className={styles.errorMessage}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <input
          className={styles.input}
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className={styles.sendBtn}
          onClick={onSend}
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

/** Animated three-dot typing indicator shown while the AI is generating */
function TypingIndicator() {
  return (
    <div className={styles.typing} aria-label="AI is typing">
      <span className={styles.typingDot} />
      <span className={styles.typingDot} />
      <span className={styles.typingDot} />
    </div>
  );
}
