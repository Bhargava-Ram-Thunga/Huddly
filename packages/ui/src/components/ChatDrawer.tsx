import { Send, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from './Button.js';
import { ParticipantAvatar } from './ParticipantAvatar.js';
import { cn } from '../utils/cn.js';

export interface ChatMessage {
  id: string;
  senderName: string;
  senderIndex: number;
  content: string;
  timestamp: string;
  reactions?: string[];
}

export interface ChatDrawerProps {
  messages: ChatMessage[];
  onSendMessage?: (content: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  typingUser?: string | null;
  className?: string;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  onSendMessage,
  onReact,
  onDeleteMessage,
  typingUser,
  className,
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage?.(text.trim());
    setText('');
  };

  return (
    <div className={cn('huddly-chat-drawer', className)}>
      {/* Chat Header */}
      <div className="huddly-chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--fg-primary)' }}>
            Room Chat
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--fg-muted)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 600,
            }}
          >
            {messages.length}
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="huddly-chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="huddly-chat-msg-row">
            <ParticipantAvatar
              name={msg.senderName}
              index={msg.senderIndex}
              size="sm"
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--fg-primary)',
                  }}
                >
                  {msg.senderName}
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontFamily: 'var(--font-mono, monospace)',
                    color: 'var(--fg-muted)',
                  }}
                >
                  {msg.timestamp}
                </span>
              </div>
              <div className="huddly-chat-bubble">{msg.content}</div>

              {/* Reaction Badges */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {msg.reactions.map((emoji, i) => (
                    <span
                      key={i}
                      onClick={() => onReact?.(msg.id, emoji)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: '0.6875rem',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--bg-card-hover)',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Delete */}
            {onDeleteMessage && (
              <button
                onClick={() => onDeleteMessage(msg.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--fg-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  opacity: 0.7,
                }}
                title="Delete message"
              >
                <Trash2 style={{ width: 12, height: 12 }} />
              </button>
            )}
          </div>
        ))}

        {typingUser && (
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--fg-muted)',
              fontStyle: 'italic',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--color-butter)',
                display: 'inline-block',
              }}
            />
            <span>{typingUser} is typing…</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="huddly-chat-input-bar">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something to the room…"
          className="huddly-input"
        />
        <Button variant="primary" size="icon-sm" type="submit" disabled={!text.trim()}>
          <Send style={{ width: 14, height: 14 }} />
        </Button>
      </form>
    </div>
  );
};
