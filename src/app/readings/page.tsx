"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  Sunrise,
  Moon,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  FileJson,
  Stethoscope,
  Filter,
  User,
} from "lucide-react";
import ReadingCard from "@/components/ReadingCard";
import EditReadingDialog from "@/components/EditReadingDialog";
import PdfExport from "@/components/PdfExport";
import EmptyState from "@/components/EmptyState";
import { ReadingCardSkeleton } from "@/components/Skeleton";
import { downloadReadingsCsv, downloadReadingsJson } from "@/lib/exporters";
import type { Reading, PersonSummary } from "@/types";
import Link from "next/link";

type FilterType = "all" | "with-image" | "without-image";
type TimeFilterType = "all" | "morning" | "evening";

export default function ReadingsPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>("all");
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null);
  const [editingReading, setEditingReading] = useState<Reading | null>(null);

  const fetchReadings = useCallback(async () => {
    const savedId = localStorage.getItem("selectedPersonId");
    if (!savedId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/readings?personId=${savedId}`);
      const data = await res.json();
      setReadings(data);
    } catch (err) {
      console.error("Failed to fetch readings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const savedId = localStorage.getItem("selectedPersonId");
      if (savedId) {
        try {
          const res = await fetch("/api/persons");
          const persons = await res.json();
          const person = persons.find((p: PersonSummary) => p.id === parseInt(savedId));
          if (person) setSelectedPerson(person);
        } catch {}
      }
      await fetchReadings();
    };
    init();
  }, [fetchReadings]);

  const handleDelete = async (id: number) => {
    if (!confirm("Sikker på du vil slette denne måling?")) return;
    try {
      await fetch(`/api/readings/${id}`, { method: "DELETE" });
      setReadings((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  // Efter vellykket PATCH: opdatér målingen direkte i liste-state (uden refetch).
  // Status-badge og farver genberegnes automatisk i ReadingCard ud fra de nye værdier.
  const handleEditSaved = (updated: Reading) => {
    setReadings((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setEditingReading(null);
  };

  const filteredReadings = readings.filter((r) => {
    // Billedfilter
    switch (filter) {
      case "with-image":
        if (!r.image) return false;
        break;
      case "without-image":
        if (r.image) return false;
        break;
    }
    // Tidspunkt-filter (kombineres med billedfilteret)
    switch (timeFilter) {
      case "morning":
        if (r.timeOfDay !== "morning") return false;
        break;
      case "evening":
        if (r.timeOfDay !== "evening") return false;
        break;
    }
    return true;
  });

  const withImageCount = readings.filter(r => r.image).length;
  const withoutImageCount = readings.filter(r => !r.image).length;
  const morningCount = readings.filter(r => r.timeOfDay === "morning").length;
  const eveningCount = readings.filter(r => r.timeOfDay === "evening").length;

  // Ingen person valgt
  if (!selectedPerson && !loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        <div className="max-w-lg mx-auto p-4 pt-12">
          <EmptyState
            icon={User}
            title="Vælg en person"
            description="Du skal vælge en person for at se målinger."
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

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
              <ClipboardList className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden />
              Målinger
            </h1>
            {selectedPerson && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{selectedPerson.name}</p>
            )}
          </div>
          {filteredReadings.length > 0 && selectedPerson && (
            <div className="flex items-center gap-1.5 shrink-0">
              {/* CSV/JSON eksporterer den FILTREREDE liste (#11) */}
              <button
                onClick={() =>
                  downloadReadingsCsv(filteredReadings, selectedPerson.name)
                }
                title="Eksportér filtrerede målinger til CSV (dansk Excel-venlig)"
                className="inline-flex items-center min-h-[44px] gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm px-3 py-2 rounded-lg font-medium
                           hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all shadow-sm"
              >
                <FileSpreadsheet className="w-4 h-4 text-green-700" aria-hidden />
                CSV
              </button>
              <button
                onClick={() =>
                  downloadReadingsJson(filteredReadings, selectedPerson.name)
                }
                title="Eksportér filtrerede målinger til JSON"
                className="inline-flex items-center min-h-[44px] gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm px-3 py-2 rounded-lg font-medium
                           hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all shadow-sm"
              >
                <FileJson className="w-4 h-4 text-amber-600" aria-hidden />
                JSON
              </button>
              <PdfExport readings={filteredReadings} personName={selectedPerson.name} />
            </div>
          )}
        </div>

        {readings.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${filter === "all"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              Alle ({readings.length})
            </button>
            <button
              onClick={() => setFilter("with-image")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${filter === "with-image"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <ImageIcon className="w-4 h-4" aria-hidden />
              Med billede ({withImageCount})
            </button>
            <button
              onClick={() => setFilter("without-image")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${filter === "without-image"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <FileText className="w-4 h-4" aria-hidden />
              Uden billede ({withoutImageCount})
            </button>
          </div>
        )}

        {/* Tidspunkt-filter — kan kombineres med billedfilteret */}
        {readings.length > 0 && (morningCount > 0 || eveningCount > 0) && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setTimeFilter("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${timeFilter === "all"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              Alle tider
            </button>
            <button
              onClick={() => setTimeFilter("morning")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${timeFilter === "morning"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <Sunrise className="w-4 h-4" aria-hidden />
              Morgen ({morningCount})
            </button>
            <button
              onClick={() => setTimeFilter("evening")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${timeFilter === "evening"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              <Moon className="w-4 h-4" aria-hidden />
              Aften ({eveningCount})
            </button>
          </div>
        )}

        {loading ? (
          /* Skelet-layout (#12): samme form som kortene */
          <div className="space-y-3" aria-busy="true" aria-label="Indlæser målinger">
            <ReadingCardSkeleton />
            <ReadingCardSkeleton />
            <ReadingCardSkeleton />
          </div>
        ) : filteredReadings.length === 0 ? (
          filter === "all" ? (
            <EmptyState
              icon={Stethoscope}
              title="Ingen målinger endnu"
              description="Tag din første måling for at komme i gang"
              action={
                <Link
                  href="/scan"
                  className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  Tag en måling
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon={Filter}
              title="Ingen målinger med dette filter"
              action={
                <button
                  onClick={() => setFilter("all")}
                  className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:text-primary-700 dark:hover:text-primary-300"
                >
                  Vis alle målinger
                </button>
              }
            />
          )
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {filteredReadings.length} måling{filteredReadings.length !== 1 ? 'er' : ''}
              {(filter !== "all" || timeFilter !== "all") && ` (filtreret)`}
            </p>
            <div className="space-y-3">
              {filteredReadings.map((r) => (
                <ReadingCard
                  key={r.id}
                  reading={r}
                  onDelete={handleDelete}
                  onEdit={setEditingReading}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Rediger-dialog */}
      {editingReading && (
        <EditReadingDialog
          reading={editingReading}
          onClose={() => setEditingReading(null)}
          onSaved={handleEditSaved}
        />
      )}
    </main>
  );
}
