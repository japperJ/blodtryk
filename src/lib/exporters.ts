// Eksport af målinger til CSV/JSON (#11) — kører 100% i browseren.
// CSV: semikolon-separeret med UTF-8 BOM, så dansk Excel åbner den korrekt (æøå + ; som separator).
import type { Arm, Reading, TimeOfDay } from "@/types";
import { translate, type Locale } from "./i18n";

/** Oversat label for tidspunkt-tag ("morning"|"evening") — tom streng når tagget mangler. */
export function timeOfDayLabel(t: TimeOfDay | null | undefined, locale: Locale = "da"): string {
  if (t === "morning") return translate(locale, "tod.morning");
  if (t === "evening") return translate(locale, "tod.evening");
  return "";
}

/** Oversat label for arm-tag ("left"|"right") — tom streng når tagget mangler. */
export function armLabel(a: Arm | null | undefined, locale: Locale = "da"): string {
  if (a === "left") return translate(locale, "arm.leftName");
  if (a === "right") return translate(locale, "arm.rightName");
  return "";
}

/** Kort oversat label for arm-tag (PDF-pladshensyn): V = Venstre, H = Højre / L = Left, R = Right. */
export function shortArmLabel(a: Arm | null | undefined, locale: Locale = "da"): string {
  if (a === "left") return translate(locale, "arm.leftShort");
  if (a === "right") return translate(locale, "arm.rightShort");
  return "";
}

/** Lokal dato/tid som "YYYY-MM-DD HH:mm" — regnearksvenligt og sortérbart. */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * CSV-felt-escaping: sæt i anførselstegn hvis feltet indeholder
 * semikolon, anførselstegn, newline eller carriage return.
 * Indre anførselstegn fordobles ("").
 */
function escapeCsvField(field: string): string {
  if (field.includes('"') || field.includes(";") || field.includes("\n") || field.includes("\r")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Byg CSV-indholdet som ren streng (uden download-logik, så den kan testes
 * standalone i Node). Semikolon-separeret, CRLF-linjeskift, UTF-8 BOM først.
 */
export function buildCsvString(readings: Reading[], locale: Locale = "da"): string {
  const header = [
    translate(locale, "csv.date"),
    translate(locale, "csv.systolic"),
    translate(locale, "csv.diastolic"),
    translate(locale, "csv.pulse"),
    translate(locale, "csv.timeOfDay"),
    translate(locale, "csv.arm"),
    translate(locale, "csv.note"),
  ];

  const sorted = [...readings].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const lines: string[] = [header.join(";")];
  for (const r of sorted) {
    const row = [
      formatDateTime(r.createdAt),
      String(r.systolic),
      String(r.diastolic),
      String(r.pulse),
      timeOfDayLabel(r.timeOfDay, locale),
      armLabel(r.arm, locale),
      r.note?.trim() ?? "",
    ];
    lines.push(row.map(escapeCsvField).join(";"));
  }

  // BOM (\uFEFF) så Excel genkender filen som UTF-8 og bevarer æøå
  return "\uFEFF" + lines.join("\r\n");
}

/** Pretty-printed JSON (2 space indryk) — fuld dataportabilitet. */
export function buildJsonString(readings: Reading[]): string {
  return JSON.stringify(readings, null, 2);
}

/**
 * Filnavn på formen blodtryk-<person>-<YYYY-MM-DD_HH-mm>.<ext> (person udelades hvis ukendt).
 * Tidsstempel i lokaltid gør navnet unikt pr. eksport, så mobile browsere ikke
 * genbruger en cachet fil med samme navn (#53).
 */
export function exportFilename(personName: string | undefined, ext: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
  if (!personName) return `blodtryk-${stamp}.${ext}`;
  const slug = personName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9æøå-]/g, "");
  return slug ? `blodtryk-${slug}-${stamp}.${ext}` : `blodtryk-${stamp}.${ext}`;
}

/** Fælles download-mekanisme: midlertidigt <a download> + object URL. */
function triggerBrowserDownload(content: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download målinger som CSV (semikolon + BOM, klar til dansk Excel). */
export function downloadReadingsCsv(
  readings: Reading[],
  personName?: string,
  locale: Locale = "da"
): void {
  const csv = buildCsvString(readings, locale);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerBrowserDownload(blob, exportFilename(personName, "csv"));
}

/** Download målinger som pretty-printet JSON-array. */
export function downloadReadingsJson(readings: Reading[], personName?: string): void {
  const json = buildJsonString(readings);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  triggerBrowserDownload(blob, exportFilename(personName, "json"));
}
