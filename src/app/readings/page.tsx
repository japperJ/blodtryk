"use client";
import { useState, useEffect, useCallback } from "react";
import ReadingCard from "@/components/ReadingCard";
import EditReadingDialog from "@/components/EditReadingDialog";
import PdfExport from "@/components/PdfExport";
import type { Reading, PersonSummary } from "@/types";
import Link from "next/link";

type FilterType = "all" | "with-image" | "without-image";

export default function ReadingsPage() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
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
    switch (filter) {
      case "with-image":
        return !!r.image;
      case "without-image":
        return !r.image;
      default:
        return true;
    }
  });

  const withImageCount = readings.filter(r => r.image).length;
  const withoutImageCount = readings.filter(r => !r.image).length;

  // Ingen person valgt
  if (!selectedPerson && !loading) {
    return (
      <main className="min-h-screen bg-gray-50 pb-24">
        <div className="max-w-lg mx-auto p-4 pt-12 text-center">
          <p className="text-4xl mb-4">👤</p>
          <p className="text-lg font-semibold text-gray-900 mb-2">Vælg en person</p>
          <p className="text-gray-500 mb-6">
            Du skal vælge en person for at se målinger.
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📋 Målinger</h1>
            {selectedPerson && (
              <p className="text-sm text-gray-500 mt-0.5">{selectedPerson.name}</p>
            )}
          </div>
          {readings.length > 0 && selectedPerson && (
            <PdfExport readings={readings} personName={selectedPerson.name} />
          )}
        </div>

        {readings.length > 0 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${filter === "all"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Alle ({readings.length})
            </button>
            <button
              onClick={() => setFilter("with-image")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${filter === "with-image"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              🖼️ Med billede ({withImageCount})
            </button>
            <button
              onClick={() => setFilter("without-image")}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${filter === "without-image"
                           ? 'bg-primary-600 text-white'
                           : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              📝 Uden billede ({withoutImageCount})
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400 animate-pulse">Indlæser...</div>
        ) : filteredReadings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🩺</p>
            {filter === "all" ? (
              <>
                <p className="text-gray-600">Ingen målinger endnu</p>
                <p className="text-sm text-gray-400 mt-1">Tag din første måling for at komme i gang</p>
              </>
            ) : (
              <>
                <p className="text-gray-600">Ingen målinger med dette filter</p>
                <button
                  onClick={() => setFilter("all")}
                  className="mt-2 text-sm text-primary-600 font-medium"
                >
                  Vis alle målinger
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {filteredReadings.length} måling{filteredReadings.length !== 1 ? 'er' : ''}
              {filter !== "all" && ` (filtreret)`}
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
