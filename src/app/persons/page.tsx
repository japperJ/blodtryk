"use client";
import { useState, useEffect, useCallback } from "react";
import type { PersonSummary } from "@/types";

export default function PersonsPage() {
  const [persons, setPersons] = useState<PersonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);

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
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        setNewName("");
        setIsAdding(false);
        await fetchPersons();
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
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        setEditName("");
        await fetchPersons();
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
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">👤 Personer</h1>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium
                       hover:bg-primary-700 active:scale-95 transition-all"
          >
            + Tilføj
          </button>
        </div>

        {/* Opret ny */}
        {isAdding && (
          <div className="bg-white rounded-xl p-4 shadow-sm border mb-4">
            <p className="text-sm font-medium text-gray-600 mb-2">Ny person</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Navn"
                autoFocus
                className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl
                           focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                           text-gray-900"
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium
                           hover:bg-primary-700 disabled:opacity-50"
              >
                Gem
              </button>
              <button
                onClick={() => { setIsAdding(false); setNewName(""); }}
                className="px-3 py-2 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Personer */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 animate-pulse">
            Indlæser...
          </div>
        ) : persons.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-gray-600">Ingen personer endnu</p>
            <p className="text-sm text-gray-400 mt-1">
              Opret en person for at komme i gang
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {persons.map((person) => (
              <div
                key={person.id}
                className={`bg-white rounded-xl p-4 shadow-sm border transition-all ${
                  selectedPersonId === person.id
                    ? "ring-2 ring-primary-500 border-primary-300"
                    : ""
                }`}
              >
                {editingId === person.id ? (
                  /* Redigerings-tilstand */
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleUpdate(person.id)}
                      autoFocus
                      className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl
                                 focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                                 text-gray-900"
                    />
                    <button
                      onClick={() => handleUpdate(person.id)}
                      className="px-3 py-2 bg-primary-600 text-white rounded-xl text-sm"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => { setEditingId(null); setEditName(""); }}
                      className="px-3 py-2 text-gray-500"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  /* Normal tilstand */
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleSelect(person.id)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {selectedPersonId === person.id ? "✅" : "👤"}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{person.name}</p>
                          <p className="text-xs text-gray-500">
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
                        }}
                        className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                        title="Rediger"
                      >
                        ✏️
                      </button>
                      {person.id !== 1 && (
                        <button
                          onClick={() => handleDelete(person.id, person.name)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Slet"
                        >
                          🗑️
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
        <p className="text-xs text-gray-400 text-center mt-6">
          Tryk på en person for at vælge den · Valgte person vises med ✓
        </p>
      </div>
    </main>
  );
}
