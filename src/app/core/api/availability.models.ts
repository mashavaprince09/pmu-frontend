export interface DeviceAvailability {
  deviceId: string;
  lastSeenEpoch: number;
  windows: number;
}

export interface DayAvailability {
  day: string;
  windows: number;
  expected: number;
  complete: boolean;
}

export interface HourAvailability {
  hourEpoch: number;
  windows: number;
}
