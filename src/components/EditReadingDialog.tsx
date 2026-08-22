"use client";

import { X } from "lucide-react";
import { useState } from "react";
import type { Reading, TimeOfDay, Arm } from "@/types";
import { useI18n } from "@/lib/I18nProvider";
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
  const { t, tError } = useI18n();

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
        setFormError(data?.error ? tError(data.error) : t("edit.saveError"));
      }
    } catch (err) {
      console.error("Failed to update reading:", err);
      setFormError(t("edit.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pb-[calc(72px+env(safe-area-inset-bottom,0px))] sm:pb-0">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog — fleks-kolonne: header + handlinger øverst + rulbart indhold.
          Handlingerne ligger ØVERST, så Gem altid kan nås, selv når mobil-
          tastaturet dækker bunden af skærmen (issue #40). */}
      <div
        className="relative dialog-sheet flex flex-col bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md
                        shadow-xl animate-in slide-in-from-bottom duration-200"
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 pt-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t("edit.title")}</h2>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl"
            title={t("common.close")}
            aria-label={t("common.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Handlinger — fast placeret øverst, aldrig bag tastaturet */}
        <div className="flex gap-3 px-4 pt-3 shrink-0">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl font-semibold
                       hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold
                       hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {isSaving ? t("common.saving") : t("common.save")}
          </button>
        </div>

        {/* Rulbart indhold */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">

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
            {t("field.note")}
          </label>
          <textarea
            id="reading-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("edit.notePlaceholder")}
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
        </div>
      </div>
    </div>
  );
}
