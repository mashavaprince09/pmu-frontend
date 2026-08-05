import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ControlBarComponent } from './control-bar.component';
import { AvailabilityService } from '../../../core/api/availability.service';
import { AuthService } from '../../../core/auth/auth.service';
import { DashboardStore } from '../../../core/state/dashboard-store';
import { DeviceAvailability } from '../../../core/api/availability.models';

describe('ControlBarComponent', () => {
  let fixture: ComponentFixture<ControlBarComponent>;
  let availability: jasmine.SpyObj<AvailabilityService>;

  const devices: DeviceAvailability[] = [{ deviceId: 'pmu11', lastSeenEpoch: 1764079990, windows: 888 }];

  beforeEach(async () => {
    availability = jasmine.createSpyObj('AvailabilityService', ['listDevices', 'listDaysUnion', 'listHours']);
    availability.listDevices.and.resolveTo(devices);
    availability.listDaysUnion.and.resolveTo([
      { day: '2025-11-25', windows: 888, expected: 8640, complete: false }
    ]);
    availability.listHours.and.resolveTo([]);

    const authStub = {
      me: signal({ username: 'admin', role: 'ADMIN', devices: ['*'] }),
      role: signal('ADMIN'),
      isAdmin: () => true,
      logout: jasmine.createSpy('logout')
    };

    await TestBed.configureTestingModule({
      imports: [ControlBarComponent],
      providers: [
        provideRouter([]),
        { provide: AvailabilityService, useValue: availability },
        { provide: AuthService, useValue: authStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ControlBarComponent);
  });

  it('fetches the device list on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(availability.listDevices).toHaveBeenCalled();
  });

  it('fetches days via the real <select> DOM change event and auto-selects the latest date', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#primary-device');
    expect(select).withContext('primary device <select> should exist').not.toBeNull();

    const options = Array.from(select.options).map((o) => o.value);
    expect(options).withContext('pmu11 option should be present once devices load').toContain('pmu11');

    select.value = 'pmu11';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(availability.listDaysUnion)
      .withContext('selecting a device should trigger a /days fetch')
      .toHaveBeenCalledWith(['pmu11']);
    expect(fixture.componentInstance.date())
      .withContext('should auto-select the latest (only) available date')
      .toBe('2025-11-25');
  });

  it('shows the Display button once a device and date are both set', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.display-btn')).toBeNull();

    fixture.componentInstance.onPrimaryDeviceChange('pmu11');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.display-btn'))
      .withContext('Display button should appear once device+date are set')
      .not.toBeNull();
  });

  it('hides the Window dropdown for "Full day" and shows it once a specific hour is picked', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onPrimaryDeviceChange('pmu11');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.hour())
      .withContext('defaults to Full day (null)')
      .toBeNull();
    expect(fixture.nativeElement.querySelector('#duration'))
      .withContext('Window dropdown should be hidden for Full day')
      .toBeNull();

    fixture.componentInstance.onHourChange('1764097990');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#duration'))
      .withContext('Window dropdown should appear once an hour is picked')
      .not.toBeNull();
  });

  it('commits a full 24h duration on Display when Full day is selected, ignoring any stale draft duration', async () => {
    const store = TestBed.inject(DashboardStore);
    spyOn(store, 'applySelection');

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onPrimaryDeviceChange('pmu11');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Simulate a stale 1h duration left over from a prior hour-based selection.
    fixture.componentInstance.onDurationChange('3600');
    fixture.componentInstance.onHourChange('');
    fixture.componentInstance.display();

    expect(store.applySelection).toHaveBeenCalledWith(
      jasmine.objectContaining({ hour: null, durationSeconds: 86400 })
    );
  });
});
