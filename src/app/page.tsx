"use client";
// Home-dashboard (#17) — besvarer "hvordan har jeg det?" på to sekunder.
// Datobudget: præcis 2 kald efter persons-opslag (readings + stats); alt andet beregnes client-side.
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  House,
  Camera,
  Keyboard,
  HeartPulse,
  Flame,
  CalendarDays,
  Pill,
  User,
  BellRing,
  X,
} from "lucide-react";
import type { Reading, PersonSummary, ReadingStats } from "@/types";
import { getBPStatus } from "@/lib/bpClassification";
import { formatRelativeTime } from "@/lib/relativeTime";
import {
  BANNER_DISMISSED_KEY,
  REMINDER_ENABLED_KEY,
  REMINDER_TIME_KEY,
  DEFAULT_REMINDER_TIME,
  dateKey,
  isValidTime,
  shouldShowReminderBanner,
} from "@/lib/reminder";
import Sparkline from "@/components/dashboard/Sparkline";
import StatusPill from "@/components/StatusPill";
import EmptyState from "@/components/EmptyState";
import { DashboardSkeleton } from "@/components/Skeleton";
import type { Medication } from "@/components/MedicationPanel";
import { useI18n } from "@/lib/I18nProvider";
import { countKey, INTL_LOCALE } from "@/lib/i18n";

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Påmindelses-banner (#16) — fallback når notifikationer er blokeret/ikke understøttet
  const [now, setNow] = useState(() => new Date());
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(DEFAULT_REMINDER_TIME);
  const [bannerDismissedDate, setBannerDismissedDate] = useState<string | null>(null);

  // Læs påmindelses-indstillinger + sync "nu" hvert minut (og ved fokus-vending),
  // så banneret dukker op selv hvis siden har ligget åben siden før tidspunktet.
  useEffect(() => {
    const sync = () => {
      setRemindersEnabled(localStorage.getItem(REMINDER_ENABLED_KEY) === "1");
      const savedTime = localStorage.getItem(REMINDER_TIME_KEY);
      if (savedTime && isValidTime(savedTime)) setReminderTime(savedTime);
      setBannerDismissedDate(localStorage.getItem(BANNER_DISMISSED_KEY));
      setNow(new Date());
    };
    sync();
    const interval = setInterval(sync, 60_000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  // Afvis i dag → gemmes som dato og nulstilles automatisk ved midnat
  const dismissReminderBanner = () => {
    const key = dateKey(new Date());
    localStorage.setItem(BANNER_DISMISSED_KEY, key);
    setBannerDismissedDate(key);
  };

  useEffect(() => {
    const init = async () => {
      const savedId = localStorage.getItem("selectedPersonId");
      if (!savedId) {
        setLoading(false);
        return;
      }

      // Persons-opslag tæller IKKE med i de 2 datokald
      let selectedPerson: PersonSummary | null = null;
      try {
        const res = await fetch("/api/persons");
        const persons = await res.json();
        selectedPerson = persons.find((p: PersonSummary) => p.id === parseInt(savedId)) ?? null;
      } catch {}
      setPerson(selectedPerson);
      if (!selectedPerson) {
        setLoading(false);
        return;
      }

      // De to tilladte datakald i parallel — alt andet udledes heraf
      try {
        const [readingsRes, statsRes] = await Promise.all([
          fetch(`/api/readings?personId=${savedId}`),
          fetch(`/api/readings/stats?personId=${savedId}&days=30`),
        ]);
        setReadings(await readingsRes.json());
        setStats(await statsRes.json());
      } catch (err) {
        console.error("Kunne ikke hente dashboard-data:", err);
      } finally {
        setLoading(false);
      }

      // Tredje kald: aktive medicin (#14) — uafhængig af de andre
      try {
        const medsRes = await fetch(`/api/persons/${savedId}/medications`);
        if (medsRes.ok) {
          const all: Medication[] = await medsRes.json();
          setMedications(all.filter((m) => m.active));
        }
      } catch {}
    };
    init();
  }, []);

  // Ingen person valgt — samme tom-state-mønster som /readings
  if (!person && !loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        <div className="max-w-lg mx-auto p-4 pt-12">
          <EmptyState
            icon={User}
            title={t("dash.choosePersonTitle")}
            description={t("dash.choosePersonDesc")}
            action={
              <Link
                href="/persons"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                {t("trends.goToPersons")}
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const latest = readings[0];
  const latestStatus = latest ? getBPStatus(latest.systolic, latest.diastolic, latest.age) : null;

  // Banner-betingelser (#16): se shouldShowReminderBanner i lib/reminder.ts.
  // KUN fallback: vises når notifikationer er afvist eller ikke understøttes,
  // og aldrig når der allerede er målt i dag eller banneret er afvist i dag.
  const showReminderBanner =
    !loading &&
    person !== null &&
    shouldShowReminderBanner(
      {
        enabled: remindersEnabled,
        reminderTime,
        latestReadingAt: latest?.createdAt ?? null,
        dismissedDate: bannerDismissedDate,
        permissionSupported: typeof Notification !== "undefined",
        permission: typeof Notification !== "undefined" ? Notification.permission : "default",
      },
      now
    );
  const sparkValues = stats?.daily.slice(-14).map((d) => d.sysAvg) ?? [];
  const weekCount = stats?.weekly.length ? stats.weekly[stats.weekly.length - 1].count : 0;
  const streakDays = stats?.streakDays ?? 0;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        {/* Overskrift */}
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          <House className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden />
          {t("dash.title")}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{person?.name}</p>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Påmindelses-banner (#16) — fallback når notifikationer ikke kan vises */}
            {showReminderBanner && (
              <section
                aria-label={t("reminder.bannerTitle")}
                className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
                  <BellRing className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {t("reminder.bannerText")}
                  </p>
                  <Link
                    href="/scan"
                    className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                  >
                    <Pill className="w-4 h-4" aria-hidden />
                    {t("reminder.measureNow")}
                  </Link>
                </div>
                <button
                  type="button"
                  onClick={dismissReminderBanner}
                  aria-label={t("reminder.dismissLong")}
                  title={t("reminder.dismissShort")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" aria-hidden />
                </button>
              </section>
            )}

            {/* Hero-kort: seneste måling */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-4" aria-label={t("dash.latest")}>
              {latest && latestStatus ? (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("dash.latest")}</p>
                    <StatusPill status={latestStatus} />
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{latest.systolic}</span>
                    <span className="text-2xl font-semibold text-gray-400 dark:text-gray-500">/</span>
                    <span className="text-3xl font-bold text-gray-700 dark:text-gray-200">{latest.diastolic}</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">mmHg</span>
                  </div>
                  <p className="flex items-center gap-1.5 text-base text-gray-600 dark:text-gray-300 mt-1">
                    <HeartPulse className="w-4 h-4 text-red-500" aria-hidden />
                    {latest.pulse} {t("field.bpm")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{formatRelativeTime(latest.createdAt, locale)}</p>
                </>
              ) : (
                /* Nul-målinger: venlig CTA i stedet for tomme tal */
                <EmptyState
                  compact
                  icon={Camera}
                  title={t("dash.emptyTitle")}
                  description={t("dash.emptyDesc")}
                  action={
                    <Link
                      href="/scan"
                      className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-3 rounded-xl font-semibold
                                 hover:bg-primary-700 active:scale-95 transition-all"
                    >
                      <Camera className="w-5 h-5" aria-hidden />
                      {t("dash.emptyCta")}
                    </Link>
                  }
                />
              )}
            </section>

            {/* Mini-sparkline: seneste 14 daglige systolisk-gennemsnit */}
            {sparkValues.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{t("field.systolic")}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("dash.sparkLastDays", { days: sparkValues.length })}</p>
                </div>
                <Sparkline values={sparkValues} />
              </section>
            )}

            {/* Tæller-række: streak + målinger denne uge */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="flex items-center gap-1.5 text-xl font-bold text-gray-900 dark:text-gray-100">
                  <Flame className="w-5 h-5 text-orange-500" aria-hidden />
                  {streakDays}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t(countKey("streak.day", streakDays), { count: streakDays })}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="flex items-center gap-1.5 text-xl font-bold text-gray-900 dark:text-gray-100">
                  <CalendarDays className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden />
                  {weekCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t("streak.thisWeek", { count: weekCount })}</p>
              </div>
            </div>

            {/* Aktive medicin (#14) — skjules helt når ingen aktive */}
            {medications.length > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 mb-4">
                <Pill className="w-4 h-4 shrink-0" aria-hidden />
                <span className="truncate">
                  {medications.map((m) => `${m.name} ${m.dose}`).join(", ")}
                </span>
              </p>
            )}

            {/* Genveje */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Link
                href="/scan"
                className="flex items-center justify-center gap-2 bg-primary-600 text-white text-center px-4 py-3 rounded-2xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                <Camera className="w-5 h-5" aria-hidden />
                {t("dash.scanNow")}
              </Link>
              <Link
                href="/scan?tab=manual"
                className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-300 text-center px-4 py-3 rounded-2xl font-semibold
                           border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
              >
                <Keyboard className="w-5 h-5" aria-hidden />
                {t("dash.manually")}
              </Link>
            </div>

            {/* Seneste 3 målinger */}
            {latest && (
              <section aria-label={t("dash.recent")}>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">{t("dash.recent")}</h2>
                  <Link href="/readings" className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300">
                    {t("dash.viewAll")}
                  </Link>
                </div>
                <div className="space-y-2">
                  {readings.slice(0, 3).map((r) => {
                    const status = getBPStatus(r.systolic, r.diastolic, r.age);
                    const date = new Date(r.createdAt);
                    return (
                      <div key={r.id} className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {date.toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short" })},{" "}
                          {date.toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                            {r.systolic}/{r.diastolic}
                          </span>
                          <StatusPill status={status} size="sm" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
