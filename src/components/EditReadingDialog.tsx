"use client";

import { X } from "lucide-react";
import { useState } from "react";
import type { Reading, TimeOfDay, Arm } from "@/types";
import ReadingStepper, { type ReadingStepperKey } from "./ReadingStepper";
import ContextTagChips from "./ContextTagChips";

// Samme grænse som serverens validering (NOTE_MAX_LENGTH i lib/validation.ts)
const NOTE_MAX_LENGTH = 500;

interface Props {
  reading: Reading;
  onClose: () => void;
  onSaved: (updated: Reading) => void;
}

export default function EditReadingDialog({ reading, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<ReadingStepperKey, number>>({
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    pulse: reading.pulse,
  });
  const [note, setNote] = useState(reading.note ?? "");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay | null>(reading.timeOfDay ?? null);
  const [arm, setArm] = useState<Arm | null>(reading.arm ?? null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleTagChange = (field: "timeOfDay" | "arm", value: string | null) => {
    if (field === "timeOfDay") {
      setTimeOfDay(value as TimeOfDay | null);
    } else {
      setArm(value as Arm | null);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setFormError("");
    try {
      const res = await fetch(`/api/readings/${reading.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systolic: values.systolic,
          diastolic: values.diastolic,
          pulse: values.pulse,
          // Tom note = ryddet note
          note: note.trim() === "" ? null : note.trim(),
          // Tags sendes altid med, så de kan sættes eller ryddes
          timeOfDay,
          arm,
        }),
      });

      if (res.ok) {
        const updated: Reading = await res.json();
        onSaved(updated);
      } else {
        const data = await res.json().catch(() => null);
        setFormError(data?.error || "Kunne ikke opdatere måling");
      }
    } catch (err) {
      console.error("Failed to update reading:", err);
      setFormError("Kunne ikke opdatere måling");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4 pb-6
                        shadow-xl animate-in slide-in-from-bottom duration-200
                        max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Rediger måling</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl"
            title="Luk"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Værdier — samme stepper som kamera-flow og manuel indtastning */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 mb-3">
          <ReadingStepper
            values={values}
            onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          />
        </div>

        {/* Kontekst-tags — morgen/aften og arm (valgfri) */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 mb-3">
          <ContextTagChips timeOfDay={timeOfDay} arm={arm} onChange={handleTagChange} />
        </div>

        {/* Note */}
        <div>
          <label htmlFor="reading-note" className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Note
          </label>
          <textarea
            id="reading-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note til målingen..."
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            className="w-full mt-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl resize-none
                       focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                       text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <p className="text-[10px] text-gray-500 dark:text-gray-400 text-right">
            {note.length}/{NOTE_MAX_LENGTH}
          </p>
        </div>

        {formError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">{formError}</p>
        )}

        {/* Handlinger */}
        <div className="flex gap-3 mt-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold
                       hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all disabled:opacity-50"
          >
            Annuller
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold
                       hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? "Gemmer..." : "Gem"}
          </button>
        </div>
      </div>
    </div>
  );
}
