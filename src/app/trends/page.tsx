"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BPLineChart, { LINE_COLORS } from "@/components/charts/BPLineChart";
import type { TargetBand } from "@/components/charts/BPLineChart";
import DistributionBar from "@/components/charts/DistributionBar";
import type { ClassificationSegment } from "@/components/charts/DistributionBar";
import { getAgeGroupLabel, type Severity } from "@/lib/bpClassification";
import type { PersonSummary, ReadingStats } from "@/types";

type RangeValue = "7" | "30" | "90" | "all";

const RANGES: { value: RangeValue; label: string }[] = [
  { value: "7", label: "7 dage" },
  { value: "30", label: "30 dage" },
  { value: "90", label: "90 dage" },
  { value: "all", label: "Alt" },
];

// Målbånd pr. aldersgruppe — matcher grænserne i lib/bpClassification.ts (#10-spec)
function getTargetBand(age: number | null): TargetBand {
  if (age == null || age < 65) return { sysMin: 90, sysMax: 130, diaMin: 60, diaMax: 85 };
  if (age < 80) return { sysMin: 90, sysMax: 140, diaMin: 60, diaMax: 85 };
  return { sysMin: 90, sysMax: 140, diaMin: 60, diaMax: 80 };
}

// Dansk kort dato: "20/8"
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function TrendsPage() {
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeValue>("30");
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(false);

  // Samme person-valg-mønster som /readings: localStorage + /api/persons
  useEffect(() => {
    const init = async () => {
      const savedId = localStorage.getItem("selectedPersonId");
      if (savedId) {
        try {
          const res = await fetch("/api/persons");
          const persons = await res.json();
          const found = persons.find((p: PersonSummary) => p.id === parseInt(savedId));
          if (found) setPerson(found);
        } catch {}
      }
      setLoading(false);
    };
    init();
  }, []);

  const fetchStats = useCallback(async () => {
    if (!person) return;
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/readings/stats?personId=${person.id}&days=${range}`);
      const data: ReadingStats = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Kunne ikke hente statistik:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [person, range]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Alder og målbånd for den valgte person (manglende fødselsår → under 65)
  const age =
    person?.birthYear != null ? new Date().getFullYear() - person.birthYear : null;
  const band = getTargetBand(age);
  const ageGroupLabel = age == null ? "Under 65 år" : getAgeGroupLabel(age);

  // Klassificerings-segmenter med sværhedsgrad-farver som resten af appen
  const classificationSegments: ClassificationSegment[] = (stats?.classification ?? []).map(
    (c) => ({ severity: c.severity as Severity, label: c.label, count: c.count })
  );

  // Ingen person valgt — samme tom-state-mønster som /readings
  if (!person && !loading) {
    return (
      <main className="min-h-screen bg-gray-50 pb-24">
        <div className="max-w-lg mx-auto p-4 pt-12 text-center">
          <p className="text-4xl mb-4">👤</p>
          <p className="text-lg font-semibold text-gray-900 mb-2">Vælg en person</p>
          <p className="text-gray-500 mb-6">
            Du skal vælge en person for at se tendenser.
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

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">📈 Tendenser</h1>
          {person && (
            <p className="text-sm text-gray-500 mt-0.5">{person.name}</p>
          )}
        </div>

        {/* Interval-vælger — pill chips som filtrene på /readings */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${range === r.value
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {statsLoading ? (
          <div className="text-center py-12 text-gray-400 animate-pulse">Indlæser...</div>
        ) : !stats || stats.count === 0 ? (
          /* Tom state: personen har ingen målinger i det valgte interval */
          <div className="bg-white rounded-2xl p-4 shadow-sm border text-center py-10">
            <p className="text-4xl mb-3">📉</p>
            <p className="font-medium text-gray-900">Ingen målinger i denne periode</p>
            <p className="text-sm text-gray-400 mt-1 mb-5">
              Prøv et længere interval, eller scan en ny måling.
            </p>
            <Link
              href="/scan"
              className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                         hover:bg-primary-700 active:scale-95 transition-all"
            >
              📸 Scan en måling
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Nøgletal */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-400">Gennemsnit</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.avg.systolic}/{stats.avg.diastolic}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Puls</p>
                <p className="text-lg font-bold text-gray-900">{stats.avg.pulse}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Streak</p>
                <p className="text-lg font-bold text-gray-900">
                  {stats.streakDays > 0 ? `🔥 ${stats.streakDays}` : "0"}
                </p>
              </div>
            </div>

            {/* Linjediagram: daglige gennemsnit + målbånd */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900">Daglige gennemsnit</h2>
                <button
                  onClick={() => setShowPulse((v) => !v)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all
                             ${showPulse
                               ? "bg-purple-100 text-purple-700"
                               : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                >
                  Puls
                </button>
              </div>
              <BPLineChart data={stats.daily} band={band} showPulse={showPulse} />
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: LINE_COLORS.systolic }}
                    aria-hidden
                  />
                  Systolisk
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: LINE_COLORS.diastolic }}
                    aria-hidden
                  />
                  Diastolisk
                </span>
                {showPulse && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: LINE_COLORS.pulse }}
                      aria-hidden
                    />
                    Puls
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-sm bg-green-500/25 border border-green-500/40"
                    aria-hidden
                  />
                  Målbånd ({ageGroupLabel})
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Sys {band.sysMin}–{band.sysMax} · Dia {band.diaMin}–{band.diaMax} mmHg ·{" "}
                {stats.count} målinger
              </p>
            </div>

            {/* Ugentlige gennemsnit — kompakte bar-rækker */}
            {stats.weekly.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Ugentlige gennemsnit</h2>
                <div className="space-y-3">
                  {stats.weekly.map((w) => (
                    <div key={w.weekStart} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs text-gray-500">
                        {shortDate(w.weekStart)}
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (w.sysAvg / 200) * 100)}%`,
                              backgroundColor: LINE_COLORS.systolic,
                            }}
                          />
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (w.diaAvg / 200) * 100)}%`,
                              backgroundColor: LINE_COLORS.diastolic,
                            }}
                          />
                        </div>
                      </div>
                      <span className="w-14 shrink-0 text-right text-xs font-medium text-gray-700 tabular-nums">
                        {w.sysAvg}/{w.diaAvg}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                        {w.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Klassificerings-fordeling */}
            {classificationSegments.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">
                  Klassificering af målinger
                </h2>
                <DistributionBar segments={classificationSegments} />
              </div>
            )}

            {/* Morgen/aften-sammenligning — kun når der findes taggede målinger */}
            {stats.byTimeOfDay && (
              <div className={`grid gap-3 ${stats.byTimeOfDay.morning && stats.byTimeOfDay.evening ? "grid-cols-2" : "grid-cols-1"}`}>
                {stats.byTimeOfDay.morning && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm border text-center">
                    <p className="text-xs text-gray-400">🌅 Morgen</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">
                      {stats.byTimeOfDay.morning.sysAvg}
                      <span className="text-xs font-normal text-gray-400"> mmHg sys</span>
                    </p>
                  </div>
                )}
                {stats.byTimeOfDay.evening && (
                  <div className="bg-white rounded-2xl p-4 shadow-sm border text-center">
                    <p className="text-xs text-gray-400">🌙 Aften</p>
                    <p className="text-xl font-bold text-gray-900 mt-0.5">
                      {stats.byTimeOfDay.evening.sysAvg}
                      <span className="text-xs font-normal text-gray-400"> mmHg sys</span>
                    </p>
                  </div>
                )}
                {stats.byTimeOfDay.morning && stats.byTimeOfDay.evening && (
                  <div className="col-span-full text-center text-xs text-gray-500 -mt-1">
                    {(() => {
                      const diff =
                        stats.byTimeOfDay!.evening!.sysAvg - stats.byTimeOfDay!.morning!.sysAvg;
                      if (diff === 0) return "Morgen og aften er ens";
                      return diff > 0
                        ? `Aftenen ligger ${diff} mmHg over morgenen`
                        : `Morgenen ligger ${-diff} mmHg over aftenen`;
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
