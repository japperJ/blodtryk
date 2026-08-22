"use client";
// Daglig påmindelse (#16): tjekker hvert minut om påmindelsestidspunktet er nået
// og viser MAX ÉN lokal notifikation pr. dag (localStorage date-guard + tag i sw.js).
// Renderes usynligt fra layout.tsx. Indstillinger læses fra localStorage ved hvert tjek,
// så ændringer i Navbar-popoveren træder i kraft uden reload.
import { useEffect } from "react";
import {
  REMINDER_ENABLED_KEY,
  REMINDER_TIME_KEY,
  DEFAULT_REMINDER_TIME,
  LAST_REMINDER_SHOWN_KEY,
  NOTIFICATION_TAG,
  dateKey,
  isReminderDue,
  isValidTime,
} from "@/lib/reminder";
import { useI18n } from "@/lib/I18nProvider";

export default function ReminderScheduler() {
  const { t, locale } = useI18n();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const check = async () => {
      try {
        const enabled = localStorage.getItem(REMINDER_ENABLED_KEY) === "1";
        if (!enabled) return;

        // Kræver både API og givet tilladelse — spørg ALDRIG her (kun via toggle i Navbar).
        if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

        const savedTime = localStorage.getItem(REMINDER_TIME_KEY);
        const reminderTime = savedTime && isValidTime(savedTime) ? savedTime : DEFAULT_REMINDER_TIME;
        const today = dateKey(new Date());
        const lastShown = localStorage.getItem(LAST_REMINDER_SHOWN_KEY);

        if (!isReminderDue(enabled, reminderTime, lastShown, new Date())) return;

        const options: NotificationOptions = {
          body: t("reminder.notificationBody"),
          tag: NOTIFICATION_TAG, // én ad gangen; ny erstatter gammel
          icon: "/icons/icon-192.png",
        };

        // Vis via service worker når den findes (PWA), ellers fallback til Notification-konstruktoren.
        let shown = false;
        if ("serviceWorker" in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(t("reminder.notificationTitle"), options);
            shown = true;
          } catch {
            /* fald tilbage til konstruktoren nedenfor */
          }
        }
        if (!shown) new Notification(t("reminder.notificationTitle"), options);

        // Sæt guarden straks — undgår dobbeltfyring mellem to ticks.
        localStorage.setItem(LAST_REMINDER_SHOWN_KEY, today);
      } catch {
        // Påmindelser må aldrig kunne nedbryde appen.
      }
    };

    check();
    const interval = setInterval(check, 60_000);
    // Indhent forsigtigt når appen vågner igen (mobil PWA i baggrund).
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
    };
    // Re-etabler intervallet hvis sproget skiftes, så notifikationsteksten følger med.
  }, [t, locale]);

  return null;
}
