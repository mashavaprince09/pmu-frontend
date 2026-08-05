import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../core/api/admin.service';
import { DeviceRegistryView, UserView } from '../../core/api/admin.models';
import { Role } from '../../core/auth/auth.models';
import { toApiError } from '../../core/http/api-error';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  readonly users = signal<UserView[]>([]);
  readonly devices = signal<DeviceRegistryView[]>([]);
  readonly errorMessage = signal<string | null>(null);

  newUsername = '';
  newPassword = '';
  newRole: Role = 'VIEWER';

  newDeviceId = '';
  newDeviceName = '';
  newDeviceLocation = '';

  grantUserId: number | null = null;
  grantDeviceRegistryId: number | null = null;

  constructor(private readonly admin: AdminService) {}

  ngOnInit(): void {
    this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      const [users, devices] = await Promise.all([this.admin.listUsers(), this.admin.listDevices()]);
      this.users.set(users);
      this.devices.set(devices);
    } catch (err) {
      this.errorMessage.set(toApiError(err).message);
    }
  }

  async createUser(): Promise<void> {
    try {
      await this.admin.createUser({ username: this.newUsername, password: this.newPassword, role: this.newRole });
      this.newUsername = '';
      this.newPassword = '';
      this.newRole = 'VIEWER';
      await this.refresh();
    } catch (err) {
      this.errorMessage.set(toApiError(err).message);
    }
  }

  async createDevice(): Promise<void> {
    try {
      await this.admin.createDevice({
        deviceId: this.newDeviceId,
        displayName: this.newDeviceName,
        location: this.newDeviceLocation
      });
      this.newDeviceId = '';
      this.newDeviceName = '';
      this.newDeviceLocation = '';
      await this.refresh();
    } catch (err) {
      this.errorMessage.set(toApiError(err).message);
    }
  }

  async grant(): Promise<void> {
    if (this.grantUserId === null || this.grantDeviceRegistryId === null) return;
    try {
      await this.admin.grantDevice(this.grantUserId, this.grantDeviceRegistryId);
      await this.refresh();
    } catch (err) {
      this.errorMessage.set(toApiError(err).message);
    }
  }

  async revoke(userId: number, deviceRegistryId: number): Promise<void> {
    try {
      await this.admin.revokeDevice(userId, deviceRegistryId);
      await this.refresh();
    } catch (err) {
      this.errorMessage.set(toApiError(err).message);
    }
  }

  deviceRegistryIdFor(deviceId: string): number | null {
    return this.devices().find((d) => d.deviceId === deviceId)?.id ?? null;
  }
}
