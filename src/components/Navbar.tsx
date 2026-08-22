"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  House,
  Camera,
  ClipboardList,
  TrendingUp,
  User,
  Settings,
  Sun,
  Moon,
  Monitor,
  BellRing,
  Check,
  Languages,
  type LucideIcon,
} from "lucide-react";
import {
  REMINDER_ENABLED_KEY,
  REMINDER_TIME_KEY,
  DEFAULT_REMINDER_TIME,
  isValidTime,
} from "@/lib/reminder";
import { useI18n } from "@/lib/I18nProvider";

const links: { href: string; labelKey: string; icon: LucideIcon }[] = [
  { href: "/", labelKey: "nav.dashboard", icon: House },
  { href: "/scan", labelKey: "nav.scan", icon: Camera },
  { href: "/readings", labelKey: "nav.readings", icon: ClipboardList },
  { href: "/trends", labelKey: "nav.trends", icon: TrendingUp },
  { href: "/persons", labelKey: "nav.persons", icon: User },
];

type ThemePref = "light" | "dark" | "system";
const THEME_KEY = "theme";
const THEME_COLOR = { light: "#2563eb", dark: "#111827" };

// Anvend temapræference: toggle .dark på <html> + synkroniser theme-color meta
function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document
    .getElementById("theme-color-meta")
    ?.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
}

export default function Navbar() {
  const pathname = usePathname();
  const { t, locale, setLocale } = useI18n();
  const [theme, setTheme] = useState<ThemePref>("system");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Daglig påmindelse (#16) — indstillingerne persisteres øjeblikkeligt ved ændring
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [reminderBlocked, setReminderBlocked] = useState(false);

  // Hent gemt præference efter mount (undgår SSR-mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") {
      setTheme(saved);
      applyTheme(saved);
    }
    // Påmindelse: gendan gemte indstillinger (#16)
    const savedTime = localStorage.getItem(REMINDER_TIME_KEY);
    setReminderEnabled(localStorage.getItem(REMINDER_ENABLED_KEY) === "1");
    if (savedTime && isValidTime(savedTime)) setReminderTime(savedTime);
    if (typeof Notification !== "undefined") {
      setReminderBlocked(Notification.permission === "denied");
    }
  }, []);

  // Følg system-skift mens præferencen er "system"
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(theme);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // Luk popover ved klik udenfor eller Escape
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [settingsOpen]);

  const chooseTheme = useCallback((pref: ThemePref) => {
    setTheme(pref);
    localStorage.setItem(THEME_KEY, pref);
    applyTheme(pref);
    setSettingsOpen(false);
  }, []);

  const themeOptions: { value: ThemePref; labelKey: string; icon: LucideIcon }[] = [
    { value: "light", labelKey: "settings.light", icon: Sun },
    { value: "dark", labelKey: "settings.dark", icon: Moon },
    { value: "system", labelKey: "settings.system", icon: Monitor },
  ];

  // Toggle for daglig påmindelse (#16). Tilladelse spørges KUN ved eksplicit aktivering —
  // aldrig igen bagefter. Ved "denied" forbliver toggle slået til (banner-fallback på forsiden).
  const toggleReminder = useCallback(async () => {
    const next = !reminderEnabled;
    if (next && typeof Notification !== "undefined") {
      try {
        if (Notification.permission === "default") {
          setReminderBlocked((await Notification.requestPermission()) === "denied");
        } else {
          setReminderBlocked(Notification.permission === "denied");
        }
      } catch {
        setReminderBlocked(true);
      }
    }
    setReminderEnabled(next);
    localStorage.setItem(REMINDER_ENABLED_KEY, next ? "1" : "0");
  }, [reminderEnabled]);

  // Tidspunkt persisteres øjeblikkeligt ved ændring
  const changeReminderTime = useCallback((value: string) => {
    setReminderTime(value);
    if (isValidTime(value)) localStorage.setItem(REMINDER_TIME_KEY, value);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
      <div className="max-w-lg mx-auto flex items-stretch">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                active
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={active ? 2.25 : 2} aria-hidden />
              <span className="text-xs font-medium mt-1">{t(link.labelKey)}</span>
            </Link>
          );
        })}

        {/* Indstillinger — temavælger-popover */}
        <div ref={settingsRef} className="relative flex items-center px-1">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={settingsOpen}
            aria-label={t("nav.settings")}
            title={t("nav.settings")}
            className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-6 h-6" aria-hidden />
          </button>

          {settingsOpen && (
            <div
              role="menu"
              aria-label={t("nav.settings")}
              className="absolute bottom-[calc(100%+8px)] right-0 w-64 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1.5"
            >
              <p className="px-2.5 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("settings.theme")}
              </p>
              {themeOptions.map(({ value, labelKey, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === value}
                  onClick={() => chooseTheme(value)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
                    theme === value
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden />
                  {t(labelKey)}
                  {theme === value && <Check className="w-4 h-4 ml-auto" aria-hidden />}
                </button>
              ))}

              {/* Sprog (#24) */}
              <div role="separator" className="my-1 border-t border-gray-200 dark:border-gray-700" />
              <p className="flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <Languages className="w-3.5 h-3.5" aria-hidden />
                {t("settings.language")}
              </p>
              {([
                { value: "da" as const, labelKey: "settings.danish" },
                { value: "en" as const, labelKey: "settings.english" },
              ]).map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === value}
                  onClick={() => setLocale(value)}
                  className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-2.5 text-sm font-medium min-h-[44px] transition-colors ${
                    locale === value
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {t(labelKey)}
                  {locale === value && <Check className="w-4 h-4 ml-auto" aria-hidden />}
                </button>
              ))}

              {/* Daglig påmindelse (#16) */}
              <div role="separator" className="my-1 border-t border-gray-200 dark:border-gray-700" />
              <p className="flex items-center gap-1.5 px-2.5 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <BellRing className="w-3.5 h-3.5" aria-hidden />
                {t("settings.reminder")}
              </p>
              <div className="flex items-center justify-between rounded-lg px-2.5 py-2 min-h-[44px]">
                <span id="reminder-toggle-label" className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {t("settings.remindMe")}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reminderEnabled}
                  aria-labelledby="reminder-toggle-label"
                  onClick={toggleReminder}
                  title={reminderEnabled ? t("settings.reminderOn") : t("settings.reminderOff")}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    reminderEnabled ? "bg-primary-600" : "bg-gray-300 dark:bg-gray-600"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      reminderEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              {reminderEnabled && (
                <div className="flex items-center justify-between rounded-lg px-2.5 py-2 min-h-[44px]">
                  <label htmlFor="reminder-time" className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {t("settings.time")}
                  </label>
                  <input
                    id="reminder-time"
                    type="time"
                    value={reminderTime}
                    onChange={(e) => changeReminderTime(e.target.value)}
                    className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              )}
              {reminderEnabled && reminderBlocked && (
                <p className="px-2.5 pb-1.5 pt-1 text-xs leading-snug text-amber-600 dark:text-amber-400">
                  {t("settings.notificationsBlocked")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
