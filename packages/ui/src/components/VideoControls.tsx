import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Mic,
  MicOff,
  Radio,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import React, { useState } from 'react';
import { Button } from './Button.js';
import { Badge } from './Badge.js';
import { cn } from '../utils/cn.js';

export interface VideoControlsProps {
  isPlaying: boolean;
  position: number;
  duration?: number;
  playbackRate?: number;
  isMuted?: boolean;
  driftMs?: number;
  onPlayToggle?: () => void;
  onSeek?: (position: number) => void;
  onMuteToggle?: () => void;
  onRateChange?: (rate: number) => void;
  className?: string;
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  position,
  duration = 360,
  playbackRate = 1.0,
  isMuted = false,
  driftMs = 12,
  onPlayToggle,
  onSeek,
  onMuteToggle,
  onRateChange,
  className,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const progressPercent = Math.min(100, Math.max(0, (position / duration) * 100));

  return (
    <div className={cn('huddly-video-hud', className)}>
      {/* Timeline Scrubber */}
      <div className="huddly-scrubber-container">
        <span className="huddly-time-text">{formatTime(position)}</span>

        <div
          className="huddly-scrubber-track"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPercent = (e.clientX - rect.left) / rect.width;
            onSeek?.(clickPercent * duration);
          }}
        >
          <div className="huddly-scrubber-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <span className="huddly-time-text" style={{ textAlign: 'right' }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Control Buttons Bar */}
      <div className="huddly-hud-buttons">
        {/* Left: Playback Controls */}
        <div className="huddly-btn-group">
          <Button
            variant="primary"
            size="icon"
            onClick={onPlayToggle}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause style={{ width: 18, height: 18, fill: 'currentColor' }} />
            ) : (
              <Play style={{ width: 18, height: 18, fill: 'currentColor', marginLeft: 2 }} />
            )}
          </Button>

          <Button
            variant="glass"
            size="icon-sm"
            onClick={() => onSeek?.(Math.max(0, position - 10))}
            title="Rewind 10s"
          >
            <RotateCcw style={{ width: 14, height: 14 }} />
          </Button>

          <Button
            variant="glass"
            size="icon-sm"
            onClick={() => onSeek?.(Math.min(duration, position + 10))}
            title="Forward 10s"
          >
            <RotateCw style={{ width: 14, height: 14 }} />
          </Button>

          {/* Sync Drift Badge */}
          <Badge variant="butter" style={{ marginLeft: 8 }}>
            <Radio style={{ width: 12, height: 12 }} />
            <span>Synced ({driftMs}ms)</span>
          </Badge>
        </div>

        {/* Right: Audio / Rate / Fullscreen */}
        <div className="huddly-btn-group">
          <Button
            variant="glass"
            size="icon-sm"
            onClick={onMuteToggle}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? (
              <MicOff style={{ width: 15, height: 15, color: 'var(--color-boxred)' }} />
            ) : (
              <Mic style={{ width: 15, height: 15, color: '#4CAF50' }} />
            )}
          </Button>

          {/* Speed Selector */}
          <Button
            variant="glass"
            size="xs"
            style={{ fontFamily: 'var(--font-mono, monospace)', fontWeight: 700 }}
            onClick={() => {
              const rates = [1.0, 1.25, 1.5, 2.0];
              const currentIndex = rates.indexOf(playbackRate);
              const nextRate = rates[(currentIndex + 1) % rates.length] ?? 1.0;
              onRateChange?.(nextRate);
            }}
          >
            {playbackRate}x
          </Button>

          <Button
            variant="glass"
            size="icon-sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? (
              <Minimize2 style={{ width: 14, height: 14 }} />
            ) : (
              <Maximize2 style={{ width: 14, height: 14 }} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
