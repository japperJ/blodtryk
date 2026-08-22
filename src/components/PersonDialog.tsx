"use client";

import { CheckCircle2, Check, Circle, X } from "lucide-react";
import { useState } from "react";
import type { PersonSummary } from "@/types";
import { useI18n } from "@/lib/I18nProvider";
import { countKey } from "@/lib/i18n";

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
  const { t, tError } = useI18n();

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
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pb-[calc(72px+env(safe-area-inset-bottom,0px))] sm:pb-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative dialog-sheet overflow-y-auto bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4 pb-6
                      shadow-xl animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t("dialog.choosePerson")}</h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
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
                             ? "border-primary-500 bg-primary-50 dark:bg-primary-900/40"
                             : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 bg-white dark:bg-gray-800"
                         }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                <span className="text-primary-600">{selectedId === person.id ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6 text-gray-300 dark:text-gray-500" />}</span>
                </span>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{person.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t(countKey("persons.readingCount", person.readingCount), { count: person.readingCount })}
                  </p>
                </div>
              </div>
              {selectedId === person.id && (
                <Check className="w-5 h-5" />
              )}
            </button>
          ))}
        </div>

        {/* Tilføj person */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {isAdding ? (
            <div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddPerson()}
                  placeholder={t("dialog.newNamePlaceholder")}
                  autoFocus
                  className="flex-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                             focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                             text-gray-900 dark:text-gray-100"
                />
                <button
                  onClick={handleAddPerson}
                  disabled={!newName.trim() || isSaving}
                  className="px-4 py-2 min-h-[44px] bg-primary-600 text-white rounded-xl font-medium inline-flex items-center justify-center
                             hover:bg-primary-700 disabled:opacity-50 transition-colors"
                >
                  {isSaving ? "..." : t("common.add")}
                </button>
                <button
                  onClick={() => { setIsAdding(false); setNewName(""); setNewBirthYear(""); setFormError(""); }}
                  className="px-3 py-2 min-h-[44px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {t("common.cancel")}
                </button>
              </div>
              <input
                type="number"
                min={1900}
                max={currentYear}
                value={newBirthYear}
                onChange={(e) => setNewBirthYear(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPerson()}
                placeholder={t("persons.birthYearPlaceholder")}
                className="w-40 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl mt-2
                           focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                           text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              {formError && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">{formError}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2.5 min-h-[44px] border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl
                         text-gray-500 dark:text-gray-400 font-medium hover:border-primary-300 dark:hover:border-primary-500
                         hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {t("dialog.addNewPerson")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
