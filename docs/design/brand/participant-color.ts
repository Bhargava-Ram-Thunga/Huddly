/**
 * Golden-angle participant color generator for Huddly.
 *
 * Distributes visually distinct, harmonious colors for an arbitrary number of
 * participants using the golden angle (137.507764°).
 */

export type Theme = 'light' | 'dark';

export const GOLDEN_ANGLE = 137.507764;
export const BASE_HUE = 85;

/**
 * Computes the golden-angle hue for a given participant index.
 */
export function participantHue(index: number): number {
  const raw = (BASE_HUE + index * GOLDEN_ANGLE) % 360;
  return Number(((raw + 360) % 360).toFixed(2));
}

/**
 * Returns an OKLCH color string tailored for the specified theme.
 *
 * @param index - Zero-indexed participant position
 * @param theme - Active UI theme ('light' | 'dark')
 * @returns OKLCH color string e.g. "oklch(0.74 0.155 85.00)"
 */
export function participantColor(index: number, theme: Theme = 'light'): string {
  const hue = participantHue(index);
  if (theme === 'dark') {
    return `oklch(0.80 0.145 ${hue.toFixed(2)})`;
  }
  return `oklch(0.74 0.155 ${hue.toFixed(2)})`;
}
