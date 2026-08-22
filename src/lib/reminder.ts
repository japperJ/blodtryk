// Påmindelser (#16): rene hjælpefunktioner til dato-/tids-logik.
// Bevidst uden DOM-/React-afhængigheder, så de kan kompileres og testes standalone.

// localStorage-nøgler (delt mellem Navbar-indstillinger, ReminderScheduler og dashboard-banneret)
export const REMINDER_ENABLED_KEY = "reminderEnabled"; // "1" | "0"
export const REMINDER_TIME_KEY = "reminderTime"; // "HH:MM"
export const DEFAULT_REMINDER_TIME = "20:00";
export const LAST_REMINDER_SHOWN_KEY = "lastReminderShown"; // "YYYY-MM-DD" — max én notifikation pr. dag
export const BANNER_DISMISSED_KEY = "reminderBannerDismissed"; // "YYYY-MM-DD" — dismiss nulstilles dagligt
export const NOTIFICATION_TAG = "daily-reminder"; // tag i showNotification → erstatter ældre notifikation

/** Lokal dato som "YYYY-MM-DD" (samme format gemmes/sammenlignes overalt). */
export function dateKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Gyldigt "HH:MM"-format (24 timer)? */
export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * Er påmindelsestidspunktet nået/forbi ("HH:MM", lokal tid)?
 * Sammenligner minutter siden midnat — "20:00" rammer præcis kl. 20:00 og derefter resten af dagen.
 */
export function isTimeReached(time: string, now: Date): boolean {
  if (!isValidTime(time)) return false;
  const [h, m] = time.split(":").map(Number);
  const target = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= target;
}

/** Er der målt i dag? (seneste måling oprettet samme lokale dato — readings er sorteret nyeste først) */
export function hasReadingToday(
  latestReadingAt: string | null | undefined,
  now: Date
): boolean {
  if (!latestReadingAt) return false;
  const created = new Date(latestReadingAt);
  if (isNaN(created.getTime())) return false;
  return dateKey(created) === dateKey(now);
}

/** Skal den daglige NOTIFIKATION sendes nu? Max én pr. dag: date-guard (tag i sw.js er ekstra sikkerhed). */
export function isReminderDue(
  enabled: boolean,
  reminderTime: string,
  lastShownDate: string | null | undefined,
  now: Date
): boolean {
  if (!enabled) return false;
  if (lastShownDate === dateKey(now)) return false; // allerede vist i dag → anti-nag
  return isTimeReached(reminderTime, now);
}

export type ReminderBannerInput = {
  enabled: boolean;
  reminderTime: string; // "HH:MM"
  latestReadingAt: string | null; // ISO for seneste måling for valgt person
  dismissedDate: string | null; // gemt dato for seneste dismiss
  permissionSupported: boolean; // Notification API findes
  permission: "granted" | "denied" | "default";
};

/**
 * Skal dashboard-BANNERET vises lige nu?
 * Banneret er KUN en fallback: det vises når notifikationer er blokeret (denied) eller
 * ikke understøttes — hvis notifikationer kan vises, overtager de (ingen dobbelt-påmindelse).
 */
export function shouldShowReminderBanner(input: ReminderBannerInput, now: Date): boolean {
  if (!input.enabled) return false;
  if (!isTimeReached(input.reminderTime, now)) return false;
  if (input.dismissedDate === dateKey(now)) return false; // afvist i dag → vent til i morgen
  if (hasReadingToday(input.latestReadingAt, now)) return false; // allerede målt i dag
  const notificationsBlockedOrMissing = input.permissionSupported
    ? input.permission === "denied"
    : true;
  return notificationsBlockedOrMissing;
}
