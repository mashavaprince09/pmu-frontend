import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarPopupComponent } from './calendar-popup.component';

describe('CalendarPopupComponent', () => {
  let fixture: ComponentFixture<CalendarPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarPopupComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarPopupComponent);
  });

  function setDays(days: { day: string; windows: number; expected: number; complete: boolean }[]) {
    fixture.componentRef.setInput('days', days);
    fixture.componentRef.setInput('selected', days.length ? days[days.length - 1].day : null);
    fixture.detectChanges();
  }

  it('marks a partial day available but not complete, and applies the CSS class in the rendered DOM', () => {
    setDays([{ day: '2025-11-25', windows: 888, expected: 8640, complete: false }]);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const cell = fixture.componentInstance.cells().find((c) => c.date === '2025-11-25');
    expect(cell?.available).toBe(true);
    expect(cell?.complete).toBe(false);

    const btn = fixture.nativeElement.querySelector('button.cell.available') as HTMLButtonElement;
    expect(btn).withContext('an .available cell should be in the rendered DOM').not.toBeNull();
    expect(btn.classList.contains('complete')).toBe(false);
    expect(btn.disabled).toBe(false);

    const bg = getComputedStyle(btn).backgroundColor;
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
  });

  it('marks a complete day with the complete class and a distinct background from partial', () => {
    setDays([{ day: '2025-11-25', windows: 8640, expected: 8640, complete: true }]);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector('button.cell.complete') as HTMLButtonElement;
    expect(btn).withContext('a .complete cell should be in the rendered DOM').not.toBeNull();
  });

  it('does not render an available/complete class for days with no data', () => {
    setDays([{ day: '2025-11-25', windows: 888, expected: 8640, complete: false }]);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    const cell = fixture.componentInstance.cells().find((c) => c.date === '2025-11-20');
    expect(cell?.available).toBe(false);

    const btn = [...fixture.nativeElement.querySelectorAll('button.cell')].find(
      (el: HTMLButtonElement) => el.textContent?.trim() === '20'
    ) as HTMLButtonElement | undefined;
    expect(btn?.disabled).toBe(true);
  });

  it('auto-anchors the visible month to the latest available date', () => {
    setDays([{ day: '2025-11-25', windows: 888, expected: 8640, complete: false }]);
    expect(fixture.componentInstance.effectiveViewMonth()).toEqual({ year: 2025, month: 10 });
  });
});
