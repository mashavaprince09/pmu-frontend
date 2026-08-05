import { DecodedMetrics } from '../../../core/arrow/arrow.types';

export interface MergedSeries {
  ts: Float64Array;
  byDevice: Map<string, DecodedMetrics>;
}

/** Merges per-device Arrow decodes onto a shared ts axis (union), filling gaps with NaN. */
export function mergeOnTs(perDevice: Map<string, DecodedMetrics>): MergedSeries {
  const tsSet = new Set<number>();
  for (const metrics of perDevice.values()) {
    for (const t of metrics.ts) tsSet.add(t);
  }
  const ts = Float64Array.from([...tsSet].sort((a, b) => a - b));
  const tsIndex = new Map<number, number>();
  ts.forEach((t, i) => tsIndex.set(t, i));

  const byDevice = new Map<string, DecodedMetrics>();
  for (const [device, metrics] of perDevice) {
    byDevice.set(device, alignToTs(metrics, ts, tsIndex));
  }
  return { ts, byDevice };
}

function alignToTs(metrics: DecodedMetrics, ts: Float64Array, tsIndex: Map<number, number>): DecodedMetrics {
  const n = ts.length;
  const out: DecodedMetrics = {
    ts,
    v1nRms: new Float64Array(n).fill(NaN),
    v2nRms: new Float64Array(n).fill(NaN),
    v3nRms: new Float64Array(n).fill(NaN),
    il1Rms: new Float64Array(n).fill(NaN),
    il2Rms: new Float64Array(n).fill(NaN),
    il3Rms: new Float64Array(n).fill(NaN),
    freqHz: new Float64Array(n).fill(NaN),
    rocof: new Float64Array(n).fill(NaN)
  };
  const keys: (keyof DecodedMetrics)[] = ['v1nRms', 'v2nRms', 'v3nRms', 'il1Rms', 'il2Rms', 'il3Rms', 'freqHz', 'rocof'];
  for (let i = 0; i < metrics.ts.length; i++) {
    const idx = tsIndex.get(metrics.ts[i]);
    if (idx === undefined) continue;
    for (const key of keys) {
      (out[key] as Float64Array)[idx] = (metrics[key] as Float64Array)[i];
    }
  }
  return out;
}
