"use client";

import { X } from "lucide-react";
import { useState } from "react";
import type { Reading } from "@/types";
import { filterReadingsByPeriod, type DanishReportPeriod } from "@/lib/danishReportPdf";
import { useI18n } from "@/lib/I18nProvider";
import { countKey } from "@/lib/i18n";

interface Props {
  readings: Reading[];
  defaultStart: Date;
  defaultEnd: Date;
  busy: boolean;
  /** Oversættelsesnøgler, så samme dialog kan bruges til alle rapporttyper. */
  titleKey: string;
  hintKey: string;
  actionKey: string;
  onExport: (period: DanishReportPeriod) => void;
  onClose: () => void;
}

const inputClass =
  "px-3 py-2 border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl " +
  "focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm " +
  "text-gray-900 dark:text-gray-100";

/** Date -> "YYYY-MM-DD" i lokal tid (det format <input type="date"> kræver). */
function toInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "YYYY-MM-DD" -> lokal midnat (new Date("...") ville tolke strengen som UTC). */
function fromInputValue(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Periode-vælger til PDF-eksport: kun målinger i perioden kommer med, og
// datoerne vises øverst i rapporten/skemaet. Bruges af alle rapporttyper, så
// "med billeder", "uden billeder" og det danske lægeskema vælger dato ens.
export default function ReportPeriodDialog({
  readings,
  defaultStart,
  defaultEnd,
  busy,
  titleKey,
  hintKey,
  actionKey,
  onExport,
  onClose,
}: Props) {
  const { t } = useI18n();
  const [startValue, setStartValue] = useState(toInputValue(defaultStart));
  const [endValue, setEndValue] = useState(toInputValue(defaultEnd));

  const start = fromInputValue(startValue);
  const end = fromInputValue(endValue);
  const period: DanishReportPeriod | null =
    start && end && start.getTime() <= end.getTime() ? { start, end } : null;
  const count = period ? filterReadingsByPeriod(readings, period).length : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pb-[calc(72px+env(safe-area-inset-bottom,0px))] sm:pb-0">
      {/* Baggrund */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Dialog */}
      <div className="relative dialog-sheet overflow-y-auto bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md p-4 pb-6
                      shadow-xl animate-in slide-in-from-bottom duration-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {t(titleKey)}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{t(hintKey)}</p>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-1 min-w-[140px] flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            {t("pdf.periodStart")}
            <input
              type="date"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 min-w-[140px] flex-col gap-1 text-xs text-gray-500 dark:text-gray-400">
            {t("pdf.periodEnd")}
            <input
              type="date"
              value={endValue}
              onChange={(e) => setEndValue(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <p
          className={`mt-3 text-sm ${
            period ? "text-gray-600 dark:text-gray-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {period
            ? t(countKey("pdf.periodReadings", count), { count })
            : t("pdf.invalidPeriod")}
        </p>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-xl border border-gray-200 dark:border-gray-600 px-4 py-2 text-sm font-medium
                       text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => period && onExport(period)}
            disabled={!period || busy}
            className="min-h-[44px] flex-1 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white
                       hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? t("pdf.generating") : t(actionKey)}
          </button>
        </div>
      </div>
    </div>
  );
}
