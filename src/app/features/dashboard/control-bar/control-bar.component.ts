import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { AvailabilityService } from '../../../core/api/availability.service';
import { DayAvailability, DeviceAvailability, HourAvailability } from '../../../core/api/availability.models';
import { DashboardMode, DashboardStore } from '../../../core/state/dashboard-store';
import { CalendarPopupComponent } from './calendar-popup/calendar-popup.component';

const FULL_DAY_SECONDS = 86400;

@Component({
  selector: 'app-control-bar',
  standalone: true,
  imports: [FormsModule, RouterLink, CalendarPopupComponent],
  templateUrl: './control-bar.component.html',
  styleUrl: './control-bar.component.scss'
})
export class ControlBarComponent implements OnInit {
  private readonly availability = inject(AvailabilityService);
  readonly store = inject(DashboardStore);
  readonly auth = inject(AuthService);

  readonly allDevices = signal<DeviceAvailability[]>([]);
  readonly days = signal<DayAvailability[]>([]);
  readonly hours = signal<HourAvailability[]>([]);
  readonly loadingDevices = signal(false);
  readonly loadingDays = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // Draft selection: not applied to the store (and so not fetched) until "Display" is clicked.
  readonly mode = signal<DashboardMode>(this.store.mode());
  readonly draftDevices = signal<string[]>(this.store.devices());
  readonly date = signal<string | null>(this.store.date());
  readonly hour = signal<number | null>(this.store.hour());
  readonly durationSeconds = signal<number>(this.store.durationSeconds());

  readonly primaryDevice = computed(() => this.draftDevices()[0] ?? '');
  readonly compareDevice = computed(() => this.draftDevices()[1] ?? '');

  readonly canDisplay = computed(() => !!this.primaryDevice() && !!this.date());

  constructor() {
    // allowSignalWrites: these effects kick off async loads whose synchronous portion
    // (before the first `await`) writes loading/data signals — disallowed by default (NG0600).
    effect(
      () => {
        const devs = this.draftDevices();
        if (devs.length === 0) {
          this.days.set([]);
          return;
        }
        this.loadDays(devs);
      },
      { allowSignalWrites: true }
    );

    effect(
      () => {
        const devs = this.draftDevices();
        const date = this.date();
        if (devs.length === 0 || !date) {
          this.hours.set([]);
          return;
        }
        this.loadHours(devs, date);
      },
      { allowSignalWrites: true }
    );
  }

  async ngOnInit(): Promise<void> {
    this.loadingDevices.set(true);
    try {
      const devices = await this.availability.listDevices();
      this.allDevices.set(devices);
    } catch {
      this.errorMessage.set('Failed to load devices.');
    } finally {
      this.loadingDevices.set(false);
    }
  }

  private async loadDays(devs: string[]): Promise<void> {
    this.loadingDays.set(true);
    try {
      const days = await this.availability.listDaysUnion(devs);
      this.days.set(days);
      if (!this.date() && days.length > 0) {
        this.date.set(days[days.length - 1].day);
      }
    } catch {
      this.errorMessage.set('Failed to load availability.');
    } finally {
      this.loadingDays.set(false);
    }
  }

  private async loadHours(devs: string[], date: string): Promise<void> {
    try {
      const perDevice = await Promise.all(devs.map((d) => this.availability.listHours(d, date)));
      const byHour = new Map<number, HourAvailability>();
      for (const hrs of perDevice) {
        for (const h of hrs) {
          const existing = byHour.get(h.hourEpoch);
          if (!existing || h.windows > existing.windows) byHour.set(h.hourEpoch, h);
        }
      }
      this.hours.set([...byHour.values()].sort((a, b) => a.hourEpoch - b.hourEpoch));
    } catch {
      this.errorMessage.set('Failed to load hours.');
    }
  }

  onModeChange(mode: DashboardMode): void {
    this.mode.set(mode);
    if (mode === 'single' && this.draftDevices().length > 1) {
      this.draftDevices.set(this.draftDevices().slice(0, 1));
    }
  }

  onPrimaryDeviceChange(deviceId: string): void {
    const compare = this.compareDevice();
    this.draftDevices.set(compare && this.mode() === 'compare' ? [deviceId, compare] : [deviceId]);
    this.date.set(null);
  }

  onCompareDeviceChange(deviceId: string): void {
    const primary = this.primaryDevice();
    this.draftDevices.set(deviceId ? [primary, deviceId] : [primary]);
  }

  onDateChange(date: string): void {
    this.date.set(date);
    this.hour.set(null);
  }

  onHourChange(hourEpoch: string): void {
    this.hour.set(hourEpoch ? Number(hourEpoch) : null);
  }

  onDurationChange(seconds: string): void {
    this.durationSeconds.set(Number(seconds));
  }

  display(): void {
    if (!this.canDisplay()) return;
    // "Full day" (no hour picked) always spans the whole day — the window dropdown is
    // hidden in that case and shouldn't leave a stale duration from a prior hour selection.
    const durationSeconds = this.hour() === null ? FULL_DAY_SECONDS : this.durationSeconds();
    this.store.applySelection({
      devices: this.draftDevices(),
      date: this.date(),
      hour: this.hour(),
      durationSeconds,
      mode: this.mode()
    });
  }

  formatHour(epoch: number): string {
    return new Date(epoch * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
