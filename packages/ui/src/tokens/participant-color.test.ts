import { describe, expect, it } from 'vitest';
import { participantColor, participantHue } from './participant-color.js';

describe('@huddly/ui participantColor', () => {
  it('computes hue correctly', () => {
    expect(participantHue(0)).toBe(85.0);
    expect(participantHue(1)).toBeCloseTo(222.51, 1);
  });

  it('generates dark and light OKLCH strings', () => {
    expect(participantColor(0, 'light')).toBe('oklch(0.74 0.155 85.00)');
    expect(participantColor(0, 'dark')).toBe('oklch(0.80 0.145 85.00)');
  });
});
