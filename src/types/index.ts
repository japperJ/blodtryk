export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  pulse: number;
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
