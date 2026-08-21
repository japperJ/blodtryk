"use client";
import { useState } from "react";
import type { PersonSummary } from "@/types";

interface Props {
  persons: PersonSummary[];
  selectedId: number | null;
  onSelect: (person: PersonSummary) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export default function PersonDialog({
  persons,
  selectedId,
  onSelect,
  onClose,
  onRefresh,
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBirthYear, setNewBirthYear] = useState("");
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Indeværende år — bruges som maksimum for fødselsår
  const currentYear = new Date().getFullYear();

  const handleAddPerson = async () => {
    if (!newName.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const res = await fetch("/api/persons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          birthYear: newBirthYear ? Number(newBirthYear) : null,
        }),
      });

      if (res.ok) {
        const person = await res.json();
        await onRefresh();
        onSelect({ ...person, readingCount: 0, lastReadingAt: null });
        setNewName("");
        setNewBirthYear("");
        setFormError("");
        setIsAdding(false);
      } else {
        const data = await res.json();
        setFormError(data.error || "Kunne ikke oprette person");
      }
    } catch (err) {
      console.error("Failed to create person:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4 pb-6
                      shadow-xl animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900">Vælg person</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Personliste */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {persons.map((person) => (
            <button
              key={person.id}
              onClick={() => onSelect(person)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border-2
                         transition-all ${
                           selectedId === person.id
                             ? "border-primary-500 bg-primary-50"
                             : "border-gray-100 hover:border-gray-200 bg-white"
                         }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {selectedId === person.id ? "👤" : "👤"}
                </span>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{person.name}</p>
                  <p className="text-xs text-gray-500">
                    {person.readingCount} måling{person.readingCount !== 1 ? "er" : ""}
                  </p>
                </div>
              </div>
              {selectedId === person.id && (
                <span className="text-primary-500 text-xl">✓</span>
              )}
            </button>
          ))}
        </div>

        {/* Tilføj person */}
        <div className="mt-4 pt-4 border-t">
          {isAdding ? (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddPerson()}
                  placeholder="Navn på ny person"
                  autoFocus
                  className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl
                             focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                             text-gray-900"
                />
                <button
                  onClick={handleAddPerson}
                  disabled={!newName.trim() || isSaving}
                  className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium
                             hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? "..." : "Tilføj"}
                </button>
                <button
                  onClick={() => { setIsAdding(false); setNewName(""); setNewBirthYear(""); setFormError(""); }}
                  className="px-3 py-2 text-gray-500 hover:text-gray-700"
                >
                  Annuller
                </button>
              </div>
              <input
                type="number"
                min={1900}
                max={currentYear}
                value={newBirthYear}
                onChange={(e) => setNewBirthYear(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPerson()}
                placeholder={`Fødselsår (f.eks. 1950)`}
                className="w-40 px-3 py-2 border-2 border-gray-200 rounded-xl mt-2
                           focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                           text-gray-900 placeholder-gray-300"
              />
              {formError && (
                <p className="text-sm text-red-600 mt-2">{formError}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl
                         text-gray-500 font-medium hover:border-primary-300
                         hover:text-primary-600 transition-colors"
            >
              + Tilføj ny person
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
