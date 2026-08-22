"use client";
import type { TimeOfDay, Arm } from "@/types";
import { useI18n } from "@/lib/I18nProvider";

// Genanvendelig chip-vælger for målingens kontekst-tags (morgen/aften + arm).
// Begge felter er valgfrie — klik på den valgte chip fravælger den igen.

interface Props {
  timeOfDay: TimeOfDay | null;
  arm: Arm | null;
  onChange: (field: "timeOfDay" | "arm", value: string | null) => void;
}

const TIME_OPTIONS: { value: TimeOfDay; labelKey: string }[] = [
  { value: "morning", labelKey: "tod.morningEmoji" },
  { value: "evening", labelKey: "tod.eveningEmoji" },
];

const ARM_OPTIONS: { value: Arm; labelKey: string }[] = [
  { value: "left", labelKey: "arm.left" },
  { value: "right", labelKey: "arm.right" },
];

export default function ContextTagChips({ timeOfDay, arm, onChange }: Props) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Tidspunkt på dagen */}
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">{t("tags.timeLabel")}</p>
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
                             : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Arm */}
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">{t("tags.armLabel")}</p>
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
                             : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
