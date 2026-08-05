import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, effect, signal } from '@angular/core';
import uPlot from 'uplot';
import { MetricsService } from '../../../core/api/metrics.service';
import { DecodedMetrics } from '../../../core/arrow/arrow.types';
import { ArrowFetchError } from '../../../core/api/arrow-fetch';
import { DashboardStore } from '../../../core/state/dashboard-store';
import { insertGapMarkers } from './gap-fill';
import { mergeOnTs } from './merge-metrics';
import { resolveTimeRange, TimeRange } from './trend-panel.model';

const PHASE_COLORS: Record<string, string> = {
  v1nRms: '#f87171',
  v2nRms: '#4ade80',
  v3nRms: '#60a5fa',
  il1Rms: '#fb923c',
  il2Rms: '#34d399',
  il3Rms: '#818cf8'
};
const FREQ_COLOR = '#fbbf24';
const ROCOF_COLOR = '#c084fc';
const DEVICE_DASH: number[][] = [[], [6, 4]];

@Component({
  selector: 'app-trend-panel',
  standalone: true,
  imports: [],
  templateUrl: './trend-panel.component.html',
  styleUrl: './trend-panel.component.scss'
})
export class TrendPanelComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rmsChart') rmsChartEl!: ElementRef<HTMLDivElement>;
  @ViewChild('freqChart') freqChartEl!: ElementRef<HTMLDivElement>;
  @ViewChild('rocofChart') rocofChartEl!: ElementRef<HTMLDivElement>;

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly empty = signal(false);

  private rmsPlot: uPlot | null = null;
  private freqPlot: uPlot | null = null;
  private rocofPlot: uPlot | null = null;
  private abortController: AbortController | null = null;
  private viewReady = false;
  private fullXRange: [number, number] | null = null;
  /** Guards against re-entrant setScale calls while syncing zoom across the three linked charts. */
  private syncingZoom = false;

  constructor(
    private readonly metrics: MetricsService,
    private readonly store: DashboardStore
  ) {
    // allowSignalWrites: load() writes loading/error signals synchronously before its first
    // `await`, which runs inside this effect's call stack — disallowed by default (NG0600).
    effect(
      () => {
        const devices = this.store.devices();
        const date = this.store.date();
        const hour = this.store.hour();
        const duration = this.store.durationSeconds();
        this.store.reloadToken(); // re-run on every "Display" click, even with unchanged params
        if (!this.viewReady || devices.length === 0 || !date) return;
        this.load(devices, date, hour, duration);
      },
      { allowSignalWrites: true }
    );
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    const devices = this.store.devices();
    const date = this.store.date();
    if (devices.length > 0 && date) {
      this.load(devices, date, this.store.hour(), this.store.durationSeconds());
    }
  }

  ngOnDestroy(): void {
    this.abortController?.abort();
    this.rmsPlot?.destroy();
    this.freqPlot?.destroy();
    this.rocofPlot?.destroy();
  }

  private async load(devices: string[], date: string | null, hour: number | null, duration: number): Promise<void> {
    const range = resolveTimeRange(date, hour, duration);
    if (!range) {
      this.empty.set(true);
      return;
    }

    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.empty.set(false);

    const resolution = range.toEpoch - range.fromEpoch <= 3600 ? 'raw' : '1min';
    const expectedStepSeconds = resolution === 'raw' ? 10 : 60;

    try {
      const perDevice = await this.metrics.fetchMetricsForDevices(
        devices,
        { from: range.fromEpoch, to: range.toEpoch, resolution },
        controller.signal
      );
      if (controller.signal.aborted) return;

      let merged = mergeOnTs(perDevice);
      if (merged.ts.length === 0) {
        this.empty.set(true);
        this.clearCharts();
        return;
      }
      // The backend omits missing periods entirely rather than null-padding them, so without
      // this a sparse result would render as a straight line across gaps in the data.
      merged = insertGapMarkers(merged, expectedStepSeconds);
      this.renderCharts(merged.ts, merged.byDevice, range);
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof ArrowFetchError ? err.apiError.message : 'Failed to load metrics.';
      this.errorMessage.set(message);
      this.clearCharts();
    } finally {
      if (!controller.signal.aborted) this.loading.set(false);
    }
  }

  resetZoom(): void {
    if (!this.fullXRange) return;
    this.applyZoomToAll(this.fullXRange[0], this.fullXRange[1]);
  }

  /** Zooms all three charts in/out by `factor` (< 1 zooms in, > 1 zooms out) around the
   *  current view's center, clamped to the full fetched range so zoom-out can't go past it. */
  private zoomBy(factor: number): void {
    const plot = this.rmsPlot ?? this.freqPlot ?? this.rocofPlot;
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
      this.rmsPlot?.setScale('x', { min, max });
      this.freqPlot?.setScale('x', { min, max });
      this.rocofPlot?.setScale('x', { min, max });
    } finally {
      this.syncingZoom = false;
    }
  }

  private clearCharts(): void {
    this.rmsPlot?.destroy();
    this.freqPlot?.destroy();
    this.rocofPlot?.destroy();
    this.rmsPlot = this.freqPlot = this.rocofPlot = null;
  }

  private renderCharts(ts: Float64Array, byDevice: Map<string, DecodedMetrics>, range: TimeRange): void {
    this.clearCharts();
    const devices = [...byDevice.keys()];
    const tsArr = Array.from(ts);
    const xRange: [number, number] = [range.fromEpoch, range.toEpoch];
    this.fullXRange = xRange;

    // RMS chart: 6 channels x N devices
    const rmsSeries: uPlot.Series[] = [{}];
    const rmsData: (Float64Array | number[])[] = [tsArr];
    devices.forEach((device, di) => {
      const m = byDevice.get(device)!;
      (Object.keys(PHASE_COLORS) as (keyof typeof PHASE_COLORS)[]).forEach((key) => {
        rmsSeries.push({
          label: `${device} ${key}`,
          stroke: PHASE_COLORS[key],
          width: 1.5,
          dash: DEVICE_DASH[di % DEVICE_DASH.length]
        });
        rmsData.push(m[key as keyof DecodedMetrics] as Float64Array);
      });
    });
    this.rmsPlot = this.buildChart(this.rmsChartEl.nativeElement, 'RMS (V / A)', rmsSeries, rmsData, xRange);

    // Frequency chart
    const freqSeries: uPlot.Series[] = [{}];
    const freqData: (Float64Array | number[])[] = [tsArr];
    devices.forEach((device, di) => {
      freqSeries.push({ label: `${device} freq`, stroke: FREQ_COLOR, width: 1.5, dash: DEVICE_DASH[di % DEVICE_DASH.length] });
      freqData.push(byDevice.get(device)!.freqHz);
    });
    this.freqPlot = this.buildChart(this.freqChartEl.nativeElement, 'Frequency (Hz)', freqSeries, freqData, xRange);

    // ROCOF chart
    const rocofSeries: uPlot.Series[] = [{}];
    const rocofData: (Float64Array | number[])[] = [tsArr];
    devices.forEach((device, di) => {
      rocofSeries.push({ label: `${device} rocof`, stroke: ROCOF_COLOR, width: 1.5, dash: DEVICE_DASH[di % DEVICE_DASH.length] });
      rocofData.push(byDevice.get(device)!.rocof);
    });
    this.rocofPlot = this.buildChart(this.rocofChartEl.nativeElement, 'ROCOF (Hz/s)', rocofSeries, rocofData, xRange);
  }

  private buildChart(
    el: HTMLDivElement,
    title: string,
    series: uPlot.Series[],
    data: (Float64Array | number[])[],
    xRange: [number, number]
  ): uPlot {
    const width = el.clientWidth || 800;
    const CLICK_THRESHOLD_PX = 5;

    const opts: uPlot.Options = {
      title,
      width,
      height: 220,
      series: series.map((s, i) => (i === 0 ? { value: '{HH}:{mm}:{ss}' } : s)),
      scales: { x: { time: true } },
      axes: [{}, {}],
      // setScale: false — we apply the zoom ourselves in the setSelect hook so it can be
      // synced across all three (RMS/frequency/ROCOF) charts, not just the one dragged on.
      cursor: { drag: { x: true, y: false, setScale: false } },
      hooks: {
        ready: [
          (u: uPlot) => {
            // Establish the initial full-window view via setScale (not a static
            // scales.x.range in options) so later interactive zoom isn't fought by a pinned range.
            u.setScale('x', { min: xRange[0], max: xRange[1] });

            let downX: number | null = null;
            let downY: number | null = null;
            u.over.addEventListener('mousedown', (e: MouseEvent) => {
              downX = e.clientX;
              downY = e.clientY;
            });
            u.over.addEventListener('mouseup', (e: MouseEvent) => {
              if (downX === null || downY === null) return;
              const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
              downX = downY = null;
              if (moved >= CLICK_THRESHOLD_PX) return; // was a drag-zoom, not a click
              const idx = u.cursor.idx;
              if (idx == null) return;
              const t = (u.data[0] as number[])[idx];
              if (t !== undefined && !Number.isNaN(t)) this.store.setSelectedTimestamp(t);
            });
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
