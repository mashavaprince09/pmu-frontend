export const VOLTAGE_CHANNELS = ['V1N', 'V2N', 'V3N'] as const;
export const CURRENT_CHANNELS = ['IL1', 'IL2', 'IL3'] as const;
export const ALL_WAVEFORM_CHANNELS = [...VOLTAGE_CHANNELS, ...CURRENT_CHANNELS];

export const CHANNEL_COLORS: Record<string, string> = {
  V1N: '#f87171',
  V2N: '#4ade80',
  V3N: '#60a5fa',
  IL1: '#fb923c',
  IL2: '#34d399',
  IL3: '#818cf8'
};

export function hexToRgba(hex: string, alpha = 1): [number, number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b, alpha];
}
