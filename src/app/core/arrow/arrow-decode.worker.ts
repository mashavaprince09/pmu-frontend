/// <reference lib="webworker" />
import { Table, tableFromIPC } from 'apache-arrow';
import { expose } from 'comlink';
import { DecodedMetrics, DecodedWaveform } from './arrow.types';

function col(table: Table, name: string): Float64Array {
  const child = table.getChild(name);
  if (!child) return new Float64Array(0);
  return Float64Array.from(child.toArray(), (v) => (v === null || v === undefined ? NaN : Number(v)));
}

const api = {
  async decodeMetrics(buf: ArrayBuffer): Promise<DecodedMetrics> {
    const table = await tableFromIPC(new Uint8Array(buf));
    return {
      ts: col(table, 'ts'),
      v1nRms: col(table, 'v1n_rms'),
      v2nRms: col(table, 'v2n_rms'),
      v3nRms: col(table, 'v3n_rms'),
      il1Rms: col(table, 'il1_rms'),
      il2Rms: col(table, 'il2_rms'),
      il3Rms: col(table, 'il3_rms'),
      freqHz: col(table, 'freq_hz'),
      rocof: col(table, 'rocof')
    };
  },

  async decodeWaveform(buf: ArrayBuffer, requestedChannels: string[]): Promise<DecodedWaveform> {
    const table = await tableFromIPC(new Uint8Array(buf));
    const channels: Record<string, Float64Array> = {};
    for (const ch of requestedChannels) {
      channels[ch] = col(table, ch);
    }
    const metaMap = table.schema.metadata;
    const meta = {
      device: metaMap.get('device'),
      startEpoch: metaMap.has('startEpoch') ? Number(metaMap.get('startEpoch')) : undefined,
      windowSeconds: metaMap.has('windowSeconds') ? Number(metaMap.get('windowSeconds')) : undefined,
      sampleRateHz: metaMap.has('sampleRateHz') ? Number(metaMap.get('sampleRateHz')) : undefined,
      points: metaMap.has('points') ? Number(metaMap.get('points')) : undefined
    };
    return { t: col(table, 't'), channels, meta };
  }
};

export type ArrowDecodeApi = typeof api;
expose(api);
