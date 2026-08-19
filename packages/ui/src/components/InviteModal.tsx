import { Copy, Check, Share2, X, Users } from 'lucide-react';
import React, { useState } from 'react';
import { Button } from './Button.js';
import { Badge } from './Badge.js';

export interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  inviteUrl: string;
  maxParticipants?: number;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  inviteUrl,
  maxParticipants = 10,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="huddly-glass"
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-xl)',
          padding: 24,
          maxWidth: 440,
          width: '100%',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: 'var(--fg-muted)',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X style={{ width: 18, height: 18 }} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              padding: 10,
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(242, 187, 49, 0.15)',
              color: 'var(--color-butter)',
            }}
          >
            <Share2 style={{ width: 22, height: 22 }} />
          </div>
          <div>
            <h3
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--fg-primary)',
                marginBottom: 2,
              }}
            >
              Invite Friends
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
              Everyone watches in sync in their browser.
            </p>
          </div>
        </div>

        {/* Room Code Callout */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 12,
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-card)',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Room Code:</span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 700,
                fontSize: '0.9375rem',
                letterSpacing: '0.05em',
                color: 'var(--color-butter)',
              }}
            >
              {roomCode}
            </span>
          </div>
          <Badge variant="butter">
            <Users style={{ width: 12, height: 12 }} /> Max {maxParticipants}
          </Badge>
        </div>

        {/* Shareable Link Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="huddly-input"
            style={{ fontFamily: 'var(--font-mono, monospace)' }}
          />
          <Button variant="primary" size="md" onClick={handleCopy} style={{ flexShrink: 0 }}>
            {copied ? (
              <>
                <Check style={{ width: 16, height: 16 }} /> Copied!
              </>
            ) : (
              <>
                <Copy style={{ width: 16, height: 16 }} /> Copy Link
              </>
            )}
          </Button>
        </div>

        <p style={{ fontSize: '0.6875rem', textAlign: 'center', color: 'var(--fg-muted)' }}>
          Guests can join instantly without creating an account.
        </p>
      </div>
    </div>
  );
};
