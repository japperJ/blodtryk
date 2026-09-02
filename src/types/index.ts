export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  pulse: number;
  map?: number;
}

// Målingskontekst-tags (matcher de tilladte værdier i lib/validation.ts)
export type TimeOfDay = "morning" | "evening";
export type Arm = "left" | "right";

export interface Reading extends BloodPressureReading {
  id: number;
  age: number | null;
  note: string | null;
  image: string | null;
  timeOfDay?: TimeOfDay | null;
  arm?: Arm | null;
  personId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: number;
  name: string;
  birthYear: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PersonSummary {
  id: number;
  name: string;
  birthYear: number | null;
  readingCount: number;
  lastReadingAt: string | null;
  createdAt: string;
}

export interface ScanResult {
  reading: BloodPressureReading;
  confidence: number;
  raw_response: string;
}

// Svar fra GET /api/readings/stats?personId=&days= (#9) — data-grundlag for /trends (#10)
export interface DailyAverage {
  date: string; // YYYY-MM-DD
  sysAvg: number;
  diaAvg: number;
  pulseAvg: number;
  mapAvg?: number;
  count: number;
}

export interface WeeklyAverage {
  weekStart: string; // YYYY-MM-DD (mandag)
  sysAvg: number;
  diaAvg: number;
  mapAvg?: number;
  count: number;
}

export interface TimeOfDayStats {
  morning?: { sysAvg: number };
  evening?: { sysAvg: number };
}

export interface ReadingStats {
  count: number;
  avg: BloodPressureReading;
  min: BloodPressureReading;
  max: BloodPressureReading;
  daily: DailyAverage[];
  weekly: WeeklyAverage[];
  classification: { severity: string; labelKey: string; count: number }[];
  byTimeOfDay?: TimeOfDayStats; // udelades når ingen målinger har tidspunkt-tags
  streakDays: number;
}
