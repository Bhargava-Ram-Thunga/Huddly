import { describe, expect, it } from 'vitest';
import { participantColor, participantHue } from './participant-color.js';

describe('participantHue', () => {
  it('computes expected base hue for index 0', () => {
    expect(participantHue(0)).toBe(85.0);
  });

  it('computes golden-angle rotation for successive indices', () => {
    expect(participantHue(1)).toBeCloseTo(222.51, 1);
    expect(participantHue(2)).toBeCloseTo(0.02, 1);
    expect(participantHue(3)).toBeCloseTo(137.52, 1);
  });

  it('wraps around 360 degrees cleanly', () => {
    for (let i = 0; i < 50; i++) {
      const hue = participantHue(i);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

describe('participantColor', () => {
  it('formats light mode OKLCH string correctly', () => {
    expect(participantColor(0, 'light')).toBe('oklch(0.74 0.155 85.00)');
  });

  it('formats dark mode OKLCH string correctly', () => {
    expect(participantColor(0, 'dark')).toBe('oklch(0.80 0.145 85.00)');
  });

  it('defaults to light theme if unspecified', () => {
    expect(participantColor(0)).toBe('oklch(0.74 0.155 85.00)');
  });
});
