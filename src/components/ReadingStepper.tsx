"use client";

// Genanvendelig tal-stepper til målingsværdier (systolisk/diastolisk/puls).
// Bruges af både kamera-bekræftelses-steppet og den manuelle indtastning.

export type ReadingStepperKey = "systolic" | "diastolic" | "pulse";

export interface ReadingStepperField {
  key: ReadingStepperKey;
  label: string;
  unit: string;
  color?: string;
}

// Standardfelter — samme rækkefølge/farver som kamera-flowet altid har brugt
export const READING_STEPPER_FIELDS: ReadingStepperField[] = [
  { key: "systolic", label: "Systolisk", unit: "mmHg", color: "text-red-600 dark:text-red-400" },
  { key: "diastolic", label: "Diastolisk", unit: "mmHg", color: "text-orange-600 dark:text-orange-400" },
  { key: "pulse", label: "Puls", unit: "bpm", color: "text-blue-600 dark:text-blue-400" },
];

interface ReadingStepperProps {
  fields?: ReadingStepperField[];
  values: Record<ReadingStepperKey, number>;
  onChange: (key: ReadingStepperKey, value: number) => void;
}

export default function ReadingStepper({
  fields = READING_STEPPER_FIELDS,
  values,
  onChange,
}: ReadingStepperProps) {
  return (
    <div className="space-y-3">
      {fields.map(({ key, label, unit, color }) => (
        <div key={key} className="flex items-center gap-3">
          <div className="w-20 shrink-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{unit}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(key, values[key] - 1)}
            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-2xl font-bold text-gray-600 dark:text-gray-200
                       hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-90 transition-all flex items-center justify-center shrink-0"
          >
            −
          </button>
          <input
            type="number"
            value={values[key]}
            onChange={(e) => onChange(key, Number(e.target.value) || 0)}
            className={`flex-1 text-center text-4xl font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                         py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-0 ${color ?? ""}`}
          />
          <button
            type="button"
            onClick={() => onChange(key, values[key] + 1)}
            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-2xl font-bold text-gray-600 dark:text-gray-200
                       hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-90 transition-all flex items-center justify-center shrink-0"
          >
            +
          </button>
        </div>
      ))}
    </div>
  );
}
