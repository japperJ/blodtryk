// Aldersjusteret blodtryksklassificering
// Baseret på ESH 2023 / ESC 2024 guidelines

// Maskinlæsbar sværhedsgrad — gør det muligt at styre fx PDF-farver på
// sværhedsgrad i stedet for label-tekster (labels oversættes via i18n-nøgler)
export type Severity = "normal" | "elevated" | "stage1" | "stage2" | "crisis";

export type BPLabelKey =
  | "bp.normal.label"
  | "bp.crisis.label"
  | "bp.young.elevated.label"
  | "bp.young.stage1.label"
  | "bp.young.stage2.label"
  | "bp.middle.elevated.label"
  | "bp.middle.stage1.label"
  | "bp.middle.stage2.label"
  | "bp.old.elevated.label";

export interface BPStatus {
  severity: Severity;
  /** i18n-nøgle — oversættes med translate(locale, key) eller t(key) */
  labelKey: BPLabelKey;
  color: string;
  descriptionKey: string;
}

/**
 * Klassificer blodtryk baseret på alder
 * Bruger ESH/ESC guidelines som er mest konservative for ældre
 *
 * Aldersgrupper:
 *   <65:   Normal <120/80, Forhøjet 120-129/<80, Let forhøjet 130-139/80-89, Forhøjet stadium 2 ≥140/≥90
 *   65-79: Normal <130/80, Let forhøjet 130-139/<85, Forhøjet 140-159/85-89, Højt ≥160/≥90
 *   ≥80:   Normal <140/80, Acceptabelt 140-149/<85, Forhøjet 150-159/85-89, Højt ≥160/≥90
 */
export function getBPStatus(
  systolic: number,
  diastolic: number,
  age?: number | null
): BPStatus {
  // Hvis ingen alder, brug standard (under 65)
  const ageGroup = age == null ? "young" : age < 65 ? "young" : age < 80 ? "middle" : "old";

  // === Hypertensiv krise (uanset alder) ===
  if (systolic > 180 || diastolic > 120) {
    return {
      severity: "crisis",
      labelKey: "bp.crisis.label",
      color: "bg-red-600 text-white",
      descriptionKey: "bp.crisis.desc",
    };
  }

  if (ageGroup === "young") {
    // Under 65 år: AHA/ACC + ESH
    if (systolic < 120 && diastolic < 80) {
      return { severity: "normal", labelKey: "bp.normal.label", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300", descriptionKey: "bp.normal.desc" };
    }
    if (systolic < 130 && diastolic < 80) {
      return { severity: "elevated", labelKey: "bp.young.elevated.label", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300", descriptionKey: "bp.young.elevated.desc" };
    }
    // Både systolisk OG diastolisk skal være under grænsen for stadium 1
    if (systolic < 140 && diastolic < 90) {
      return { severity: "stage1", labelKey: "bp.young.stage1.label", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", descriptionKey: "bp.young.stage1.desc" };
    }
    return { severity: "stage2", labelKey: "bp.young.stage2.label", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", descriptionKey: "bp.young.stage2.desc" };
  }

  if (ageGroup === "middle") {
    // 65-79 år: ESH/ESC (mere generøs)
    if (systolic < 130 && diastolic < 80) {
      return { severity: "normal", labelKey: "bp.normal.label", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300", descriptionKey: "bp.normalOld.desc" };
    }
    if (systolic < 140 && diastolic < 85) {
      return { severity: "elevated", labelKey: "bp.middle.elevated.label", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300", descriptionKey: "bp.middle.elevated.desc" };
    }
    if (systolic < 160 && diastolic < 90) {
      return { severity: "stage1", labelKey: "bp.middle.stage1.label", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", descriptionKey: "bp.middle.stage1.desc" };
    }
    return { severity: "stage2", labelKey: "bp.middle.stage2.label", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", descriptionKey: "bp.middle.stage2.desc" };
  }

  // ≥80 år: ESH/ESC ( mest generøs — undgå for lavt blodtryk)
  if (systolic < 140 && diastolic < 80) {
    return { severity: "normal", labelKey: "bp.normal.label", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300", descriptionKey: "bp.normalOld.desc" };
  }
  if (systolic < 150 && diastolic < 85) {
    return { severity: "elevated", labelKey: "bp.old.elevated.label", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300", descriptionKey: "bp.old.elevated.desc" };
  }
  if (systolic < 160 && diastolic < 90) {
    return { severity: "stage1", labelKey: "bp.middle.stage1.label", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300", descriptionKey: "bp.middle.stage1.desc" };
  }
  return { severity: "stage2", labelKey: "bp.middle.stage2.label", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300", descriptionKey: "bp.middle.stage2.desc" };
}

export type AgeGroupKey = "" | "ageGroup.under65" | "ageGroup.65to79" | "ageGroup.over80";

/**
 * Returnerer aldersgruppe som i18n-nøgle
 */
export function getAgeGroupKey(age: number | null): AgeGroupKey {
  if (age == null) return "";
  if (age < 65) return "ageGroup.under65";
  if (age < 80) return "ageGroup.65to79";
  return "ageGroup.over80";
}

export function getMeanArterialPressure(systolic: number, diastolic: number): number {
  return Math.round((systolic + 2 * diastolic) / 3);
}
