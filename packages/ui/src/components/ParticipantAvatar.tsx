import { Mic, MicOff, Crown } from 'lucide-react';
import React, { type HTMLAttributes } from 'react';
import { participantColor, type Theme } from '../tokens/participant-color.js';
import { cn } from '../utils/cn.js';

export interface ParticipantAvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  index?: number;
  role?: 'HOST' | 'MODERATOR' | 'PARTICIPANT';
  presence?: 'ONLINE' | 'IDLE' | 'AWAY' | 'RECONNECTING' | 'OFFLINE';
  isSpeaking?: boolean;
  isMuted?: boolean;
  theme?: Theme;
  size?: 'sm' | 'md' | 'lg';
}

export const ParticipantAvatar: React.FC<ParticipantAvatarProps> = ({
  name,
  index = 0,
  role = 'PARTICIPANT',
  presence: _presence = 'ONLINE',
  isSpeaking = false,
  isMuted = false,
  theme = 'dark',
  size = 'md',
  className,
  ...props
}) => {
  const color = participantColor(index, theme);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const sizeClass = {
    sm: 'huddly-avatar-sm',
    md: 'huddly-avatar-md',
    lg: 'huddly-avatar-lg',
  }[size];

  return (
    <div className={cn('huddly-avatar-wrapper', className)} {...props}>
      {/* Speaking Pulse Halo */}
      {isSpeaking && (
        <span
          className="huddly-avatar-speaking-ring"
          style={{ border: `2px solid ${color}`, backgroundColor: color }}
        />
      )}

      {/* Avatar Circle with Dynamic Golden Angle Border */}
      <div
        className={cn('huddly-avatar-circle', sizeClass)}
        style={{
          color: color,
          border: `2px solid ${color}`,
        }}
      >
        {initials}
      </div>

      {/* Status Badges */}
      <div className="huddly-avatar-badge-group">
        {isMuted ? (
          <span
            className="huddly-avatar-mini-badge"
            style={{ backgroundColor: 'var(--color-boxred)', color: '#FFFFFF' }}
            title="Microphone muted"
          >
            <MicOff style={{ width: 10, height: 10 }} />
          </span>
        ) : isSpeaking ? (
          <span
            className="huddly-avatar-mini-badge"
            style={{ backgroundColor: '#4CAF50', color: '#FFFFFF' }}
            title="Speaking"
          >
            <Mic style={{ width: 10, height: 10 }} />
          </span>
        ) : null}

        {role === 'HOST' && (
          <span
            className="huddly-avatar-mini-badge"
            style={{ backgroundColor: 'var(--color-butter)', color: '#131A2A' }}
            title="Host"
          >
            <Crown style={{ width: 10, height: 10 }} />
          </span>
        )}
      </div>
    </div>
  );
};
