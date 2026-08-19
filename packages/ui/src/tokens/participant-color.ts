export type Theme = 'light' | 'dark';

export const GOLDEN_ANGLE = 137.507764;
export const BASE_HUE = 85;

export function participantHue(index: number): number {
  const raw = (BASE_HUE + index * GOLDEN_ANGLE) % 360;
  return Number(((raw + 360) % 360).toFixed(2));
}

export function participantColor(index: number, theme: Theme = 'light'): string {
  const hue = participantHue(index);
  if (theme === 'dark') {
    return `oklch(0.80 0.145 ${hue.toFixed(2)})`;
  }
  return `oklch(0.74 0.155 ${hue.toFixed(2)})`;
}
