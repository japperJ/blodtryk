// Aldersjusteret blodtryksklassificering
// Baseret på ESH 2023 / ESC 2024 guidelines

// Maskinlæsbar sværhedsgrad — gør det muligt at styre fx PDF-farver på
// sværhedsgrad i stedet for de danske label-tekster (labels må gerne ændres)
export type Severity = "normal" | "elevated" | "stage1" | "stage2" | "crisis";

export interface BPStatus {
  severity: Severity;
  label: string;
  color: string;
  description: string;
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
      label: "Krise",
      color: "bg-red-600 text-white",
      description: "Søg øjeblikkelig lægehjælp",
    };
  }

  if (ageGroup === "young") {
    // Under 65 år: AHA/ACC + ESH
    if (systolic < 120 && diastolic < 80) {
      return { severity: "normal", label: "Normal", color: "bg-green-100 text-green-800", description: "Blodtrykket er normalt" };
    }
    if (systolic < 130 && diastolic < 80) {
      return { severity: "elevated", label: "Forhøjet", color: "bg-yellow-100 text-yellow-800", description: "Let forhøjet — overvej livsstilsændringer" };
    }
    // Både systolisk OG diastolisk skal være under grænsen for stadium 1
    if (systolic < 140 && diastolic < 90) {
      return { severity: "stage1", label: "Let forhøjet", color: "bg-orange-100 text-orange-800", description: "Hypertension stadium 1 — tal med læge" };
    }
    return { severity: "stage2", label: "Forhøjet stadium 2", color: "bg-red-100 text-red-800", description: "Hypertension stadium 2 — kontakt læge" };
  }

  if (ageGroup === "middle") {
    // 65-79 år: ESH/ESC (mere generøs)
    if (systolic < 130 && diastolic < 80) {
      return { severity: "normal", label: "Normal", color: "bg-green-100 text-green-800", description: "Blodtrykket er normalt for din alder" };
    }
    if (systolic < 140 && diastolic < 85) {
      return { severity: "elevated", label: "Let forhøjet", color: "bg-yellow-100 text-yellow-800", description: "Acceptabelt for din alder — følg med" };
    }
    if (systolic < 160 && diastolic < 90) {
      return { severity: "stage1", label: "Forhøjet", color: "bg-orange-100 text-orange-800", description: "Overvej behandling — tal med læge" };
    }
    return { severity: "stage2", label: "Højt", color: "bg-red-100 text-red-800", description: "Kontakt læge for behandling" };
  }

  // ≥80 år: ESH/ESC ( mest generøs — undgå for lavt blodtryk)
  if (systolic < 140 && diastolic < 80) {
    return { severity: "normal", label: "Normal", color: "bg-green-100 text-green-800", description: "Blodtrykket er normalt for din alder" };
  }
  if (systolic < 150 && diastolic < 85) {
    return { severity: "elevated", label: "Acceptabelt", color: "bg-yellow-100 text-yellow-800", description: "Acceptabelt for din alder — følg med" };
  }
  if (systolic < 160 && diastolic < 90) {
    return { severity: "stage1", label: "Forhøjet", color: "bg-orange-100 text-orange-800", description: "Overvej behandling — tal med læge" };
  }
  return { severity: "stage2", label: "Højt", color: "bg-red-100 text-red-800", description: "Kontakt læge for behandling" };
}

/**
 * Returnerer aldersgruppe som tekst
 */
export function getAgeGroupLabel(age: number | null): string {
  if (age == null) return "";
  if (age < 65) return "Under 65 år";
  if (age < 80) return "65-79 år";
  return "80+ år";
}
