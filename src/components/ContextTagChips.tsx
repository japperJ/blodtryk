"use client";
import type { TimeOfDay, Arm } from "@/types";

// Genanvendelig chip-vælger for målingens kontekst-tags (morgen/aften + arm).
// Begge felter er valgfrie — klik på den valgte chip fravælger den igen.

interface Props {
  timeOfDay: TimeOfDay | null;
  arm: Arm | null;
  onChange: (field: "timeOfDay" | "arm", value: string | null) => void;
}

const TIME_OPTIONS: { value: TimeOfDay; label: string }[] = [
  { value: "morning", label: "🌅 Morgen" },
  { value: "evening", label: "🌙 Aften" },
];

const ARM_OPTIONS: { value: Arm; label: string }[] = [
  { value: "left", label: "Venstre arm" },
  { value: "right", label: "Højre arm" },
];

export default function ContextTagChips({ timeOfDay, arm, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Tidspunkt på dagen */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Tidspunkt</p>
        <div className="flex gap-2">
          {TIME_OPTIONS.map((opt) => {
            const selected = timeOfDay === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange("timeOfDay", selected ? null : opt.value)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                           ${selected
                             ? "bg-primary-600 text-white"
                             : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Arm */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-1.5">Arm</p>
        <div className="flex gap-2">
          {ARM_OPTIONS.map((opt) => {
            const selected = arm === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange("arm", selected ? null : opt.value)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                           ${selected
                             ? "bg-primary-600 text-white"
                             : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
