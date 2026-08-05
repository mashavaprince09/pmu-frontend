import { Injectable, computed, signal } from '@angular/core';
import { Params } from '@angular/router';

export type DashboardMode = 'single' | 'compare';

export interface DashboardParams {
  devices: string[];
  date: string | null;
  hour: number | null;
  durationSeconds: number;
  mode: DashboardMode;
}

const DEFAULT_DURATION_SECONDS = 3600;

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly devicesSig = signal<string[]>([]);
  private readonly dateSig = signal<string | null>(null);
  private readonly hourSig = signal<number | null>(null);
  private readonly durationSecondsSig = signal<number>(DEFAULT_DURATION_SECONDS);
  private readonly modeSig = signal<DashboardMode>('single');
  private readonly selectedTimestampSig = signal<number | null>(null);
  /** Bumped by applySelection() so consumers can distinguish "re-displayed with identical params" from "no change". */
  private readonly reloadTokenSig = signal(0);

  readonly devices = this.devicesSig.asReadonly();
  readonly date = this.dateSig.asReadonly();
  readonly hour = this.hourSig.asReadonly();
  readonly durationSeconds = this.durationSecondsSig.asReadonly();
  readonly mode = this.modeSig.asReadonly();
  readonly selectedTimestamp = this.selectedTimestampSig.asReadonly();
  readonly reloadToken = this.reloadTokenSig.asReadonly();

  readonly primaryDevice = computed(() => this.devicesSig()[0] ?? null);
  readonly compareDevice = computed(() => this.devicesSig()[1] ?? null);

  setDevices(devices: string[]): void {
    this.devicesSig.set(devices);
  }

  setDate(date: string | null): void {
    this.dateSig.set(date);
    this.hourSig.set(null);
  }

  setHour(hour: number | null): void {
    this.hourSig.set(hour);
  }

  setDurationSeconds(seconds: number): void {
    this.durationSecondsSig.set(seconds);
  }

  setMode(mode: DashboardMode): void {
    this.modeSig.set(mode);
    if (mode === 'single' && this.devicesSig().length > 1) {
      this.devicesSig.set(this.devicesSig().slice(0, 1));
    }
  }

  setSelectedTimestamp(ts: number | null): void {
    this.selectedTimestampSig.set(ts);
  }

  /** Commits a control-bar selection as the one to display. This is the only path that
   *  should drive data fetches — individual setters above exist for query-param restore. */
  applySelection(selection: {
    devices: string[];
    date: string | null;
    hour: number | null;
    durationSeconds: number;
    mode: DashboardMode;
  }): void {
    this.devicesSig.set(selection.devices);
    this.dateSig.set(selection.date);
    this.hourSig.set(selection.hour);
    this.durationSecondsSig.set(selection.durationSeconds);
    this.modeSig.set(selection.mode);
    this.selectedTimestampSig.set(null);
    this.reloadTokenSig.update((v) => v + 1);
  }

  toQueryParams(): Params {
    return {
      devices: this.devicesSig().join(',') || null,
      date: this.dateSig(),
      hour: this.hourSig(),
      duration: this.durationSecondsSig(),
      mode: this.modeSig()
    };
  }

  loadFromQueryParams(params: Params): void {
    const devices = typeof params['devices'] === 'string' ? params['devices'].split(',').filter(Boolean) : [];
    this.devicesSig.set(devices);
    this.dateSig.set(typeof params['date'] === 'string' ? params['date'] : null);
    this.hourSig.set(params['hour'] !== undefined ? Number(params['hour']) : null);
    this.durationSecondsSig.set(params['duration'] !== undefined ? Number(params['duration']) : DEFAULT_DURATION_SECONDS);
    this.modeSig.set(params['mode'] === 'compare' ? 'compare' : 'single');
  }
}
