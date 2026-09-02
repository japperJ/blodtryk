"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Sunrise, Moon, Flame, Camera, User } from "lucide-react";
import BPLineChart, { LINE_COLORS } from "@/components/charts/BPLineChart";
import type { TargetBand } from "@/components/charts/BPLineChart";
import DistributionBar from "@/components/charts/DistributionBar";
import type { ClassificationSegment } from "@/components/charts/DistributionBar";
import { getAgeGroupKey, type Severity } from "@/lib/bpClassification";
import EmptyState from "@/components/EmptyState";
import { TrendsSkeleton } from "@/components/Skeleton";
import { useI18n } from "@/lib/I18nProvider";
import type { PersonSummary, ReadingStats } from "@/types";

type RangeValue = "7" | "30" | "90" | "all";

const RANGES: { value: RangeValue; labelKey: string }[] = [
  { value: "7", labelKey: "trends.range7" },
  { value: "30", labelKey: "trends.range30" },
  { value: "90", labelKey: "trends.range90" },
  { value: "all", labelKey: "trends.rangeAll" },
];

// Målbånd pr. aldersgruppe — matcher grænserne i lib/bpClassification.ts (#10-spec)
function getTargetBand(age: number | null): TargetBand {
  if (age == null || age < 65) return { sysMin: 90, sysMax: 130, diaMin: 60, diaMax: 85, mapMin: 60, mapMax: 85 };
  if (age < 80) return { sysMin: 90, sysMax: 140, diaMin: 60, diaMax: 85, mapMin: 60, mapMax: 85 };
  return { sysMin: 90, sysMax: 140, diaMin: 60, diaMax: 80, mapMin: 60, mapMax: 85 };
}

