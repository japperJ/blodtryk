export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  pulse: number;
}

export interface Reading extends BloodPressureReading {
  id: number;
  age: number | null;
  note: string | null;
  image: string | null;
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
