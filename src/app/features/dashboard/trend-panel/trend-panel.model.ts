export interface TimeRange {
  fromEpoch: number;
  toEpoch: number;
}

export function dateToEpochUtc(dateStr: string): number {
  return Date.parse(`${dateStr}T00:00:00Z`) / 1000;
}

export function resolveTimeRange(date: string | null, hour: number | null, durationSeconds: number): TimeRange | null {
  if (hour !== null) {
    return { fromEpoch: hour, toEpoch: hour + durationSeconds };
  }
  if (date) {
    const from = dateToEpochUtc(date);
    return { fromEpoch: from, toEpoch: from + durationSeconds };
  }
  return null;
}
