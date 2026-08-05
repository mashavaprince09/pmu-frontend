import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DayAvailability, DeviceAvailability, HourAvailability } from './availability.models';

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  constructor(private readonly http: HttpClient) {}

  listDevices(): Promise<DeviceAvailability[]> {
    return firstValueFrom(
      this.http.get<DeviceAvailability[]>(`${environment.apiBase}/devices`)
    );
  }

  listDays(deviceId: string, fromEpoch?: number, toEpoch?: number): Promise<DayAvailability[]> {
    let params = '';
    const parts: string[] = [];
    if (fromEpoch !== undefined) parts.push(`from=${fromEpoch}`);
    if (toEpoch !== undefined) parts.push(`to=${toEpoch}`);
    if (parts.length) params = `?${parts.join('&')}`;
    return firstValueFrom(
      this.http.get<DayAvailability[]>(
        `${environment.apiBase}/devices/${encodeURIComponent(deviceId)}/days${params}`
      )
    );
  }

  listHours(deviceId: string, date: string): Promise<HourAvailability[]> {
    return firstValueFrom(
      this.http.get<HourAvailability[]>(
        `${environment.apiBase}/devices/${encodeURIComponent(deviceId)}/hours?date=${date}`
      )
    );
  }

  /** Compare mode: union days that have data on either device. */
  async listDaysUnion(deviceIds: string[], fromEpoch?: number, toEpoch?: number): Promise<DayAvailability[]> {
    const perDevice = await Promise.all(
      deviceIds.map((id) => this.listDays(id, fromEpoch, toEpoch))
    );
    const byDay = new Map<string, DayAvailability>();
    for (const days of perDevice) {
      for (const d of days) {
        const existing = byDay.get(d.day);
        if (!existing || d.windows > existing.windows) {
          byDay.set(d.day, d);
        }
      }
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }
}
