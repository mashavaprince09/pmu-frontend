export type Resolution = 'raw' | '1min';

export interface MetricsQuery {
  device: string;
  from: number;
  to: number;
  resolution: Resolution;
}
