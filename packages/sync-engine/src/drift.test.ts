import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THRESHOLDS,
  bestClockEstimate,
  decideCorrection,
  estimateClock,
  expectedPosition,
  type PlaybackState,
} from './drift.js';

const T0 = 1_786_780_000_000;

const state = (overrides: Partial<PlaybackState> = {}): PlaybackState => ({
  mediaId: 'media-1',
  position: 100,
  playing: true,
  playbackRate: 1,
  serverTimestamp: T0,
  revision: 10,
  controllerId: null,
  ...overrides,
});

describe('estimateClock', () => {
  it('computes offset and round-trip for a symmetric path', () => {
    // Sent at 1000, server says 5100, received at 1200 → midpoint 1100, offset 4000.
    const estimate = estimateClock({ clientSent: 1000, serverTime: 5100, clientReceived: 1200 });
    expect(estimate.roundTripMs).toBe(200);
    expect(estimate.offsetMs).toBe(4000);
  });

  it('reports a zero offset when the clocks already agree', () => {
    const estimate = estimateClock({ clientSent: 1000, serverTime: 1050, clientReceived: 1100 });
    expect(estimate.offsetMs).toBe(0);
  });

  it('handles a negative offset when the client runs ahead of the server', () => {
    const estimate = estimateClock({ clientSent: 5000, serverTime: 1050, clientReceived: 5100 });
    expect(estimate.offsetMs).toBeLessThan(0);
  });
});

describe('bestClockEstimate', () => {
  it('returns null when there are no samples', () => {
    expect(bestClockEstimate([])).toBeNull();
  });

  it('prefers the sample with the lowest round-trip time', () => {
    const best = bestClockEstimate([
      { clientSent: 0, serverTime: 1000, clientReceived: 800 }, // rtt 800
      { clientSent: 0, serverTime: 1000, clientReceived: 40 }, // rtt 40
      { clientSent: 0, serverTime: 1000, clientReceived: 300 }, // rtt 300
    ]);
    expect(best?.roundTripMs).toBe(40);
  });
});

describe('expectedPosition', () => {
  it('advances with elapsed time while playing', () => {
    expect(expectedPosition(state(), T0 + 5000)).toBeCloseTo(105, 6);
  });

  it('holds position while paused regardless of elapsed time', () => {
    expect(expectedPosition(state({ playing: false }), T0 + 60_000)).toBe(100);
  });

  it('scales elapsed time by the playback rate', () => {
    expect(expectedPosition(state({ playbackRate: 2 }), T0 + 5000)).toBeCloseTo(110, 6);
    expect(expectedPosition(state({ playbackRate: 0.5 }), T0 + 10_000)).toBeCloseTo(105, 6);
  });

  it('never projects a negative position', () => {
    expect(expectedPosition(state({ position: 1 }), T0 - 10_000)).toBe(0);
  });

  it('returns the exact position at the authoritative timestamp', () => {
    expect(expectedPosition(state(), T0)).toBe(100);
  });
});

describe('decideCorrection', () => {
  it('ignores imperceptible drift below the ignore threshold', () => {
    // 20ms behind
    const decision = decideCorrection(104.98, state(), T0 + 5000);
    expect(decision.action).toBe('none');
    expect(decision.seekTo).toBeNull();
  });

  it('nudges the rate for small drift while playing', () => {
    // 100ms behind expected 105
    const decision = decideCorrection(104.9, state(), T0 + 5000);
    expect(decision.action).toBe('nudge-rate');
    expect(decision.correctedRate).toBeGreaterThan(1);
    expect(decision.seekTo).toBeNull();
  });

  it('nudges downward when the client runs ahead', () => {
    const decision = decideCorrection(105.1, state(), T0 + 5000);
    expect(decision.action).toBe('nudge-rate');
    expect(decision.correctedRate).toBeLessThan(1);
  });

  it('soft-seeks for moderate drift', () => {
    // 300ms behind
    const decision = decideCorrection(104.7, state(), T0 + 5000);
    expect(decision.action).toBe('soft-seek');
    expect(decision.seekTo).toBeCloseTo(105, 6);
  });

  it('hard-seeks for large drift', () => {
    // 5s behind
    const decision = decideCorrection(100, state(), T0 + 5000);
    expect(decision.action).toBe('hard-seek');
    expect(decision.seekTo).toBeCloseTo(105, 6);
  });

  it('seeks rather than nudging when the room is paused', () => {
    const decision = decideCorrection(100.1, state({ playing: false }), T0 + 5000);
    expect(decision.action).toBe('soft-seek');
    expect(decision.seekTo).toBe(100);
  });

  it('reports drift sign: positive when ahead, negative when behind', () => {
    expect(decideCorrection(106, state(), T0 + 5000).driftMs).toBeGreaterThan(0);
    expect(decideCorrection(104, state(), T0 + 5000).driftMs).toBeLessThan(0);
  });

  it('honours custom thresholds', () => {
    // 300ms drift would soft-seek by default, but is ignorable with loose thresholds.
    const loose = { ...DEFAULT_THRESHOLDS, ignoreMs: 1000 };
    expect(decideCorrection(104.7, state(), T0 + 5000, loose).action).toBe('none');
  });

  it('brings a late joiner to the current position in one hard seek', () => {
    // Joins 45 minutes in with a fresh player at 0.
    const decision = decideCorrection(0, state({ position: 2700 }), T0 + 1000);
    expect(decision.action).toBe('hard-seek');
    expect(decision.seekTo).toBeCloseTo(2701, 6);
  });

  it('clamps corrected rate to maximum 4.0 when nudging upward at max rate', () => {
    // Room rate is 4.0, client is 100ms behind expected position (100 + 5 * 4 = 120)
    // Raw nudge would be 4.0 * 1.05 = 4.2, which must be clamped to 4.0.
    const decision = decideCorrection(119.9, state({ playbackRate: 4.0 }), T0 + 5000);
    expect(decision.action).toBe('nudge-rate');
    expect(decision.correctedRate).toBe(4.0);
  });

  it('clamps corrected rate to minimum 0.25 when nudging downward at min rate', () => {
    // Room rate is 0.25, client is 100ms ahead of expected position (100 + 4 * 0.25 = 101)
    // Raw nudge would be 0.25 * 0.95 = 0.2375, which must be clamped to 0.25.
    const decision = decideCorrection(101.1, state({ playbackRate: 0.25 }), T0 + 4000);
    expect(decision.action).toBe('nudge-rate');
    expect(decision.correctedRate).toBe(0.25);
  });
});
