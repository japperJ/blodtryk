"use client";

import { useState } from "react";
import { ImageOff, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import type { BatchItemView, ScanResult } from "./BatchProgress";
import { getBPStatus } from "@/lib/bpClassification";
import { useI18n } from "@/lib/I18nProvider";
import { INTL_LOCALE, countKey } from "@/lib/i18n";
import ManualReadingEditor from "./ManualReadingEditor";

interface Props {
  items: BatchItemView[];
  results: ScanResult[];
  onReset: () => void;
  age?: number | null; // Personens alder til aldersjusteret klassificering
  onRetryFailed?: () => void; // kun muligt når billederne stadig findes lokalt i browseren
  jobId?: string | null; // Batch job ID for manual entry API calls
}

export default function BatchTimeline({ items, results, onReset, age, onRetryFailed, jobId }: Props) {
  const { t, locale, tError } = useI18n();
  // Sorter resultater efter tidspunkt (nyeste først)
  const sortedResults = [...results]
    .filter(r => r.reading !== null) // Kun succesfulde
    .sort((a, b) => {
      const timeA = a.timestamp?.getTime() || 0;
      const timeB = b.timestamp?.getTime() || 0;
      return timeB - timeA; // Nyeste først
    });

  const failedResults = results.filter(r => r.error !== null);
  const failedCount = failedResults.length;
  const successCount = sortedResults.length;

  // Track which failed item is being edited
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveManual = async (itemId: string, values: {
    systolic: number;
    diastolic: number;
    pulse: number;
    timeOfDay: "morning" | "evening" | null;
    arm: "left" | "right" | null;
    note: string | null;
  }) => {
    if (!jobId) {
      setSaveError("No jobId provided — cannot save");
      return;
    }
    setIsSaving(itemId);
    setSaveError(null);
    try {
      const res = await fetch(`/api/batch-jobs/${jobId}/items/${itemId}/manual`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "manualEntryFailed");
      }
      
      setEditingItemId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "manualEntryFailed";
      setSaveError(msg);
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Oversigt */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t(countKey("batch.ready", successCount), { count: successCount })}
            </p>
            {failedCount > 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t(countKey("batch.failed", failedCount), { count: failedCount })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tidslinje - succesfulde målinger */}
      {successCount > 0 && (
        <div className="space-y-2">
          {sortedResults.map((result) => {
            const item = items.find(i => i.id === result.imageId);
            if (!item || !result.reading) return null;

            const date = result.timestamp;
            const status = getBPStatus(result.reading.systolic, result.reading.diastolic, age);

            return (
              <div
                key={result.imageId}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-3"
              >
                {/* Thumbnail */}
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={t("card.imageAlt")}
                    className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-600"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg shrink-0 bg-gray-200 dark:bg-gray-700" />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {date ? date.toLocaleDateString(INTL_LOCALE[locale], {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      }) : t("batch.unknownDate")}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                      {t(status.labelKey)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {date ? date.toLocaleTimeString(INTL_LOCALE[locale], { hour: '2-digit', minute: '2-digit' }) : ''}
                    {item.exifModel && ` • ${item.exifModel}`}
                  </p>
                </div>

                {/* Måling */}
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {result.reading.systolic}/{result.reading.diastolic}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("batch.pulseValue", { value: result.reading.pulse })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fejlede billeder - med mulighed for manuel indtastning */}
      {failedCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-900/60">
          <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-3">
            <ImageOff className="w-4 h-4 inline mr-1 text-red-700 dark:text-red-300" />️ {t("batch.unreadableHeader")}
          </p>
          <div className="space-y-2">
            {failedResults.map((result, resultIndex) => {
              // Robust ID matching: try exact match first, then fallback by index
              // Client IDs: upload-{timestamp}-{index}
              // Server IDs: srv-{id} (from server rebuild)
              const item = items.find(i => i.id === result.imageId) 
                ?? items[resultIndex]; // Fallback: match by index order
              const isEditing = editingItemId === result.imageId;

              return (
                <div key={result.imageId} className="border border-red-200 dark:border-red-900/60 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                  {/* Collapsed view */}
                  <button
                    onClick={() => {
                      setSaveError(null);
                      setEditingItemId(isEditing ? null : result.imageId);
                    }}
                    className="w-full p-3 flex items-center gap-3 text-left"
                    disabled={isSaving !== null && isSaving !== result.imageId}
                  >
                    {item?.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-10 h-10 rounded object-cover opacity-70"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 opacity-50" />
                    )}
                    <span className="flex-1 text-sm text-red-600 dark:text-red-400 truncate">
                      {result.error ? tError(result.error) : ""}
                    </span>
                    {isEditing ? (
                      <ChevronUp className="w-5 h-5 text-red-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                    )}
                  </button>

                  {/* Expanded editor - show even if thumbnail is missing */}
                  {isEditing && item && (
                    <div className="p-3 border-t border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10">
                      {/* Large image preview - only if thumbnail exists */}
                      {item.thumbnail && (
                        <div className="mb-3">
                          <img
                            src={item.thumbnail}
                            alt={t("viewer.imageAlt")}
                            className="w-full max-h-64 object-contain rounded-lg border border-red-200 dark:border-red-900/40"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                      )}
                      
                      <ManualReadingEditor
                        initialReading={{
                          systolic: result.reading?.systolic || 120,
                          diastolic: result.reading?.diastolic || 80,
                          pulse: result.reading?.pulse || 70,
                        }}
                        age={age}
                        onSave={(values) => handleSaveManual(result.imageId, values)}
                        onCancel={() => { setEditingItemId(null); setSaveError(null); }}
                        error={saveError}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Handlinger — målinger er allerede gemt automatisk på serveren */}
      <div className="space-y-3">
        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
          {t("batch.autoSaved")}
        </p>

        <div className="flex gap-3">
          {onRetryFailed && (
            <button
              onClick={onRetryFailed}
              className="flex-1 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 text-gray-700 py-4 rounded-xl font-semibold
                         hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
            >
              <RotateCcw className="w-5 h-5 mr-1 inline" /> {t("batch.retryFailed")}
            </button>
          )}

          <button
            onClick={onReset}
            className={`bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold
                       hover:bg-primary-700 active:scale-95 transition-all
                       ${onRetryFailed ? "flex-1" : "w-full"}`}
          >
            {t("scan.uploadMore")}
          </button>
        </div>
      </div>
    </div>
  );
}