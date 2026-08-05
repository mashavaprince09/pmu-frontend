export type Role = 'ADMIN' | 'VIEWER';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  role: Role;
  expiresInSeconds: number;
}

export interface MeResponse {
  username: string;
  role: Role;
  devices: string[];
}
