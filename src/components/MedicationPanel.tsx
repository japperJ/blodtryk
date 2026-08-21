"use client";
import { useState } from "react";
import {
  ChevronDown,
  Pill,
  Plus,
  Power,
  Trash2,
} from "lucide-react";

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

// Ekspanderbar "Medicin"-sektion under en person — liste + simpel tilføj-form.
export default function MedicationPanel({ personId, onActiveMedsChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [meds, setMeds] = useState<Medication[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch(`/api/persons/${personId}/medications`);
      if (!res.ok) throw new Error();
      setMeds(await res.json());
    } catch {
      setError("Kunne ikke hente medicin");
    }
  };

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next && meds === null) await load();
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newDose.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/persons/${personId}/medications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), dose: newDose.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Kunne ikke tilføje medicin");
        return;
      }
      setNewName("");
      setNewDose("");
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
    if (!confirm("Sikker på du vil slette denne medicin?")) return;
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
        Medicin
        <ChevronDown
          className={`w-4 h-4 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Liste */}
          {meds === null ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Indlæser...</p>
          ) : meds.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ingen medicin registreret
            </p>
          ) : (
            <ul className="space-y-1.5">
              {meds.map((med) => (
                <li
                  key={med.id}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm
                             bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 ${
                               med.active ? "" : "opacity-60"
                             }`}
                >
                  <span
                    className={`min-w-0 truncate text-gray-800 dark:text-gray-200 ${
                      med.active ? "" : "line-through"
                    }`}
                  >
                    <span className="font-medium">{med.name}</span>{" "}
                    <span className="text-gray-500 dark:text-gray-400">{med.dose}</span>
                    {!med.active && (
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(inaktiv)</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggleActive(med)}
                      disabled={busy}
                      title={med.active ? "Deaktivér" : "Genaktivér"}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 dark:text-gray-500
                                 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    >
                      <Power className="w-4 h-4" aria-hidden />
                    </button>
                    <button
                      onClick={() => handleDelete(med.id)}
                      disabled={busy}
                      title="Slet"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 dark:text-gray-500
                                 hover:text-danger-600 dark:hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Tilføj form */}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Navn (f.eks. Losartan)"
              maxLength={100}
              className="flex-1 min-w-[140px] px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm
                         text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <input
              type="text"
              value={newDose}
              onChange={(e) => setNewDose(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Dosis (f.eks. 5 mg)"
              maxLength={100}
              className="flex-1 min-w-[120px] px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                         focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm
                         text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <button
              onClick={handleAdd}
              disabled={busy || !newName.trim() || !newDose.trim()}
              title="Tilføj medicin"
              className="inline-flex items-center gap-1.5 bg-primary-600 text-white px-4 rounded-xl text-sm font-semibold
                         hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
            >
              <Plus className="w-4 h-4" aria-hidden />
              Tilføj
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
