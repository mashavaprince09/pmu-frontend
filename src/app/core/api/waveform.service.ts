import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ArrowDecoderService } from '../arrow/arrow-decoder.service';
import { DecodedWaveform } from '../arrow/arrow.types';
import { ALL_WAVEFORM_CHANNELS } from '../chart-colors';
import { fetchArrowStream } from './arrow-fetch';
import { WaveformQuery } from './waveform.models';

@Injectable({ providedIn: 'root' })
export class WaveformService {
  constructor(
    private readonly auth: AuthService,
    private readonly decoder: ArrowDecoderService
  ) {}

  async fetchWaveform(query: WaveformQuery, signal?: AbortSignal): Promise<DecodedWaveform> {
    const channels = query.channels ?? ALL_WAVEFORM_CHANNELS;
    const params = new URLSearchParams({
      device: query.device,
      at: String(query.at),
      window: String(query.window),
      channels: channels.join(','),
      maxPoints: String(query.maxPoints ?? 6000)
    });
    const buf = await fetchArrowStream(`/waveform?${params}`, this.auth.token(), signal);
    return this.decoder.decodeWaveform(buf, channels);
  }
}
