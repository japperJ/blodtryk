"use client";

import { ChevronDown, UserRound } from "lucide-react";
import { useState, useEffect } from "react";
import type { PersonSummary } from "@/types";
import PersonDialog from "./PersonDialog";

interface Props {
  onPersonChange?: (person: PersonSummary | null) => void;
}

export default function PersonBadge({ onPersonChange }: Props) {
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [persons, setPersons] = useState<PersonSummary[]>([]);

  // Hent personer
  const fetchPersons = async () => {
    try {
      const res = await fetch("/api/persons");
      const data = await res.json();
      setPersons(data);
    } catch (err) {
      console.error("Failed to fetch persons:", err);
    }
  };

  // Indlæs valgt person fra localStorage
  useEffect(() => {
    fetchPersons();
    const savedId = localStorage.getItem("selectedPersonId");
    if (savedId) {
      const id = parseInt(savedId);
      // Vent på at personer er hentet
      fetchPersons().then(() => {
        // Opdater når personer er hentet
      });
    }
  }, []);

  // Når personer er hentet, find den valgte
  useEffect(() => {
    if (persons.length === 0) return;

    const savedId = localStorage.getItem("selectedPersonId");
    if (savedId) {
      const id = parseInt(savedId);
      const person = persons.find((p) => p.id === id);
      if (person) {
        setSelectedPerson(person);
        onPersonChange?.(person);
        return;
      }
    }

    // Ingen valgt eller ugyldigt ID — vælg første person
    if (persons.length > 0) {
      const first = persons[0];
      localStorage.setItem("selectedPersonId", String(first.id));
      setSelectedPerson(first);
      onPersonChange?.(first);
    }
  }, [persons, onPersonChange]);

  const handleSelectPerson = (person: PersonSummary) => {
    localStorage.setItem("selectedPersonId", String(person.id));
    setSelectedPerson(person);
    setShowDialog(false);
    onPersonChange?.(person);
  };

  const handleOpenDialog = async () => {
    await fetchPersons();
    setShowDialog(true);
  };

  return (
    <>
      <button
        onClick={handleOpenDialog}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/40
                   text-primary-700 dark:text-primary-300 text-sm font-medium hover:bg-primary-100 dark:hover:bg-primary-900/60
                   transition-colors"
      >
        <UserRound className="w-4 h-4" />
        <span>{selectedPerson?.name || "Vælg person"}</span>
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>

      {showDialog && (
        <PersonDialog
          persons={persons}
          selectedId={selectedPerson?.id ?? null}
          onSelect={handleSelectPerson}
          onClose={() => setShowDialog(false)}
          onRefresh={fetchPersons}
        />
      )}
    </>
  );
}
