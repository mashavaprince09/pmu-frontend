import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateDeviceRequest, CreateUserRequest, DeviceRegistryView, UserView } from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private readonly http: HttpClient) {}

  listUsers(): Promise<UserView[]> {
    return firstValueFrom(this.http.get<UserView[]>(`${environment.apiBase}/admin/users`));
  }

  createUser(req: CreateUserRequest): Promise<UserView> {
    return firstValueFrom(this.http.post<UserView>(`${environment.apiBase}/admin/users`, req));
  }

  listDevices(): Promise<DeviceRegistryView[]> {
    return firstValueFrom(this.http.get<DeviceRegistryView[]>(`${environment.apiBase}/admin/devices`));
  }

  createDevice(req: CreateDeviceRequest): Promise<DeviceRegistryView> {
    return firstValueFrom(this.http.post<DeviceRegistryView>(`${environment.apiBase}/admin/devices`, req));
  }

  grantDevice(userId: number, deviceRegistryId: number): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`${environment.apiBase}/admin/users/${userId}/devices/${deviceRegistryId}`, {})
    );
  }

  revokeDevice(userId: number, deviceRegistryId: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${environment.apiBase}/admin/users/${userId}/devices/${deviceRegistryId}`)
    );
  }
}
