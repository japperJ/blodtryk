"use client";

import { Pencil, X, Check } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/I18nProvider";

interface Props {
  /** Initial reading values (from OCR or manual) */
  initialReading: {
    systolic: number;
    diastolic: number;
    pulse: number;
  };
  /** Optional pre-filled context tags */
  initialTimeOfDay?: "morning" | "evening" | null;
  initialArm?: "left" | "right" | null;
  initialNote?: string | null;
  /** Person's age for validation context (optional) */
  age?: number | null;
  /** Called when user saves with valid values */
  onSave: (values: {
    systolic: number;
    diastolic: number;
    pulse: number;
    timeOfDay: "morning" | "evening" | null;
    arm: "left" | "right" | null;
    note: string | null;
  }) => void;
  /** Called when user cancels */
  onCancel: () => void;
  /** Optional error message to display */
  error?: string | null;
}

export default function ManualReadingEditor({
  initialReading,
  initialTimeOfDay = null,
  initialArm = null,
  initialNote = null,
  age,
  onSave,
  onCancel,
  error,
}: Props) {
  const { t, tError } = useI18n();
  const [isEditing, setIsEditing] = useState(true); // Start in edit mode for batch failed items
  const [editedReading, setEditedReading] = useState(initialReading);
  const [timeOfDay, setTimeOfDay] = useState<"morning" | "evening" | null>(initialTimeOfDay);
  const [arm, setArm] = useState<"left" | "right" | null>(initialArm);
  const [note, setNote] = useState(initialNote ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = (): boolean => {
    // Systolic > Diastolic
    if (editedReading.systolic <= editedReading.diastolic) {
      setValidationError("systolicMustExceedDiastolic");
      return false;
    }
    // Range checks
    if (editedReading.systolic < 50 || editedReading.systolic > 300) {
      setValidationError("invalidSystolic");
      return false;
    }
    if (editedReading.diastolic < 20 || editedReading.diastolic > 200) {
      setValidationError("invalidDiastolic");
      return false;
    }
    if (editedReading.pulse < 20 || editedReading.pulse > 250) {
      setValidationError("invalidPulse");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      systolic: editedReading.systolic,
      diastolic: editedReading.diastolic,
      pulse: editedReading.pulse,
      timeOfDay,
      arm,
      note: note.trim() || null,
    });
  };

  const increment = (key: keyof typeof editedReading, delta: number) => {
    setEditedReading((prev) => ({ ...prev, [key]: prev[key] + delta }));
  };

  const fields = [
    { key: "systolic" as const, labelKey: "field.systolic", color: "text-red-600 dark:text-red-400", unit: "mmHg" },
    { key: "diastolic" as const, labelKey: "field.diastolic", color: "text-orange-600 dark:text-orange-400", unit: "mmHg" },
    { key: "pulse" as const, labelKey: "field.pulse", color: "text-blue-600 dark:text-blue-400", unit: "bpm" },
  ];

  return (
    <div className="space-y-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
      {/* Error banner */}
      {(error || validationError) && (
        <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/60 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            {error ? tError(error) : tError(validationError!)}
          </p>
        </div>
      )}

      {/* Editable fields */}
      {fields.map(({ key, labelKey, color, unit }) => (
        <div key={key} className="flex items-center gap-3">
          <span className="w-20 text-sm text-gray-600 dark:text-gray-300 shrink-0">{t(labelKey)}</span>
          <button
            onClick={() => increment(key, -1)}
            className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700 dark:text-gray-100 text-xl font-bold
                       hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-90 transition-all"
            aria-label={t("common.decrement")}
          >
            −
          </button>
          <input
            type="number"
            value={editedReading[key]}
            onChange={(e) => {
              const val = e.target.value === "" ? 0 : Number(e.target.value);
              setEditedReading((prev) => ({ ...prev, [key]: val }));
              setValidationError(null);
            }}
            className={`flex-1 text-center text-2xl font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-2 ${color}`}
            min={key === "systolic" ? 50 : key === "diastolic" ? 20 : 20}
            max={key === "systolic" ? 300 : key === "diastolic" ? 200 : 250}
          />
          <button
            onClick={() => increment(key, 1)}
            className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700 dark:text-gray-100 text-xl font-bold
                       hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-90 transition-all"
            aria-label={t("common.increment")}
          >
            +
          </button>
          <span className="w-16 text-sm text-gray-500 dark:text-gray-400 shrink-0 text-right">{unit}</span>
        </div>
      ))}

      {/* Context tags */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t("tod.label")}</label>
          <select
            value={timeOfDay ?? ""}
            onChange={(e) => setTimeOfDay(e.target.value as "morning" | "evening" | null)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t("tod.notSet")}</option>
            <option value="morning">{t("tod.morning")}</option>
            <option value="evening">{t("tod.evening")}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t("arm.label")}</label>
          <select
            value={arm ?? ""}
            onChange={(e) => setArm(e.target.value as "left" | "right" | null)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">{t("arm.notSet")}</option>
            <option value="left">{t("arm.left")}</option>
            <option value="right">{t("arm.right")}</option>
          </select>
        </div>
      </div>

      {/* Note */}
      <div className="mt-4">
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t("scan.noteLabel")}</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder={t("scan.noteExample")}
          className="w-full text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
        />
        <span className="text-[10px] text-gray-500 dark:text-gray-400 block text-right mt-1">{note.length}/500</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-lg font-semibold
                     hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSave}
          className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold
                     hover:bg-primary-700 active:scale-95 transition-all"
        >
          <Check className="w-4 h-4 inline mr-1" /> {t("common.save")}
        </button>
      </div>
    </div>
  );
}