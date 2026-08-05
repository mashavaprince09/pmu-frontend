import { Injectable } from '@angular/core';
import { Remote, wrap } from 'comlink';
import type { ArrowDecodeApi } from './arrow-decode.worker';

@Injectable({ providedIn: 'root' })
export class ArrowDecoderService {
  private worker: Worker | null = null;
  private api: Remote<ArrowDecodeApi> | null = null;

  private getApi(): Remote<ArrowDecodeApi> {
    if (!this.api) {
      this.worker = new Worker(new URL('./arrow-decode.worker', import.meta.url), { type: 'module' });
      this.api = wrap<ArrowDecodeApi>(this.worker);
    }
    return this.api;
  }

  decodeMetrics(buf: ArrayBuffer) {
    return this.getApi().decodeMetrics(buf);
  }

  decodeWaveform(buf: ArrayBuffer, channels: string[]) {
    return this.getApi().decodeWaveform(buf, channels);
  }
}
