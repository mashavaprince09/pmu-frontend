import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import uPlot from 'uplot';
import { WaveformService } from '../../../core/api/waveform.service';
import { ArrowFetchError } from '../../../core/api/arrow-fetch';
import { DecodedWaveform } from '../../../core/arrow/arrow.types';
import { CHANNEL_COLORS, CURRENT_CHANNELS, VOLTAGE_CHANNELS } from '../../../core/chart-colors';
import { PhasorService, Phasor } from '../../../core/dsp/phasor.service';
import { DashboardStore } from '../../../core/state/dashboard-store';
import { PhasorDiagramComponent } from '../phasor/phasor-diagram.component';

const WINDOW_OPTIONS = [10, 20, 30];

const VOLTAGE_LIST: string[] = [...VOLTAGE_CHANNELS];
const CURRENT_LIST: string[] = [...CURRENT_CHANNELS];

@Component({
  selector: 'app-waveform-chart',
  standalone: true,
  imports: [FormsModule, PhasorDiagramComponent],
  templateUrl: './waveform-chart.component.html',
  styleUrl: './waveform-chart.component.scss'
})
export class WaveformChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('voltageChart') voltageChartEl!: ElementRef<HTMLDivElement>;
  @ViewChild('currentChart') currentChartEl!: ElementRef<HTMLDivElement>;

  readonly windowOptions = WINDOW_OPTIONS;
  readonly voltageChannels = VOLTAGE_LIST;
  readonly currentChannels = CURRENT_LIST;
  readonly channelColors = CHANNEL_COLORS;
  readonly windowSeconds = signal(30);
  readonly fundamentalHz = signal(50);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly phasors = signal<Phasor[]>([]);
  readonly waveformInfo = signal<string | null>(null);
  readonly enabledChannels = signal<Set<string>>(new Set([...VOLTAGE_LIST, ...CURRENT_LIST]));

  private voltagePlot: uPlot | null = null;
  private currentPlot: uPlot | null = null;
  private abortController: AbortController | null = null;
  private viewReady = false;
  private lastRawForPhasor: DecodedWaveform | null = null;
  private lastPhasorSampleRateHz = 0;
  private fullXRange: [number, number] | null = null;
  /** Guards against re-entrant setScale calls while syncing zoom across the two linked charts. */
  private syncingZoom = false;

  constructor(
    private readonly waveform: WaveformService,
    private readonly phasor: PhasorService,
    private readonly store: DashboardStore
  ) {
    // allowSignalWrites: load() writes loading/error signals synchronously before its first
    // `await`, which runs inside this effect's call stack — disallowed by default (NG0600).
    effect(
      () => {
        const ts = this.store.selectedTimestamp();
        const device = this.store.primaryDevice();
        const win = this.windowSeconds();
        if (!this.viewReady || ts === null || !device) return;
        this.load(device, ts, win);
      },
      { allowSignalWrites: true }
    );
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    const ts = this.store.selectedTimestamp();
    const device = this.store.primaryDevice();
    if (ts !== null && device) {
      this.load(device, ts, this.windowSeconds());
    }
  }

  ngOnDestroy(): void {
    this.abortController?.abort();
    this.voltagePlot?.destroy();
    this.currentPlot?.destroy();
  }

  onWindowChange(seconds: string): void {
    this.windowSeconds.set(Number(seconds));
  }

  onFundamentalChange(hz: string): void {
    this.fundamentalHz.set(Number(hz));
    const ts = this.store.selectedTimestamp();
    const device = this.store.primaryDevice();
    if (ts !== null && device) this.load(device, ts, this.windowSeconds());
  }

  /** Toggles a channel's visibility without refetching — all six channels are already
   *  in memory from the last load, this just flips the corresponding uPlot series. */
  toggleChannel(channel: string): void {
    const isVoltage = VOLTAGE_LIST.includes(channel);
    const group = isVoltage ? VOLTAGE_LIST : CURRENT_LIST;

    const current = new Set(this.enabledChannels());
    if (current.has(channel)) {
      const enabledInGroup = group.filter((ch) => current.has(ch)).length;
      if (enabledInGroup === 1) return; // keep at least one channel visible per chart
      current.delete(channel);
    } else {
      current.add(channel);
    }
    this.enabledChannels.set(current);

    const seriesIdx = group.indexOf(channel) + 1; // +1: series index 0 is the x scale
    const plot = isVoltage ? this.voltagePlot : this.currentPlot;
    plot?.setSeries(seriesIdx, { show: current.has(channel) });

    this.updatePhasorsForEnabledChannels();
  }

  /** Restores both charts to the full fetched time range (undoes any zoom). */
  resetZoom(): void {
    if (!this.fullXRange) return;
    this.applyZoomToAll(this.fullXRange[0], this.fullXRange[1]);
  }

  /** Zooms both charts in/out by `factor` (< 1 zooms in, > 1 zooms out) around the current
   *  view's center, clamped to the full fetched range so zoom-out can't go past it. */
  private zoomBy(factor: number): void {
    const plot = this.voltagePlot ?? this.currentPlot;
    if (!plot || !this.fullXRange) return;
    const { min, max } = plot.scales['x'];
    if (min == null || max == null) return;

    const center = (min + max) / 2;
    const halfSpan = ((max - min) / 2) * factor;
    const newMin = Math.max(this.fullXRange[0], center - halfSpan);
    const newMax = Math.min(this.fullXRange[1], center + halfSpan);
    if (newMax - newMin < 1e-6) return; // guard against collapsing to a zero-width range
    this.applyZoomToAll(newMin, newMax);
  }

  zoomIn(): void {
    this.zoomBy(0.5);
  }

  zoomOut(): void {
    this.zoomBy(2);
  }

  private applyZoomToAll(min: number, max: number): void {
    if (this.syncingZoom) return;
    this.syncingZoom = true;
    try {
      this.voltagePlot?.setScale('x', { min, max });
      this.currentPlot?.setScale('x', { min, max });
    } finally {
      this.syncingZoom = false;
    }
  }

  private updatePhasorsForEnabledChannels(): void {
    if (!this.lastRawForPhasor) return;
    const enabled = this.enabledChannels();
    const channels = [...VOLTAGE_LIST, ...CURRENT_LIST].filter((ch) => enabled.has(ch));
    this.phasors.set(
      this.phasor.computePhasors(this.lastRawForPhasor.channels, channels, this.lastPhasorSampleRateHz, this.fundamentalHz())
    );
  }

  private async load(device: string, at: number, windowSeconds: number): Promise<void> {
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      // Chart display: LOD-limited fetch matched to the selected window. maxPoints scales with
      // the window so short windows land close to full resolution, capped at 60,000 to bound
      // payload/render cost for longer windows. The backend applies min/max envelope
      // decimation (WaveformService.minMaxEnvelopeIndices) — every bucket's true peak/trough
      // is kept, so it can't miss real extrema or manufacture aliasing artifacts the way a
      // naive stride pick can.
      // Phasor FFT: a separate maxPoints=0 fetch, since the display fetch may be decimated
      // and its metadata sampleRateHz reflects the *raw* rate, not the decimated one —
      // using it for FFT bin math against decimated samples would misidentify the fundamental.
      const maxPoints = Math.min(60_000, Math.max(6_000, windowSeconds * 4_000));
      const [decoded, rawForPhasor] = await Promise.all([
        this.waveform.fetchWaveform({ device, at, window: windowSeconds, maxPoints }, controller.signal),
        this.waveform.fetchWaveform({ device, at, window: 1, maxPoints: 0 }, controller.signal)
      ]);
      if (controller.signal.aborted) return;

      this.renderCharts(decoded);

      this.lastRawForPhasor = rawForPhasor;
      this.lastPhasorSampleRateHz = rawForPhasor.meta.sampleRateHz ?? this.estimateSampleRate(rawForPhasor.t);
      this.updatePhasorsForEnabledChannels();
      this.waveformInfo.set(
        `${decoded.meta.device ?? device} · ${decoded.t.length} chart pts · ${this.lastPhasorSampleRateHz ? this.lastPhasorSampleRateHz.toFixed(0) : '?'} Hz raw rate for phasors`
      );
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof ArrowFetchError ? err.apiError.message : 'Failed to load waveform.';
      this.errorMessage.set(message);
    } finally {
      if (!controller.signal.aborted) this.loading.set(false);
    }
  }

  private estimateSampleRate(t: Float64Array): number {
    if (t.length < 2) return 0;
    const span = t[t.length - 1] - t[0];
    return span > 0 ? (t.length - 1) / span : 0;
  }

  private renderCharts(decoded: DecodedWaveform): void {
    this.voltagePlot?.destroy();
    this.currentPlot?.destroy();
    this.voltagePlot = this.currentPlot = null;

    const n = decoded.t.length;
    if (n === 0) return;

    const xRange: [number, number] = [decoded.t[0], decoded.t[n - 1]];
    this.fullXRange = xRange;
    const tArr = Array.from(decoded.t);

    this.voltagePlot = this.buildChart(this.voltageChartEl.nativeElement, VOLTAGE_LIST, decoded, tArr, xRange);
    this.currentPlot = this.buildChart(this.currentChartEl.nativeElement, CURRENT_LIST, decoded, tArr, xRange);
  }

  private buildChart(
    el: HTMLDivElement,
    channels: string[],
    decoded: DecodedWaveform,
    tArr: number[],
    xRange: [number, number]
  ): uPlot {
    const enabled = this.enabledChannels();
    const width = el.clientWidth || 800;
    const CLICK_THRESHOLD_PX = 5;

    // Draw a monotone-cubic curve through the (decimated) points rather than straight
    // connecting segments. The underlying signal is a clean 50/60 Hz sine, so curve-fitting
    // through correctly-spaced points is a reasonable way to recover the visual "sine" look
    // at a fixed point budget — it's interpolation, not more real data, so it's a cosmetic
    // smoothing pass on top of the min/max decimation, not a substitute for it.
    const splinePaths = uPlot.paths.spline?.();
    const series: uPlot.Series[] = [{ value: '{HH}:{mm}:{ss}.{fff}' }];
    const data: (Float64Array | number[])[] = [tArr];
    for (const ch of channels) {
      series.push({ label: ch, stroke: this.channelColors[ch], width: 1, show: enabled.has(ch), paths: splinePaths });
      data.push(decoded.channels[ch] ?? new Float64Array(tArr.length));
    }

    const opts: uPlot.Options = {
      width,
      height: 360,
      series,
      scales: { x: { time: true } },
      axes: [{}, {}],
      legend: { show: false },
      // setScale: false — we apply the zoom ourselves in the setSelect hook so it can be
      // synced across both (voltage/current) charts, not just the one dragged on.
      cursor: { drag: { x: true, y: false, setScale: false } },
      hooks: {
        ready: [
          (u: uPlot) => {
            // Establish the initial full-window view via setScale (not a static
            // scales.x.range in options) so later interactive zoom isn't fought by a pinned range.
            u.setScale('x', { min: xRange[0], max: xRange[1] });
            u.over.addEventListener('dblclick', () => this.resetZoom());
          }
        ],
        setSelect: [
          (u: uPlot) => {
            if (u.select.width >= CLICK_THRESHOLD_PX) {
              const min = u.posToVal(u.select.left, 'x');
              const max = u.posToVal(u.select.left + u.select.width, 'x');
              this.applyZoomToAll(min, max);
            }
            u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
          }
        ]
      }
    };
    return new uPlot(opts, data as uPlot.AlignedData, el);
  }
}
