import { DecodedMetrics } from '../../../core/arrow/arrow.types';
import { MergedSeries } from './merge-metrics';
import { insertGapMarkers } from './gap-fill';

function metrics(ts: number[], v1n: number[]): DecodedMetrics {
  const n = ts.length;
  const fill = (vals: number[]) => Float64Array.from(vals);
  const zeros = () => new Float64Array(n);
  return {
    ts: Float64Array.from(ts),
    v1nRms: fill(v1n),
    v2nRms: zeros(),
    v3nRms: zeros(),
    il1Rms: zeros(),
    il2Rms: zeros(),
    il3Rms: zeros(),
    freqHz: zeros(),
    rocof: zeros()
  };
}

describe('insertGapMarkers', () => {
  it('inserts a single NaN marker into a gap wider than the threshold, breaking the line', () => {
    // 60s step; a gap from t=60 to t=1140 (18min, like the real backend gap we observed) should break.
    const ts = [0, 60, 1140, 1200];
    const merged: MergedSeries = {
      ts: Float64Array.from(ts),
      byDevice: new Map([['pmu11', metrics(ts, [100, 101, 102, 103])]])
    };

    const result = insertGapMarkers(merged, 60);

    expect(result.ts.length).toBe(5);
    expect(Array.from(result.ts)).toEqual([0, 60, 120, 1140, 1200]);

    const v1n = Array.from(result.byDevice.get('pmu11')!.v1nRms);
    expect(v1n[0]).toBe(100);
    expect(v1n[1]).toBe(101);
    expect(v1n[2]).toBeNaN(); // the inserted marker
    expect(v1n[3]).toBe(102);
    expect(v1n[4]).toBe(103);
  });

  it('does not modify data when there are no gaps beyond the threshold', () => {
    const ts = [0, 60, 120, 180];
    const merged: MergedSeries = {
      ts: Float64Array.from(ts),
      byDevice: new Map([['pmu11', metrics(ts, [1, 2, 3, 4])]])
    };

    const result = insertGapMarkers(merged, 60);
    expect(result).toBe(merged);
  });

  it('inserts markers independently for multiple gaps', () => {
    const ts = [0, 60, 500, 560, 1000, 1060];
    const merged: MergedSeries = {
      ts: Float64Array.from(ts),
      byDevice: new Map([['pmu11', metrics(ts, [1, 2, 3, 4, 5, 6])]])
    };

    const result = insertGapMarkers(merged, 60);
    expect(result.ts.length).toBe(8); // 6 original + 2 markers
    const v1n = Array.from(result.byDevice.get('pmu11')!.v1nRms);
    const nanCount = v1n.filter((v) => Number.isNaN(v)).length;
    expect(nanCount).toBe(2);
  });
});
