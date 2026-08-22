// Server-side validering af målinger (bruges af POST /api/readings).
// Ren logik uden DB-adgang — personId-tjek mod databasen sker i routen via Prisma.
//
// Fejl returneres som STABILE KODER (fx "invalidSystolic"), ikke danske sætninger —
// klienten oversætter koden via src/lib/i18n.ts (#24). Grænsekonstanterne er
// eksporteret, så i18n kan bygge de tilsvarende beskeder med samme tal.

// Grænser for gyldige målingsværdier
export const SYSTOLIC_MIN = 50;
export const SYSTOLIC_MAX = 300;
export const DIASTOLIC_MIN = 20;
export const DIASTOLIC_MAX = 200;
export const PULSE_MIN = 20;
export const PULSE_MAX = 250;
export const AGE_MIN = 1;
export const AGE_MAX = 120;
export const NOTE_MAX_LENGTH = 500;

// Grænser for medicin-felter (delt af begge /api/medications-routes)
export const MEDICATION_NAME_MAX_LENGTH = 100;
export const MEDICATION_DOSE_MAX_LENGTH = 100;

// Tolerance for urforskel mellem klient og server — tidspunkter mere end dette
// i fremtiden afvises som "far-future"
const CREATED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// Tilladte kontekst-tags (SQLite har ingen enums — strenge valideres her)
export const TIME_OF_DAY_VALUES = ["morning", "evening"] as const;
export const ARM_VALUES = ["left", "right"] as const;

// Grænse for gyldigt fødselsår (maksimum er indeværende år)
export const BIRTH_YEAR_MIN = 1900;

// Valideret og koordineret input klar til Prisma
export interface ValidatedReadingInput {
  systolic: number;
  diastolic: number;
  pulse: number;
  age: number | null;
  note: string | null;
  image: string | null;
  // Kontekst-tags: morgen/aften og arm (null = ikke angivet)
  timeOfDay: string | null;
  arm: string | null;
  personId: number;
  // Valgfrit målingstidspunkt (null = serveren sætter tidspunktet selv)
  createdAt: Date | null;
}

export type ReadingValidationResult =
  | { ok: true; data: ValidatedReadingInput }
  | { ok: false; error: string };

// Hjælper: er værdien et heltal?
function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

// Hjælper: valgfelt — null/undefined betragtes som "ikke udfyldt"
function isAbsent(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * Validerer et valgfrit fødselsår (bruges af POST/PATCH /api/persons).
 * Returnerer enten { ok: true, value } (null = ikke udfyldt)
 * eller { ok: false, error } med en dansk fejlbesked.
 */
export function validateBirthYear(
  value: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (isAbsent(value)) {
    return { ok: true, value: null };
  }

  const max = new Date().getFullYear();
  if (!isInt(value) || (value as number) < BIRTH_YEAR_MIN || (value as number) > max) {
    return { ok: false, error: "birthYearRange" };
  }

  return { ok: true, value: value as number };
}

/**
 * Validerer body fra POST /api/readings.
 * Returnerer enten { ok: true, data } med rensede felter
 * eller { ok: false, error } med en stabil fejlkode (oversættes i klienten).
 */
export function validateReadingInput(body: unknown): ReadingValidationResult {
  // Body skal være et JSON-objekt
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "invalidRequestFormat" };
  }

  const raw = body as Record<string, unknown>;

  // personId er påkrævet
  if (!isInt(raw.personId) || raw.personId < 1) {
    return { ok: false, error: "personIdRequired" };
  }

  // Systolisk: heltal mellem 50 og 300
  if (!isInt(raw.systolic) || raw.systolic < SYSTOLIC_MIN || raw.systolic > SYSTOLIC_MAX) {
    return { ok: false, error: "invalidSystolic" };
  }

  // Diastolisk: heltal mellem 20 og 200
  if (!isInt(raw.diastolic) || raw.diastolic < DIASTOLIC_MIN || raw.diastolic > DIASTOLIC_MAX) {
    return { ok: false, error: "invalidDiastolic" };
  }

  // Puls: heltal mellem 20 og 250 (påkrævet — samme som schema og nuværende flows)
  if (!isInt(raw.pulse) || raw.pulse < PULSE_MIN || raw.pulse > PULSE_MAX) {
    return { ok: false, error: "invalidPulse" };
  }

  // Relation: systolisk skal være højere end diastolisk
  if (raw.systolic <= raw.diastolic) {
    return { ok: false, error: "systolicMustExceedDiastolic" };
  }

  // Note: valgfri streng på højst 500 tegn
  let note: string | null = null;
  if (!isAbsent(raw.note)) {
    if (typeof raw.note !== "string") {
      return { ok: false, error: "invalidNoteType" };
    }
    if (raw.note.length > NOTE_MAX_LENGTH) {
      return { ok: false, error: "noteTooLong" };
    }
    note = raw.note;
  }

  // Alder: valgfrit heltal mellem 1 og 120
  let age: number | null = null;
  if (!isAbsent(raw.age)) {
    if (!isInt(raw.age) || raw.age < AGE_MIN || raw.age > AGE_MAX) {
      return { ok: false, error: "invalidAge" };
    }
    age = raw.age;
  }

  // Billede: valgfri data-URL som streng (sendes uændret videre)
  let image: string | null = null;
  if (!isAbsent(raw.image)) {
    if (typeof raw.image !== "string") {
      return { ok: false, error: "invalidImageType" };
    }
    image = raw.image;
  }

  // Kontekst-tag: tidspunkt på dagen ("morning" | "evening")
  let timeOfDay: string | null = null;
  if (!isAbsent(raw.timeOfDay)) {
    if (
      typeof raw.timeOfDay !== "string" ||
      !TIME_OF_DAY_VALUES.includes(raw.timeOfDay as (typeof TIME_OF_DAY_VALUES)[number])
    ) {
      return { ok: false, error: "invalidTimeOfDayValue" };
    }
    timeOfDay = raw.timeOfDay;
  }

  // Kontekst-tag: arm ("left" | "right")
  let arm: string | null = null;
  if (!isAbsent(raw.arm)) {
    if (typeof raw.arm !== "string" || !ARM_VALUES.includes(raw.arm as (typeof ARM_VALUES)[number])) {
      return { ok: false, error: "invalidArmValue" };
    }
    arm = raw.arm;
  }

  // Tidspunkt: valgfri ISO-dato/tid som streng (fraværende = serveren bruger "nu")
  let createdAt: Date | null = null;
  if (!isAbsent(raw.createdAt)) {
    if (typeof raw.createdAt !== "string" || raw.createdAt.trim() === "") {
      return { ok: false, error: "createdAtRequiredFormat" };
    }
    const parsed = new Date(raw.createdAt);
    if (isNaN(parsed.getTime())) {
      return { ok: false, error: "invalidCreatedAt" };
    }
    // Målinger kan ikke være foretaget i fremtiden (lille tolerance til urforskel)
    if (parsed.getTime() > Date.now() + CREATED_AT_FUTURE_TOLERANCE_MS) {
      return { ok: false, error: "createdAtInFuture" };
    }
    createdAt = parsed;
  }

  return {
    ok: true,
    data: {
      systolic: raw.systolic,
      diastolic: raw.diastolic,
      pulse: raw.pulse,
      age,
      note,
      image,
      timeOfDay,
      arm,
      personId: raw.personId,
      createdAt,
    },
  };
}
