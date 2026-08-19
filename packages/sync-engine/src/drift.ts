/**
 * Huddly playback synchronization math (spec §19–21).
 *
 * Pure functions only — no timers, no DOM, no sockets. This keeps the core
 * synchronization logic exhaustively testable and reusable by every client
 * (extension, web, mobile).
 */

export interface PlaybackState {
  mediaId: string;
  /** Playback position in seconds at `serverTimestamp`. */
  position: number;
  playing: boolean;
  playbackRate: number;
  /** Server clock (epoch ms) when this state was authoritative. */
  serverTimestamp: number;
  revision: number;
  controllerId: string | null;
}

export interface ClockSample {
  /** Client clock when the request was sent (epoch ms). */
  clientSent: number;
  /** Server clock recorded when the request was handled (epoch ms). */
  serverTime: number;
  /** Client clock when the response arrived (epoch ms). */
  clientReceived: number;
}

export interface ClockEstimate {
  /** Add to a client timestamp to approximate server time. */
  offsetMs: number;
  roundTripMs: number;
}

/**
 * Estimates the client↔server clock offset from a single round trip,
 * assuming a symmetric network path (NTP-style).
 *
 * Device clocks are never trusted directly (spec §20).
 */
export function estimateClock(sample: ClockSample): ClockEstimate {
  const roundTripMs = sample.clientReceived - sample.clientSent;
  const midpoint = sample.clientSent + roundTripMs / 2;
  return { offsetMs: sample.serverTime - midpoint, roundTripMs };
}

/**
 * Picks the most trustworthy estimate from several samples: the one with the
 * lowest round-trip time, which is the least distorted by queueing delay.
 */
export function bestClockEstimate(samples: readonly ClockSample[]): ClockEstimate | null {
  if (samples.length === 0) return null;
  return samples
    .map(estimateClock)
    .reduce((best, current) => (current.roundTripMs < best.roundTripMs ? current : best));
}

/**
 * Computes where playback *should* be right now, given the last authoritative
 * state and the current server-aligned time.
 *
 * A paused room holds its position; a playing room advances by elapsed time
 * scaled by the playback rate.
 */
export function expectedPosition(state: PlaybackState, serverNowMs: number): number {
  if (!state.playing) return state.position;
  const elapsedSeconds = (serverNowMs - state.serverTimestamp) / 1000;
  const projected = state.position + elapsedSeconds * state.playbackRate;
  return projected < 0 ? 0 : projected;
}

/** Correction strength, escalating with drift magnitude (spec §21). */
export type CorrectionAction = 'none' | 'nudge-rate' | 'soft-seek' | 'hard-seek';

export interface CorrectionThresholds {
  /** Below this, drift is imperceptible — do nothing. */
  ignoreMs: number;
  /** Below this, correct smoothly by trimming playback rate. */
  nudgeMs: number;
  /** Below this, correct with a gentle seek; above it, seek hard. */
  softSeekMs: number;
}

/**
 * Defaults are starting points to be tuned experimentally, not product truths
 * (spec §21). Keep them configurable per room/media.
 */
export const DEFAULT_THRESHOLDS: CorrectionThresholds = {
  ignoreMs: 50,
  nudgeMs: 200,
  softSeekMs: 500,
};

export interface DriftDecision {
  /** localPosition − expectedPosition, in milliseconds. Positive = ahead. */
  driftMs: number;
  action: CorrectionAction;
  /** Playback rate to apply while nudging; 1 when no rate correction applies. */
  correctedRate: number;
  /** Position to seek to, when the action is a seek. */
  seekTo: number | null;
}

/**
 * Decides how a client should reconcile its local playback position with the
 * authoritative room state.
 */
export function decideCorrection(
  localPosition: number,
  state: PlaybackState,
  serverNowMs: number,
  thresholds: CorrectionThresholds = DEFAULT_THRESHOLDS,
): DriftDecision {
  const expected = expectedPosition(state, serverNowMs);
  const driftMs = (localPosition - expected) * 1000;
  const magnitude = Math.abs(driftMs);

  if (magnitude < thresholds.ignoreMs) {
    return { driftMs, action: 'none', correctedRate: state.playbackRate, seekTo: null };
  }

  // Rate nudging only makes sense while actually playing.
  if (magnitude < thresholds.nudgeMs && state.playing) {
    // Ahead of the room → play slightly slower; behind → slightly faster.
    const direction = driftMs > 0 ? -1 : 1;
    const rawRate = state.playbackRate * (1 + direction * 0.05);
    const correctedRate = Math.min(4.0, Math.max(0.25, rawRate));
    return { driftMs, action: 'nudge-rate', correctedRate, seekTo: null };
  }

  const action: CorrectionAction = magnitude < thresholds.softSeekMs ? 'soft-seek' : 'hard-seek';
  return { driftMs, action, correctedRate: state.playbackRate, seekTo: expected };
}