// Dansk kort dato: "20/8"
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function TrendsPage() {
  const { t } = useI18n();
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeValue>("30");
  const [stats, setStats] = useState<ReadingStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showSystolic, setShowSystolic] = useState(true);
  const [showDiastolic, setShowDiastolic] = useState(true);
  const [showMap, setShowMap] = useState(false);
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
  const ageGroupKey = age == null ? "ageGroup.under65" : getAgeGroupKey(age);

  // Klassificerings-segmenter med sværhedsgrad-farver som resten af appen
  const classificationSegments: ClassificationSegment[] = (stats?.classification ?? []).map(
    (c) => ({ severity: c.severity as Severity, label: t(c.labelKey), count: c.count })
  );

  // Ingen person valgt — samme tom-state-mønster som /readings
  if (!person && !loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        <div className="max-w-lg mx-auto p-4 pt-12">
          <EmptyState
            icon={User}
            title={t("dash.choosePersonTitle")}
            description={t("trends.choosePersonDesc")}
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        <div className="mb-5">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <TrendingUp className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden />
            {t("trends.heading")}
          </h1>
          {person && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{person.name}</p>
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
                           : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>

        {statsLoading ? (
          /* Skelet-layout (#12): nøgletal + diagramblok + bar-rækker */
          <div aria-busy="true" aria-label={t("trends.loading")}>
            <TrendsSkeleton />
          </div>
        ) : !stats || stats.count === 0 ? (
          /* Tom state: personen har ingen målinger i det valgte interval */
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <EmptyState
              icon={TrendingDown}
              title={t("trends.emptyTitle")}
              description={t("trends.emptyDesc")}
              action={
                <Link
                  href="/scan"
                  className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  <Camera className="w-5 h-5" aria-hidden />
                  {t("trends.emptyCta")}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Nøgletal */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("trends.average")}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {stats.avg.systolic}/{stats.avg.diastolic}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("field.map")}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {stats.avg.map ?? Math.round((stats.avg.systolic + 2 * stats.avg.diastolic) / 3)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("field.pulse")}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.avg.pulse}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("trends.streak")}</p>
                <p className="flex items-center justify-center gap-1 text-lg font-bold text-gray-900 dark:text-gray-100">
                  <Flame className="w-5 h-5 text-orange-500" aria-hidden />
                  {stats.streakDays > 0 ? stats.streakDays : "0"}
                </p>
              </div>
            </div>

            {/* Linjediagram: daglige gennemsnit + målbånd */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2 gap-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("trends.dailyAvg")}</h2>
                <div className="flex flex-wrap justify-end gap-2">
                  {[
                    { label: t("field.systolic"), active: showSystolic, onClick: () => setShowSystolic((v) => !v), color: LINE_COLORS.systolic },
                    { label: t("field.diastolic"), active: showDiastolic, onClick: () => setShowDiastolic((v) => !v), color: LINE_COLORS.diastolic },
                    { label: t("field.map"), active: showMap, onClick: () => setShowMap((v) => !v), color: LINE_COLORS.map },
                    { label: t("field.pulse"), active: showPulse, onClick: () => setShowPulse((v) => !v), color: LINE_COLORS.pulse },
                  ].map((filter) => (
                    <button
                      key={filter.label}
                      onClick={filter.onClick}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${filter.active
                        ? "border-transparent text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600"}`}
                      style={filter.active ? { backgroundColor: filter.color } : undefined}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              <BPLineChart
                data={stats.daily}
                band={band}
                showSystolic={showSystolic}
                showDiastolic={showDiastolic}
                showMap={showMap}
                showPulse={showPulse}
              />
              {showMap && (() => {
                const mapValue = stats.avg.map ?? Math.round((stats.avg.systolic + 2 * stats.avg.diastolic) / 3);
                const min = band.mapMin ?? 60;
                const max = band.mapMax ?? 85;
                const summaryKey = mapValue < min
                  ? "trends.mapSummaryBelow"
                  : mapValue > max
                    ? "trends.mapSummaryAbove"
                    : "trends.mapSummaryInRange";

                return (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                    {t(summaryKey, {
                      map: mapValue,
                      sys: stats.avg.systolic,
                      dia: stats.avg.diastolic,
                      min,
                      max,
                    })}
                  </p>
                );
              })()}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                {showSystolic && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: LINE_COLORS.systolic }}
                      aria-hidden
                    />
                    {t("field.systolic")}
                  </span>
                )}
                {showDiastolic && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: LINE_COLORS.diastolic }}
                      aria-hidden
                    />
                    {t("field.diastolic")}
                  </span>
                )}
                {showMap && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: LINE_COLORS.map }}
                      aria-hidden
                    />
                    {t("field.map")}
                  </span>
                )}
                {showPulse && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: LINE_COLORS.pulse }}
                      aria-hidden
                    />
                    {t("field.pulse")}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-sm bg-green-500/25 border border-green-500/40"
                    aria-hidden
                  />
                  {ageGroupKey ? t("trends.bandLegend", { group: t(ageGroupKey) }) : t("trends.bandLegend", { group: "" })}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Sys {band.sysMin}–{band.sysMax} · Dia {band.diaMin}–{band.diaMax} mmHg ·{" "}
                {t("trends.legendCount", { count: stats.count })}
              </p>
            </div>

            {/* Ugentlige gennemsnit — kompakte bar-rækker */}
            {stats.weekly.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">{t("trends.weeklyAvg")}</h2>
                <div className="space-y-3">
                  {stats.weekly.map((w) => {
                    const mapValue = w.mapAvg ?? Math.round((w.sysAvg + 2 * w.diaAvg) / 3);
                    return (
                      <div key={w.weekStart} className="flex items-center gap-2">
                        <span className="w-12 shrink-0 text-xs text-gray-500 dark:text-gray-400">
                          {shortDate(w.weekStart)}
                        </span>
                        <div className="flex-1 space-y-1">
                          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (w.sysAvg / 200) * 100)}%`,
                                backgroundColor: LINE_COLORS.systolic,
                              }}
                            />
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (w.diaAvg / 200) * 100)}%`,
                                backgroundColor: LINE_COLORS.diastolic,
                              }}
                            />
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, (mapValue / 200) * 100)}%`,
                                backgroundColor: LINE_COLORS.map,
                              }}
                            />
                          </div>
                        </div>
                        <div className="min-w-[72px] shrink-0 text-right text-[11px] font-medium text-gray-700 dark:text-gray-200 tabular-nums">
                          <div>{w.sysAvg}/{w.diaAvg}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">MAP {mapValue}</div>
                        </div>
                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-0.5">
                          {w.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Klassificerings-fordeling */}
            {classificationSegments.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  {t("trends.classification")}
                </h2>
                <DistributionBar segments={classificationSegments} />
              </div>
            )}

            {/* Morgen/aften-sammenligning — kun når der findes taggede målinger */}
            {stats.byTimeOfDay && (
              <div className={`grid gap-3 ${stats.byTimeOfDay.morning && stats.byTimeOfDay.evening ? "grid-cols-2" : "grid-cols-1"}`}>
                {stats.byTimeOfDay.morning && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                    <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Sunrise className="w-4 h-4 text-amber-500" aria-hidden />
                      {t("tod.morning")}
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                      {stats.byTimeOfDay.morning.sysAvg}
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400"> {t("trends.mmhgSys")}</span>
                    </p>
                  </div>
                )}
                {stats.byTimeOfDay.evening && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                    <p className="flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Moon className="w-4 h-4 text-indigo-500" aria-hidden />
                      {t("tod.evening")}
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                      {stats.byTimeOfDay.evening.sysAvg}
                      <span className="text-xs font-normal text-gray-500 dark:text-gray-400"> {t("trends.mmhgSys")}</span>
                    </p>
                  </div>
                )}
                {stats.byTimeOfDay.morning && stats.byTimeOfDay.evening && (
                  <div className="col-span-full text-center text-xs text-gray-500 dark:text-gray-400 -mt-1">
                    {(() => {
                      const diff =
                        stats.byTimeOfDay!.evening!.sysAvg - stats.byTimeOfDay!.morning!.sysAvg;
                      if (diff === 0) return t("trends.timesEqual");
                      return diff > 0
                        ? t("trends.eveningHigher", { diff })
                        : t("trends.morningHigher", { diff: -diff });
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
