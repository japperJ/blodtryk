"use client";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  Pencil,
  Pill,
  Plus,
  Power,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/I18nProvider";
import {
  formatMedicationRange,
  medicationDateInputValue,
  todayDateInputValue,
} from "@/lib/medicationDate";

// Medicin-indslag som returneret af API'en
export interface Medication {
  id: number;
  personId: number;
  name: string;
  dose: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}

interface Props {
  personId: number;
  onActiveMedsChanged?: () => void;
}

// Deles af alle tekstfelter i panelet (tilføj + redigér)
const inputClass =
  "px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl " +
  "focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm " +
  "text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500";

// Ekspanderbar "Medicin"-sektion under en person — liste + simpel tilføj-form.
export default function MedicationPanel({ personId, onActiveMedsChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDose, setEditDose] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { t, tError } = useI18n();

  // En slutdato der allerede er passeret betyder reelt "stoppet" — hold active i sync,
  // så listen, tendens-kurven og PDF'en er enige. Power-knappen kan stadig overrule.
  const activeForDates = (endDate: string): boolean | undefined =>
    endDate === "" ? undefined : endDate >= todayDateInputValue();

  // Fælles payload til POST/PATCH — datoer sendes som "YYYY-MM-DD" eller null
  const medPayload = (name: string, dose: string, startDate: string, endDate: string) => {
    const active = activeForDates(endDate);
    return {
      name: name.trim(),
      dose: dose.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      ...(active !== undefined ? { active } : {}),
    };
  };

  const load = async () => {
    try {
      const res = await fetch(`/api/persons/${personId}/medications`);
      if (!res.ok) throw new Error();
      setMeds(await res.json());
    } catch {
      setError(t("meds.loadError"));
    }
  };

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && meds === null) await load();
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newDose.trim() || busy) return;
    if (newStartDate && newEndDate && newEndDate < newStartDate) {
      setError(t("meds.endBeforeStart"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/persons/${personId}/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(medPayload(newName, newDose, newStartDate, newEndDate)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? tError(data.error) : t("meds.addError"));
        return;
      }
      setNewName("");
      setNewDose("");
      setNewStartDate("");
      setNewEndDate("");
      await load();
      onActiveMedsChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (med: Medication) => {
    setEditingId(med.id);
    setEditName(med.name);
    setEditDose(med.dose);
    setEditStartDate(medicationDateInputValue(med.startDate));
    setEditEndDate(medicationDateInputValue(med.endDate));
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
  };

  const handleSaveEdit = async () => {
    if (editingId === null || busy) return;
    if (!editName.trim() || !editDose.trim()) return;
    if (editStartDate && editEndDate && editEndDate < editStartDate) {
      setError(t("meds.endBeforeStart"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/medications/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(medPayload(editName, editDose, editStartDate, editEndDate)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ? tError(data.error) : t("meds.updateError"));
        return;
      }
      setEditingId(null);
      await load();
      onActiveMedsChanged?.();
    } finally {
      setBusy(false);
    }
  };

  // Deaktiver/genaktivér — historikken bevares
  const toggleActive = async (med: Medication) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/medications/${med.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !med.active }),
      });
      if (res.ok) {
        await load();
        onActiveMedsChanged?.();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("meds.confirmDelete"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/medications/${id}`, { method: "DELETE" });
      if (res.ok) {
        await load();
        onActiveMedsChanged?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
      <button
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300
                   hover:text-primary-600 dark:hover:text-primary-400 transition-colors min-h-[44px]"
      >
        <Pill className="w-4 h-4" aria-hidden />
        {t("meds.panel")}
        <ChevronDown
          className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Liste */}
          {meds === null ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("meds.loading")}</p>
          ) : meds.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("meds.none")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {meds.map((med) =>
                editingId === med.id ? (
                  <li
                    key={med.id}
                    className="space-y-2 rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-900
                               border border-primary-300 dark:border-primary-700"
                  >
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        aria-label={t("meds.namePlaceholder")}
                        maxLength={100}
                        className={`${inputClass} flex-1 min-w-[140px]`}
                      />
                      <input
                        type="text"
                        value={editDose}
                        onChange={(e) => setEditDose(e.target.value)}
                        aria-label={t("meds.dosePlaceholder")}
                        maxLength={100}
                        className={`${inputClass} flex-1 min-w-[120px]`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="flex flex-1 min-w-[140px] flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                        {t("meds.startDate")}
                        <input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className={inputClass}
                        />
                      </label>
                      <label className="flex flex-1 min-w-[140px] flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                        {t("meds.endDate")}
                        <input
                          type="date"
                          value={editEndDate}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          className={inputClass}
                        />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        disabled={busy || !editName.trim() || !editDose.trim()}
                        title={t("common.save")}
                        className="inline-flex items-center gap-1.5 bg-primary-600 text-white px-4 rounded-xl text-sm font-semibold
                                   hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
                      >
                        <Check className="w-4 h-4" aria-hidden />
                        {t("common.save")}
                      </button>
                      <button
                        onClick={cancelEdit}
                        disabled={busy}
                        title={t("common.cancel")}
                        className="inline-flex items-center gap-1.5 px-4 rounded-xl text-sm font-semibold
                                   text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800
                                   hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 min-h-[44px]"
                      >
                        <X className="w-4 h-4" aria-hidden />
                        {t("common.cancel")}
                      </button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={med.id}
                    className={`flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm
                               bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 ${
                                 med.active ? "" : "opacity-60"
                               }`}
                  >
                    <span className="min-w-0 flex-1 text-gray-800 dark:text-gray-200">
                      <span className="block truncate">
                        <span className={`font-medium ${med.active ? "" : "line-through"}`}>
                          {med.name}
                        </span>{" "}
                        <span className="text-gray-500 dark:text-gray-400">{med.dose}</span>
                        {!med.active && (
                          <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                            {t("meds.inactive")}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                        {formatMedicationRange(med.startDate, med.endDate, {
                          unknown: t("meds.dateUnknown"),
                          ongoing: t("meds.ongoing"),
                        })}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => startEdit(med)}
                        disabled={busy}
                        title={t("meds.editTitle")}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 dark:text-gray-500
                                   hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <Pencil className="w-4 h-4" aria-hidden />
                      </button>
                      <button
                        onClick={() => toggleActive(med)}
                        disabled={busy}
                        title={med.active ? t("meds.deactivate") : t("meds.reactivate")}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 dark:text-gray-500
                                   hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                      >
                        <Power className="w-4 h-4" aria-hidden />
                      </button>
                      <button
                        onClick={() => handleDelete(med.id)}
                        disabled={busy}
                        title={t("common.delete")}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 dark:text-gray-500
                                   hover:text-danger-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden />
                      </button>
                    </span>
                  </li>
                )
              )}
            </ul>
          )}

          {/* Tilføj form */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("meds.namePlaceholder")}
                maxLength={100}
                className={`${inputClass} flex-1 min-w-[140px]`}
              />
              <input
                type="text"
                value={newDose}
                onChange={(e) => setNewDose(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("meds.dosePlaceholder")}
                maxLength={100}
                className={`${inputClass} flex-1 min-w-[120px]`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="flex flex-1 min-w-[140px] flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {t("meds.startDate")}
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-1 min-w-[140px] flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
                {t("meds.endDate")}
                <input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
            <button
              onClick={handleAdd}
              disabled={busy || !newName.trim() || !newDose.trim()}
              title={t("meds.addTitle")}
              className="inline-flex items-center gap-1.5 bg-primary-600 text-white px-4 rounded-xl text-sm font-semibold
                         hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
            >
              <Plus className="w-4 h-4" aria-hidden />
              {t("common.add")}
            </button>
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
