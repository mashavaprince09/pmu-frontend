import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WaveformChartComponent } from './waveform-chart.component';
import { WaveformService } from '../../../core/api/waveform.service';
import { PhasorService } from '../../../core/dsp/phasor.service';
import { DashboardStore } from '../../../core/state/dashboard-store';
import { DecodedWaveform } from '../../../core/arrow/arrow.types';

describe('WaveformChartComponent', () => {
  let fixture: ComponentFixture<WaveformChartComponent>;
  let waveform: jasmine.SpyObj<WaveformService>;
  let phasor: jasmine.SpyObj<PhasorService>;
  let store: DashboardStore;

  const decoded: DecodedWaveform = {
    t: Float64Array.from([0, 0.001, 0.002]),
    channels: {
      V1N: Float64Array.from([1, 2, 3]),
      V2N: Float64Array.from([4, 5, 6]),
      V3N: Float64Array.from([7, 8, 9]),
      IL1: Float64Array.from([10, 11, 12]),
      IL2: Float64Array.from([13, 14, 15]),
      IL3: Float64Array.from([16, 17, 18])
    },
    meta: { device: 'pmu11', sampleRateHz: 8192 }
  };

  beforeEach(async () => {
    waveform = jasmine.createSpyObj('WaveformService', ['fetchWaveform']);
    waveform.fetchWaveform.and.resolveTo(decoded);
    phasor = jasmine.createSpyObj('PhasorService', ['computePhasors']);
    phasor.computePhasors.and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [WaveformChartComponent],
      providers: [
        { provide: WaveformService, useValue: waveform },
        { provide: PhasorService, useValue: phasor }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WaveformChartComponent);
    store = TestBed.inject(DashboardStore);
  });

  it('starts with all six channels enabled', () => {
    fixture.detectChanges();
    const enabled = fixture.componentInstance.enabledChannels();
    expect(enabled.size).toBe(6);
    for (const ch of ['V1N', 'V2N', 'V3N', 'IL1', 'IL2', 'IL3']) {
      expect(enabled.has(ch)).toBe(true);
    }
  });

  it('toggling a channel off removes it, toggling it again re-adds it', () => {
    fixture.detectChanges();
    fixture.componentInstance.toggleChannel('V1N');
    expect(fixture.componentInstance.enabledChannels().has('V1N')).toBe(false);

    fixture.componentInstance.toggleChannel('V1N');
    expect(fixture.componentInstance.enabledChannels().has('V1N')).toBe(true);
  });

  it('refuses to disable the last remaining enabled channel in a group', () => {
    fixture.detectChanges();
    fixture.componentInstance.toggleChannel('V1N');
    fixture.componentInstance.toggleChannel('V2N');
    expect(fixture.componentInstance.enabledChannels().has('V3N')).toBe(true);

    fixture.componentInstance.toggleChannel('V3N');
    expect(fixture.componentInstance.enabledChannels().has('V3N'))
      .withContext('the only remaining voltage channel should not be toggleable off')
      .toBe(true);
  });

  it('re-renders channel checkboxes to reflect enabled state in the DOM', () => {
    fixture.detectChanges();
    fixture.componentInstance.toggleChannel('V1N');
    fixture.detectChanges();

    const checkboxes: HTMLInputElement[] = Array.from(fixture.nativeElement.querySelectorAll('.channel-toggle input'));
    const v1nLabel = checkboxes.find((cb) => cb.closest('label')?.textContent?.trim() === 'V1N');
    expect(v1nLabel?.checked).toBe(false);
  });

  it('filters disabled channels out of the phasor computation after a load', async () => {
    store.applySelection({ devices: ['pmu11'], date: '2025-11-25', hour: 40000, durationSeconds: 3600, mode: 'single' });
    store.setSelectedTimestamp(40000);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    phasor.computePhasors.calls.reset();
    fixture.componentInstance.toggleChannel('IL2');

    expect(phasor.computePhasors).toHaveBeenCalled();
    const channelsArg = phasor.computePhasors.calls.mostRecent().args[1] as string[];
    expect(channelsArg).not.toContain('IL2');
    expect(channelsArg).toContain('V1N');
  });
});
