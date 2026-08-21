"use client";
import { useState, useEffect, useCallback } from "react";
import { User, UserPlus, Pencil, Trash2, X, Check } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { PersonRowSkeleton } from "@/components/Skeleton";
import type { PersonSummary } from "@/types";

export default function PersonsPage() {
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
    localStorage.setItem("selectedPersonId", String(id));
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
        setFormError(data.error || "Kunne ikke oprette person");
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
        setFormError(data.error || "Kunne ikke opdatere person");
      }
    } catch (err) {
      console.error("Failed to update person:", err);
    }
  };

  // Slet person
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Er du sikker på du vil slette "${name}"?\n\nMålinger flyttes til Standard.`)) return;
    try {
      const res = await fetch(`/api/persons/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Hvis den slettede var valgt, vælg Standard
        if (selectedPersonId === id) {
          localStorage.setItem("selectedPersonId", "1");
          setSelectedPersonId(1);
        }
        await fetchPersons();
      }
    } catch (err) {
      console.error("Failed to delete person:", err);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <User className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden />
            Personer
          </h1>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 min-h-[44px] rounded-xl text-sm font-medium
                       hover:bg-primary-700 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" aria-hidden />
            Tilføj
          </button>
        </div>

        {/* Opret ny */}
        {isAdding && (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Ny person</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Navn"
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
                Gem
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewName(""); setNewBirthYear(""); setFormError(""); }}
                className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                title="Annuller"
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
                placeholder={`Fødselsår (f.eks. 1950)`}
                className="w-40 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                           focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                           text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Valgfri — bruges til automatisk aldersvurdering
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
          <div className="space-y-3" aria-busy="true" aria-label="Indlæser personer">
            <PersonRowSkeleton />
            <PersonRowSkeleton />
            <PersonRowSkeleton />
          </div>
        ) : persons.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="Ingen personer endnu"
            description="Opret en person for at komme i gang"
            action={
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                <UserPlus className="w-5 h-5" aria-hidden />
                Opret person
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
                        title="Gem"
                      >
                        <Check className="w-5 h-5" aria-hidden />
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditName(""); setEditBirthYear(""); setFormError(""); }}
                        className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                        title="Annuller"
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
                      placeholder={`Fødselsår (f.eks. 1950)`}
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
                              <>Født {person.birthYear} · </>
                            )}
                            {person.readingCount} måling{person.readingCount !== 1 ? "er" : ""}
                            {person.lastReadingAt && (
                              <> · Seneste: {new Date(person.lastReadingAt).toLocaleDateString("da-DK")}</>
                            )}
                          </p>
                        </div>
                      </div>
                    </button>

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingId(person.id);
                          setEditName(person.name);
                          setEditBirthYear(person.birthYear != null ? String(person.birthYear) : "");
                          setFormError("");
                        }}
                        className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                        title="Rediger"
                      >
                        <Pencil className="w-4 h-4" aria-hidden />
                      </button>
                      {person.id !== 1 && (
                        <button
                          onClick={() => handleDelete(person.id, person.name)}
                          className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-danger-600 dark:hover:text-red-400 transition-colors"
                          title="Slet"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
          Tryk på en person for at vælge den · Valgte person er fremhævet
        </p>
      </div>
    </main>
  );
}
