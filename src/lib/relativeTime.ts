// Dansk relativ tidsangivelse til dashboard (#17): "for 2 timer siden", "for 3 dage siden" osv.
// Håndterer lige nu / minutter / timer / dage / uger — ældre målinger falder tilbage til uger.

/**
 * Formatér en ISO-tidsstempel som dansk relativ tid.
 * Fremtidige datoer (fx ur-drift) behandles som "lige nu".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "lige nu";
  if (minutes < 60) return `for ${minutes} minut${minutes === 1 ? "" : "ter"} siden`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `for ${hours} time${hours === 1 ? "" : "r"} siden`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `for ${days} dag${days === 1 ? "" : "e"} siden`;

  const weeks = Math.floor(days / 7);
  return `for ${weeks} uge${weeks === 1 ? "" : "r"} siden`;
}
