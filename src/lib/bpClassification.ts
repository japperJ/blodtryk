export type Severity =
  | "normal"
  | "elevated"
  | "grade1"
  | "grade2"
  | "grade3"
  | "unclassified";

export type BPLabelKey =
  | "bp.normal.label"
  | "bp.elevated.label"
  | "bp.grade1.label"
  | "bp.grade2.label"
  | "bp.grade3.label"
  | "bp.unclassified.label";

export type BPDescriptionKey =
  | "bp.normal.desc"
  | "bp.elevated.desc"
  | "bp.grade1.desc"
  | "bp.grade2.desc"
  | "bp.grade3.desc"
  | "bp.unclassified.desc"
  | "bp.unclassified.ageDesc";

export const BP_CLASSIFICATION_MINIMUM_AGE = 19;

export const BP_CLASSIFICATION_METADATA = {
  ruleVersion: "dcs-nbv-2026-4-table-27-1-v1",
  verifiedOn: "2026-09-23",
  source: {
    organization: "Dansk Cardiologisk Selskab (DCS)",
    guideline: "National Behandlingsvejledning: Arteriel hypertension",
    revision: "2026/4",
    section: "27.1 Definition og behandlingsmål",
    table: "27.1",
    url: "https://nbv.cardio.dk/kapitel/hypertension/",
  },
  unit: "mmHg",
  ageEligibility: {
    minimumRecordedAge: BP_CLASSIFICATION_MINIMUM_AGE,
  },
  thresholds: {
    normal: { systolicMin: 100, systolicMax: 129, diastolicMin: 60, diastolicMax: 79, join: "and" },
    elevated: { systolicMin: 130, systolicMax: 134, diastolicMin: 80, diastolicMax: 84, join: "or" },
    grade1: { systolicMin: 135, systolicMax: 154, diastolicMin: 85, diastolicMax: 94, join: "or" },
    grade2: { systolicMin: 155, systolicMax: 174, diastolicMin: 95, diastolicMax: 104, join: "or" },
    grade3: { systolicMin: 175, diastolicMin: 105, join: "or" },
  },
} as const;

export type BPClassificationMetadata = typeof BP_CLASSIFICATION_METADATA;

export interface BPStatus {
  severity: Severity;
  labelKey: BPLabelKey;
  color: string;
  descriptionKey: BPDescriptionKey;
}

const STATUS_DETAILS: Record<Severity, Omit<BPStatus, "severity">> = {
  normal: {
    labelKey: "bp.normal.label",
    color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    descriptionKey: "bp.normal.desc",
  },
  elevated: {
    labelKey: "bp.elevated.label",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    descriptionKey: "bp.elevated.desc",
  },
  grade1: {
    labelKey: "bp.grade1.label",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    descriptionKey: "bp.grade1.desc",
  },
  grade2: {
    labelKey: "bp.grade2.label",
    color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    descriptionKey: "bp.grade2.desc",
  },
  grade3: {
    labelKey: "bp.grade3.label",
    color: "bg-red-700 text-white dark:bg-red-600 dark:text-white",
    descriptionKey: "bp.grade3.desc",
  },
  unclassified: {
    labelKey: "bp.unclassified.label",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    descriptionKey: "bp.unclassified.desc",
  },
};

const SEVERITY_RANK: Record<Severity, number> = {
  normal: 0,
  elevated: 1,
  grade1: 2,
  grade2: 3,
  grade3: 4,
  unclassified: -1,
};

function getComponentSeverity(value: number, component: "systolic" | "diastolic"): Severity | null {
  const thresholds = BP_CLASSIFICATION_METADATA.thresholds;
  const grade3Min = component === "systolic" ? thresholds.grade3.systolicMin : thresholds.grade3.diastolicMin;
  const grade2Min = component === "systolic" ? thresholds.grade2.systolicMin : thresholds.grade2.diastolicMin;
  const grade1Min = component === "systolic" ? thresholds.grade1.systolicMin : thresholds.grade1.diastolicMin;
  const elevatedMin = component === "systolic" ? thresholds.elevated.systolicMin : thresholds.elevated.diastolicMin;

  if (value >= grade3Min) return "grade3";
  if (value >= grade2Min) return "grade2";
  if (value >= grade1Min) return "grade1";
  if (value >= elevatedMin) return "elevated";
  return null;
}

function toStatus(
  severity: Severity,
  descriptionKey: BPDescriptionKey = STATUS_DETAILS[severity].descriptionKey
): BPStatus {
  return { severity, ...STATUS_DETAILS[severity], descriptionKey };
}

export function getBPStatus(
  systolic: number,
  diastolic: number,
  age: number | null | undefined = undefined
): BPStatus {
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    return toStatus("unclassified");
  }

  const systolicSeverity = getComponentSeverity(systolic, "systolic");
  const diastolicSeverity = getComponentSeverity(diastolic, "diastolic");
  const indicatedSeverities = [systolicSeverity, diastolicSeverity].filter(
    (severity): severity is Severity => severity !== null
  );

  let severity: Severity;
  if (indicatedSeverities.length > 0) {
    severity = indicatedSeverities.reduce((highest, current) =>
      SEVERITY_RANK[current] > SEVERITY_RANK[highest] ? current : highest
    );
  } else if (
    systolic >= BP_CLASSIFICATION_METADATA.thresholds.normal.systolicMin &&
    diastolic >= BP_CLASSIFICATION_METADATA.thresholds.normal.diastolicMin
  ) {
    severity = "normal";
  } else {
    return toStatus("unclassified");
  }

  if (
    typeof age !== "number" ||
    !Number.isFinite(age) ||
    age < BP_CLASSIFICATION_MINIMUM_AGE
  ) {
    return toStatus("unclassified", "bp.unclassified.ageDesc");
  }

  return toStatus(severity);
}

export function getBPStatusForPeriodMean(
  systolic: number,
  diastolic: number,
  ages: readonly (number | null | undefined)[]
): BPStatus {
  const allAgesEligible =
    ages.length > 0 &&
    ages.every(
      (age) =>
        typeof age === "number" &&
        Number.isFinite(age) &&
        age >= BP_CLASSIFICATION_MINIMUM_AGE
    );

  return getBPStatus(
    systolic,
    diastolic,
    allAgesEligible ? BP_CLASSIFICATION_MINIMUM_AGE : undefined
  );
}

export function getMeanArterialPressure(systolic: number, diastolic: number): number {
  return Math.round((systolic + 2 * diastolic) / 3);
}
