import { DecodedMetrics } from '../../../core/arrow/arrow.types';
import { MergedSeries } from './merge-metrics';

const METRIC_KEYS: (keyof DecodedMetrics)[] = [
  'v1nRms',
  'v2nRms',
  'v3nRms',
  'il1Rms',
  'il2Rms',
  'il3Rms',
  'freqHz',
  'rocof'
];

/**
 * The backend omits rows entirely for periods with no data — it does not null-pad them —
 * so a sparse result otherwise renders as a straight line connecting the last point before
 * a gap to the first point after it. This inserts a single NaN-valued marker into any gap
 * wider than `expectedStepSeconds * gapFactor`, which makes uPlot break the line there
 * instead of interpolating across missing data.
 */
export function insertGapMarkers(merged: MergedSeries, expectedStepSeconds: number, gapFactor = 2): MergedSeries {
  const { ts, byDevice } = merged;
  const n = ts.length;
  if (n < 2 || expectedStepSeconds <= 0) return merged;

  const threshold = expectedStepSeconds * gapFactor;
  const newTs: number[] = [ts[0]];
  const originalIndexToNewIndex: number[] = [0];
  let gapsFound = false;

  for (let i = 1; i < n; i++) {
    if (ts[i] - ts[i - 1] > threshold) {
      newTs.push(ts[i - 1] + expectedStepSeconds); // NaN-valued marker; breaks the line on both sides
      gapsFound = true;
    }
    originalIndexToNewIndex.push(newTs.length);
    newTs.push(ts[i]);
  }

  if (!gapsFound) return merged;

  const outTs = Float64Array.from(newTs);
  const newByDevice = new Map<string, DecodedMetrics>();
  for (const [device, metrics] of byDevice) {
    const out: Record<string, Float64Array> = { ts: outTs };
    for (const key of METRIC_KEYS) {
      const src = metrics[key] as Float64Array;
      const arr = new Float64Array(newTs.length).fill(NaN);
      for (let i = 0; i < n; i++) arr[originalIndexToNewIndex[i]] = src[i];
      out[key] = arr;
    }
    newByDevice.set(device, out as unknown as DecodedMetrics);
  }

  return { ts: outTs, byDevice: newByDevice };
}
