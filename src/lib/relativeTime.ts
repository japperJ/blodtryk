// Relativ tidsangivelse til dashboard (#17): "for 2 timer siden" / "2 hours ago" osv.
// Bruger Intl.RelativeTimeFormat så bøjning håndteres korrekt for begge sprog.

import { INTL_LOCALE, type Locale } from "./i18n";

/**
 * Formatér et ISO-tidsstempel som relativ tid på det valgte sprog.
 * Fremtidige datoer (fx ur-drift) behandles som "lige nu" / "just now".
 */
export function formatRelativeTime(
  iso: string,
  locale: Locale = "da",
  now: Date = new Date()
): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return locale === "en" ? "just now" : "lige nu";

  const rtf = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" });

  if (minutes < 60) return rtf.format(-minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, "hour");

  const days = Math.floor(hours / 24);
  if (days < 7) return rtf.format(-days, "day");

  const weeks = Math.floor(days / 7);
  return rtf.format(-weeks, "week");
}
