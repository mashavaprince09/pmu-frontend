export interface WaveformQuery {
  device: string;
  at: number;
  window: number;
  channels?: string[];
  maxPoints?: number;
}
