// Medicin-datoer gemmes som UTC-midnat (YYYY-MM-DD sendes fra <input type="date">).
// Al visning sker derfor ud fra ISO-dato-delen, så datoen ikke forskubber sig
// i tidszoner bag UTC.

/** ISO-streng → "YYYY-MM-DD" til brug i <input type="date">. */
export function medicationDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** ISO-streng → "d/m-åååå" (dansk rækkefølge), ellers null. */
export function formatMedicationDate(iso: string | null): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return null;
  return `${Number(day)}/${Number(month)}/${year}`;
}

/** "1/3/2024 – Løbende" — bruges i medicin-listen og i tendenser. */
export function formatMedicationRange(
  startDate: string | null,
  endDate: string | null,
  labels: { unknown: string; ongoing: string }
): string {
  const start = formatMedicationDate(startDate) ?? labels.unknown;
  const end = formatMedicationDate(endDate) ?? labels.ongoing;
  return `${start} – ${end}`;
}

/** Dagens dato som "YYYY-MM-DD" i lokal tid (til sammenligning med input-værdier). */
export function todayDateInputValue(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
