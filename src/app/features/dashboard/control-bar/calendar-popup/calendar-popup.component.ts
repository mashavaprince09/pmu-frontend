import { Component, computed, input, output, signal } from '@angular/core';
import { DayAvailability } from '../../../../core/api/availability.models';

interface CalendarCell {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  available: boolean;
  complete: boolean;
  windows?: number;
  expected?: number;
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

@Component({
  selector: 'app-calendar-popup',
  standalone: true,
  imports: [],
  templateUrl: './calendar-popup.component.html',
  styleUrl: './calendar-popup.component.scss'
})
export class CalendarPopupComponent {
  readonly days = input<DayAvailability[]>([]);
  readonly selected = input<string | null>(null);
  readonly dateSelected = output<string>();

  readonly open = signal(false);
  readonly weekdayLabels = WEEKDAY_LABELS;

  private readonly availabilityMap = computed(() => {
    const map = new Map<string, DayAvailability>();
    for (const d of this.days()) map.set(d.day, d);
    return map;
  });

  readonly latestAvailableDate = computed(() => {
    const days = this.days();
    return days.length ? days[days.length - 1].day : null;
  });

  private readonly viewMonth = signal<{ year: number; month: number } | null>(null);

  readonly effectiveViewMonth = computed(() => {
    const explicit = this.viewMonth();
    if (explicit) return explicit;
    const anchor = this.selected() ?? this.latestAvailableDate();
    if (anchor) {
      const [y, m] = anchor.split('-').map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  });

  readonly monthLabel = computed(() => {
    const { year, month } = this.effectiveViewMonth();
    return new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });
  });

  readonly cells = computed<CalendarCell[]>(() => {
    const { year, month } = this.effectiveViewMonth();
    const availability = this.availabilityMap();
    const firstOfMonth = new Date(Date.UTC(year, month, 1));
    const startWeekday = firstOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const cells: CalendarCell[] = [];

    for (let i = startWeekday - 1; i >= 0; i--) {
      const dayOfMonth = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      cells.push({ date: formatDate(prevYear, prevMonth, dayOfMonth), dayOfMonth, inMonth: false, available: false, complete: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = formatDate(year, month, d);
      const info = availability.get(date);
      cells.push({
        date,
        dayOfMonth: d,
        inMonth: true,
        available: !!info,
        complete: info?.complete ?? false,
        windows: info?.windows,
        expected: info?.expected
      });
    }

    while (cells.length % 7 !== 0 || cells.length < 42) {
      const last = cells[cells.length - 1];
      const [y, m, d] = last.date.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      cells.push({
        date: formatDate(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()),
        dayOfMonth: next.getUTCDate(),
        inMonth: false,
        available: false,
        complete: false
      });
      if (cells.length >= 42) break;
    }

    return cells;
  });

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  prevMonth(): void {
    const { year, month } = this.effectiveViewMonth();
    this.viewMonth.set(month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  }

  nextMonth(): void {
    const { year, month } = this.effectiveViewMonth();
    this.viewMonth.set(month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  }

  pick(cell: CalendarCell): void {
    if (!cell.available) return;
    this.dateSelected.emit(cell.date);
    this.viewMonth.set(null);
    this.close();
  }

  cellTitle(cell: CalendarCell): string {
    if (!cell.available) return '';
    return `${cell.windows}/${cell.expected} windows${cell.complete ? ' (complete)' : ''}`;
  }
}
