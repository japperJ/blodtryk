"use client";
// Home-dashboard (#17) — besvarer "hvordan har jeg det?" på to sekunder.
// Datobudget: præcis 2 kald efter persons-opslag (readings + stats); alt andet beregnes client-side.
import { useState, useEffect } from "react";
import Link from "next/link";
import type { Reading, PersonSummary, ReadingStats } from "@/types";
import { getBPStatus, type Severity } from "@/lib/bpClassification";
import { formatRelativeTime } from "@/lib/relativeTime";
import Sparkline from "@/components/dashboard/Sparkline";
import StatusPill from "@/components/dashboard/StatusPill";

const SEVERITY_DOT: Record<Severity, string> = {
  normal: "bg-green-500",
  elevated: "bg-yellow-500",
  stage1: "bg-orange-500",
  stage2: "bg-red-500",
  crisis: "bg-red-600",
};

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
      <main className="min-h-screen bg-gray-50 pb-24">
        <div className="max-w-lg mx-auto p-4 pt-12 text-center">
          <p className="text-4xl mb-4">👤</p>
          <p className="text-lg font-semibold text-gray-900 mb-2">Vælg en person</p>
          <p className="text-gray-500 mb-6">
            Du skal vælge en person for at se dit dashboard.
          </p>
          <Link
            href="/persons"
            className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                       hover:bg-primary-700 active:scale-95 transition-all"
          >
            Gå til personer
          </Link>
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
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        {/* Overskrift */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">🏠 Dashboard</h1>
        <p className="text-sm text-gray-500 mb-4">{person?.name}</p>

        {loading ? (
          <div className="text-center py-12 text-gray-400 animate-pulse">Indlæser...</div>
        ) : (
          <>
            {/* Hero-kort: seneste måling */}
            <section className="bg-white rounded-2xl p-4 shadow-sm border mb-4" aria-label="Seneste måling">
              {latest && latestStatus ? (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-gray-500">Seneste måling</p>
                    <StatusPill status={latestStatus} />
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-bold tracking-tight text-gray-900">{latest.systolic}</span>
                    <span className="text-2xl font-semibold text-gray-400">/</span>
                    <span className="text-3xl font-bold text-gray-700">{latest.diastolic}</span>
                    <span className="text-sm text-gray-400 ml-1">mmHg</span>
                  </div>
                  <p className="text-base text-gray-600 mt-1">
                    ❤️ {latest.pulse} slag/min
                  </p>
                  <p className="text-xs text-gray-400 mt-2">{formatRelativeTime(latest.createdAt)}</p>
                </>
              ) : (
                /* Nul-målinger: venlig CTA i stedet for tomme tal */
                <div className="text-center py-6">
                  <p className="text-lg font-semibold text-gray-800 mb-1">Ingen målinger endnu</p>
                  <p className="text-sm text-gray-500 mb-4">Tag din første måling for at se dit blodtryk her</p>
                  <Link
                    href="/scan"
                    className="inline-block bg-primary-600 text-white px-5 py-2.5 rounded-xl font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all"
                  >
                    📷 Tag en måling
                  </Link>
                </div>
              )}
            </section>

            {/* Mini-sparkline: seneste 14 daglige systolisk-gennemsnit */}
            {sparkValues.length > 0 && (
              <section className="bg-white rounded-2xl p-4 shadow-sm border mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Systolisk</p>
                  <p className="text-xs text-gray-400">Seneste {sparkValues.length} dage</p>
                </div>
                <Sparkline values={sparkValues} />
              </section>
            )}

            {/* Tæller-række: streak + målinger denne uge */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border">
                <p className="text-xl font-bold text-gray-900">🔥 {streakDays}</p>
                <p className="text-xs text-gray-500 mt-0.5">dag{streakDays === 1 ? "" : "e"} i træk</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border">
                <p className="text-xl font-bold text-gray-900">📅 {weekCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">målinger denne uge</p>
              </div>
            </div>

            {/* Medicin-placeholder (#14 lever rigtige data senere) */}
            <p className="text-sm text-gray-400 mb-4">💊 Medicin kommer snart</p>

            {/* Genveje */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Link
                href="/scan"
                className="bg-primary-600 text-white text-center px-4 py-3 rounded-2xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                📷 Scan nu
              </Link>
              <Link
                href="/scan?tab=manual"
                className="bg-white text-primary-700 text-center px-4 py-3 rounded-2xl font-semibold
                           border hover:bg-gray-50 active:scale-95 transition-all"
              >
                ⌨️ Manuelt
              </Link>
            </div>

            {/* Seneste 3 målinger */}
            {latest && (
              <section aria-label="Seneste målinger">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-medium text-gray-500">Seneste målinger</h2>
                  <Link href="/readings" className="text-sm text-primary-600 font-medium hover:text-primary-700">
                    Se alle målinger →
                  </Link>
                </div>
                <div className="space-y-2">
                  {readings.slice(0, 3).map((r) => {
                    const status = getBPStatus(r.systolic, r.diastolic, r.age);
                    const date = new Date(r.createdAt);
                    return (
                      <div key={r.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm border flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${SEVERITY_DOT[status.severity]}`} title={status.label} />
                          <span className="text-sm text-gray-600 truncate">
                            {date.toLocaleDateString("da-DK", { day: "numeric", month: "short" })},{" "}
                            {date.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold text-gray-900 tabular-nums">
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
