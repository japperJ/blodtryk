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
} from "lucide-react";
import type { Reading, PersonSummary, ReadingStats } from "@/types";
import { getBPStatus } from "@/lib/bpClassification";
import { formatRelativeTime } from "@/lib/relativeTime";
import Sparkline from "@/components/dashboard/Sparkline";
import StatusPill from "@/components/StatusPill";
import EmptyState from "@/components/EmptyState";
import { DashboardSkeleton } from "@/components/Skeleton";

export default function DashboardPage() {
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [loading, setLoading] = useState(true);

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
            title="Vælg en person"
            description="Du skal vælge en person for at se dit dashboard."
            action={
              <Link
                href="/persons"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                Gå til personer
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  const latest = readings[0];
  const latestStatus = latest ? getBPStatus(latest.systolic, latest.diastolic, latest.age) : null;
  const sparkValues = stats?.daily.slice(-14).map((d) => d.sysAvg) ?? [];
  const weekCount = stats?.weekly.length ? stats.weekly[stats.weekly.length - 1].count : 0;
  const streakDays = stats?.streakDays ?? 0;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        {/* Overskrift */}
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
          <House className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden />
          Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{person?.name}</p>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Hero-kort: seneste måling */}
            <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-4" aria-label="Seneste måling">
              {latest && latestStatus ? (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Seneste måling</p>
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
                    {latest.pulse} slag/min
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{formatRelativeTime(latest.createdAt)}</p>
                </>
              ) : (
                /* Nul-målinger: venlig CTA i stedet for tomme tal */
                <EmptyState
                  compact
                  icon={Camera}
                  title="Ingen målinger endnu"
                  description="Tag din første måling for at se dit blodtryk her"
                  action={
                    <Link
                      href="/scan"
                      className="inline-flex items-center gap-2 bg-primary-600 text-white px-5 py-3 rounded-xl font-semibold
                                 hover:bg-primary-700 active:scale-95 transition-all"
                    >
                      <Camera className="w-5 h-5" aria-hidden />
                      Tag en måling
                    </Link>
                  }
                />
              )}
            </section>

            {/* Mini-sparkline: seneste 14 daglige systolisk-gennemsnit */}
            {sparkValues.length > 0 && (
              <section className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Systolisk</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Seneste {sparkValues.length} dage</p>
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">dag{streakDays === 1 ? "" : "e"} i træk</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <p className="flex items-center gap-1.5 text-xl font-bold text-gray-900 dark:text-gray-100">
                  <CalendarDays className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden />
                  {weekCount}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">målinger denne uge</p>
              </div>
            </div>

            {/* Medicin-placeholder (#14 lever rigtige data senere) */}
            <p className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <Pill className="w-4 h-4" aria-hidden />
              Medicin kommer snart
            </p>

            {/* Genveje */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Link
                href="/scan"
                className="flex items-center justify-center gap-2 bg-primary-600 text-white text-center px-4 py-3 rounded-2xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                <Camera className="w-5 h-5" aria-hidden />
                Scan nu
              </Link>
              <Link
                href="/scan?tab=manual"
                className="flex items-center justify-center gap-2 bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-300 text-center px-4 py-3 rounded-2xl font-semibold
                           border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
              >
                <Keyboard className="w-5 h-5" aria-hidden />
                Manuelt
              </Link>
            </div>

            {/* Seneste 3 målinger */}
            {latest && (
              <section aria-label="Seneste målinger">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">Seneste målinger</h2>
                  <Link href="/readings" className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300">
                    Se alle målinger →
                  </Link>
                </div>
                <div className="space-y-2">
                  {readings.slice(0, 3).map((r) => {
                    const status = getBPStatus(r.systolic, r.diastolic, r.age);
                    const date = new Date(r.createdAt);
                    return (
                      <div key={r.id} className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {date.toLocaleDateString("da-DK", { day: "numeric", month: "short" })},{" "}
                          {date.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
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
