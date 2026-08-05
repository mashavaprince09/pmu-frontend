export interface DecodedMetrics {
  ts: Float64Array;
  v1nRms: Float64Array;
  v2nRms: Float64Array;
  v3nRms: Float64Array;
  il1Rms: Float64Array;
  il2Rms: Float64Array;
  il3Rms: Float64Array;
  freqHz: Float64Array;
  rocof: Float64Array;
}

export interface DecodedWaveform {
  t: Float64Array;
  channels: Record<string, Float64Array>;
  meta: {
    device?: string;
    startEpoch?: number;
    windowSeconds?: number;
    sampleRateHz?: number;
    points?: number;
  };
}
