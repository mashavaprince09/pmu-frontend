import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginRequest, LoginResponse, MeResponse, Role } from './auth.models';

function decodeExpEpochSeconds(jwt: string): number | null {
  try {
    const payload = jwt.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const decoded = JSON.parse(json);
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSig = signal<string | null>(null);
  private readonly meSig = signal<MeResponse | null>(null);
  private readonly expEpochSig = signal<number | null>(null);

  readonly token = this.tokenSig.asReadonly();
  readonly me = this.meSig.asReadonly();
  readonly role = computed<Role | null>(() => this.meSig()?.role ?? null);
  readonly devices = computed<string[]>(() => this.meSig()?.devices ?? []);
  readonly isAdmin = computed(() => this.role() === 'ADMIN');
  readonly isAuthenticated = computed(() => this.tokenSig() !== null);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {}

  async login(credentials: LoginRequest): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiBase}/auth/login`, credentials)
    );
    this.tokenSig.set(res.token);
    this.expEpochSig.set(decodeExpEpochSeconds(res.token));
    await this.refreshMe();
  }

  async refreshMe(): Promise<void> {
    const me = await firstValueFrom(this.http.get<MeResponse>(`${environment.apiBase}/auth/me`));
    this.meSig.set(me);
  }

  hasDeviceAccess(deviceId: string): boolean {
    const devices = this.devices();
    return devices.includes('*') || devices.includes(deviceId);
  }

  isExpired(): boolean {
    const exp = this.expEpochSig();
    if (exp === null) return false;
    return Date.now() / 1000 >= exp;
  }

  logout(navigateToLogin = true): void {
    this.tokenSig.set(null);
    this.meSig.set(null);
    this.expEpochSig.set(null);
    if (navigateToLogin) {
      this.router.navigate(['/login']);
    }
  }
}
