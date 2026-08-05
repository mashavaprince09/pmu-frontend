import { Injectable } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ArrowDecoderService } from '../arrow/arrow-decoder.service';
import { DecodedMetrics } from '../arrow/arrow.types';
import { fetchArrowStream } from './arrow-fetch';
import { MetricsQuery } from './metrics.models';

@Injectable({ providedIn: 'root' })
export class MetricsService {
  constructor(
    private readonly auth: AuthService,
    private readonly decoder: ArrowDecoderService
  ) {}

  async fetchMetrics(query: MetricsQuery, signal?: AbortSignal): Promise<DecodedMetrics> {
    const params = new URLSearchParams({
      device: query.device,
      from: String(query.from),
      to: String(query.to),
      resolution: query.resolution
    });
    const buf = await fetchArrowStream(`/metrics?${params}`, this.auth.token(), signal);
    return this.decoder.decodeMetrics(buf);
  }

  /** Compare mode: N parallel single-device requests, merged on ts by the caller. */
  async fetchMetricsForDevices(
    devices: string[],
    rest: Omit<MetricsQuery, 'device'>,
    signal?: AbortSignal
  ): Promise<Map<string, DecodedMetrics>> {
    const entries = await Promise.all(
      devices.map(async (device) => [device, await this.fetchMetrics({ ...rest, device }, signal)] as const)
    );
    return new Map(entries);
  }
}
