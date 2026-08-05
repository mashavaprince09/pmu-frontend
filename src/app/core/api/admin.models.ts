import { Role } from '../auth/auth.models';

export interface UserView {
  id: number;
  username: string;
  role: Role;
  enabled: boolean;
  devices: string[];
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: Role;
}

export interface DeviceRegistryView {
  id: number;
  deviceId: string;
  displayName: string;
  location: string;
}

export interface CreateDeviceRequest {
  deviceId: string;
  displayName: string;
  location: string;
}
