import { dateToEpochUtc, resolveTimeRange } from './trend-panel.model';

describe('resolveTimeRange', () => {
  const dayStart = dateToEpochUtc('2025-11-25');

  it('spans the full requested duration for "Full day" (no hour picked)', () => {
    const range = resolveTimeRange('2025-11-25', null, 86400);
    expect(range).toEqual({ fromEpoch: dayStart, toEpoch: dayStart + 86400 });
  });

  it('respects the duration dropdown when a specific hour is picked, not a hardcoded 1h', () => {
    const hourEpoch = dayStart + 5 * 3600;

    expect(resolveTimeRange('2025-11-25', hourEpoch, 3600)).toEqual({
      fromEpoch: hourEpoch,
      toEpoch: hourEpoch + 3600
    });
    expect(resolveTimeRange('2025-11-25', hourEpoch, 21600)).toEqual({
      fromEpoch: hourEpoch,
      toEpoch: hourEpoch + 21600
    });
    expect(resolveTimeRange('2025-11-25', hourEpoch, 86400)).toEqual({
      fromEpoch: hourEpoch,
      toEpoch: hourEpoch + 86400
    });
  });

  it('returns null when no date is selected', () => {
    expect(resolveTimeRange(null, null, 3600)).toBeNull();
  });
});
