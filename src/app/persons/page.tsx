"use client";
import { useState, useEffect, useCallback } from "react";
import { User, UserPlus, Pencil, Trash2, X, Check, Download, Upload } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { PersonRowSkeleton } from "@/components/Skeleton";
import MedicationPanel from "@/components/MedicationPanel";
import { countKey, INTL_LOCALE } from "@/lib/i18n";
import { useI18n } from "@/lib/I18nProvider";
import { setSelectedPersonId as persistSelectedPersonId } from "@/lib/uploadQueue";
import type { PersonSummary } from "@/types";

export default function PersonsPage() {
  const { t, tError, locale } = useI18n();
  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBirthYear, setNewBirthYear] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editBirthYear, setEditBirthYear] = useState("");
  const [formError, setFormError] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

  // Indeværende år — bruges som maksimum for fødselsår
  const currentYear = new Date().getFullYear();

  const fetchPersons = useCallback(async () => {
    try {
      const res = await fetch("/api/persons");
      const data = await res.json();
      setPersons(data);
    } catch (err) {
      console.error("Failed to fetch persons:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersons();
    const saved = localStorage.getItem("selectedPersonId");
    if (saved) setSelectedPersonId(parseInt(saved));
  }, [fetchPersons]);

  // Vælg person
  const handleSelect = (id: number) => {
    persistSelectedPersonId(String(id));
    setSelectedPersonId(id);
  };

  // Opret person
  const handleAdd = async () => {
    if (!newName.trim()) return;
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
        setNewName("");
        setNewBirthYear("");
        setFormError("");
        setIsAdding(false);
        await fetchPersons();
      } else {
        const data = await res.json();
        setFormError(data.error ? tError(data.error) : t("persons.createError"));
      }
    } catch (err) {
      console.error("Failed to create person:", err);
    }
  };

  // Rediger person
  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/persons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          birthYear: editBirthYear ? Number(editBirthYear) : null,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditName("");
        setEditBirthYear("");
        setFormError("");
        await fetchPersons();
      } else {
        const data = await res.json();
        setFormError(data.error ? tError(data.error) : t("persons.updateError"));
      }
    } catch (err) {
      console.error("Failed to update person:", err);
    }
  };

  // Slet person
  const handleDelete = async (id: number, name: string) => {
    const person = persons.find((candidate) => candidate.id === id);
    if (!person) return;

    const shouldBackup = window.confirm(t("persons.backupBeforeDelete", { name }));
    if (shouldBackup) {
      try {
        await handleBackupDownload(person, { suppressAlert: true });
      } catch {
        // We still continue if the backup export fails, but we keep the delete flow safe by prompting for confirmation.
      }
    }

    if (!window.confirm(t("persons.confirmDelete", { name }))) return;

    try {
      const res = await fetch(`/api/persons/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Hvis den slettede var valgt, vælg Standard
        if (selectedPersonId === id) {
          persistSelectedPersonId("1");
          setSelectedPersonId(1);
        }
        await fetchPersons();
      }
    } catch (err) {
      console.error("Failed to delete person:", err);
    }
  };

  const handleBackupDownload = async (person: PersonSummary, options?: { suppressAlert?: boolean }) => {
    try {
      const res = await fetch(`/api/persons/${person.id}/backup`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("persons.backupError"));
      }

      const backup = await res.json();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = person.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "person";
      link.href = url;
      link.download = `bloodpressure-backup-${safeName}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      if (!options?.suppressAlert) {
        window.alert(t("persons.backupSuccess"));
      }
      return true;
    } catch (err) {
      console.error("Failed to export backup:", err);
      if (!options?.suppressAlert) {
        window.alert(t("persons.backupError"));
      }
      return false;
    }
  };

  const handleBackupRestore = async (personId: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const backup = JSON.parse(text);
        const res = await fetch("/api/persons/backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personId, backup }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || t("persons.restoreError"));
        }
        await fetchPersons();
        window.alert(t("persons.restoreSuccess"));
      } catch (err) {
        console.error("Failed to restore backup:", err);
        window.alert(t("persons.restoreError"));
      }
    };
    input.click();
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <User className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden />
            {t("persons.title")}
          </h1>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium
                       hover:bg-primary-700 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" aria-hidden />
            {t("persons.add")}
          </button>
        </div>

        {/* Opret ny */}
        {isAdding && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">{t("persons.newPerson")}</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("persons.namePlaceholder")}
                autoFocus
                className="flex-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                           focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                           text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="px-4 py-2 min-h-[44px] bg-primary-600 text-white rounded-xl font-medium inline-flex items-center justify-center
                           hover:bg-primary-700 disabled:opacity-50"
              >
                {t("common.save")}
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewName(""); setNewBirthYear(""); setFormError(""); }}
                className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                title={t("common.cancel")}
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <input
                type="number"
                min={1900}
                max={currentYear}
                value={newBirthYear}
                onChange={(e) => setNewBirthYear(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={t("persons.birthYearPlaceholder")}
                className="w-40 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                           focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                           text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("persons.birthYearHint")}
              </p>
            </div>
            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{formError}</p>
            )}
          </div>
        )}

        {/* Personer */}
        {loading ? (
          /* Skelet-layout (#12): rækker i samme form som personkortene */
          <div className="space-y-3" aria-busy="true" aria-label={t("persons.loading")}>
            <PersonRowSkeleton />
            <PersonRowSkeleton />
            <PersonRowSkeleton />
          </div>
        ) : persons.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title={t("persons.emptyTitle")}
            description={t("persons.emptyDesc")}
            action={
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                <UserPlus className="w-5 h-5" aria-hidden />
                {t("persons.emptyCta")}
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {persons.map((person) => (
              <div
                key={person.id}
                className={`bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-all ${
                  selectedPersonId === person.id
                    ? "ring-2 ring-primary-500 border-primary-300 dark:border-primary-500"
                    : ""
                }`}
              >
                {editingId === person.id ? (
                  /* Redigerings-tilstand */
                  <div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(person.id)}
                        autoFocus
                        className="flex-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                                   focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                                   text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={() => handleUpdate(person.id)}
                        className="flex h-11 w-11 items-center justify-center text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/40 rounded-full transition-colors"
                        title={t("common.save")}
                      >
                        <Check className="w-5 h-5" aria-hidden />
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditName(""); setEditBirthYear(""); setFormError(""); }}
                        className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        title={t("common.cancel")}
                      >
                        <X className="w-5 h-5" aria-hidden />
                      </button>
                    </div>
                    <input
                      type="number"
                      min={1900}
                      max={currentYear}
                      value={editBirthYear}
                      onChange={(e) => setEditBirthYear(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(person.id)}
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
                  /* Normal tilstand */
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleSelect(person.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar — valgt person fremhæves med fyldt primærfarvet cirkel (ikke kun farve: kortet har også ring) */}
                        <span
                          className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-colors ${
                            selectedPersonId === person.id
                              ? "bg-primary-600 text-white"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
                          }`}
                        >
                          <User className="w-5 h-5" aria-hidden />
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{person.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {person.birthYear != null && (
                              <>{t("persons.born", { year: person.birthYear })}</>
                            )}
                            {t(countKey("persons.readingCount", person.readingCount), { count: person.readingCount })}
                            {person.lastReadingAt && (
                              <>{t("persons.lastReading", { date: new Date(person.lastReadingAt).toLocaleDateString(INTL_LOCALE[locale]) })}</>
                            )}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => handleBackupDownload(person)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-300 hover:text-primary-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-colors"
                        title={t("persons.backup")}
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden />
                        {t("persons.backup")}
                      </button>
                      <button
                        onClick={() => handleBackupRestore(person.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:border-primary-300 hover:text-primary-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-colors"
                        title={t("persons.restore")}
                      >
                        <Upload className="w-3.5 h-3.5" aria-hidden />
                        {t("persons.restore")}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(person.id);
                          setEditName(person.name);
                          setEditBirthYear(person.birthYear != null ? String(person.birthYear) : "");
                          setFormError("");
                        }}
                        className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        title={t("common.edit")}
                      >
                        <Pencil className="w-4 h-4" aria-hidden />
                      </button>
                      {person.id !== 1 && (
                        <button
                          onClick={() => handleDelete(person.id, person.name)}
                          className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-danger-600 dark:hover:text-red-400 transition-colors"
                          title={t("common.delete")}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <MedicationPanel personId={person.id} />
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
          {t("persons.footerHint")}
        </p>
      </div>
    </main>
  );
}
