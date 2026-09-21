"use client";

import { AlertTriangle, CheckCircle2, Hourglass, Image as ImageIcon, Loader2, OctagonAlert, X, XCircle } from "lucide-react";
import { useState } from "react";
import BatchManualViewer from "./BatchManualViewer";
import { useI18n } from "@/lib/I18nProvider";

export interface ScanResult {
  imageId: string;
  reading: { systolic: number; diastolic: number; pulse: number } | null;
  error: string | null;
  timestamp: Date | null;
}

// Letvægts-view af et batch-billede. Fungerer både for billeder der lige er
// valgt lokalt og for jobs der genoptages fra serveren efter navigation
// (thumbnail hentes så via /api/image/<filnavn>).
export interface BatchItemView {
  id: string; // matcher ScanResult.imageId / serverens clientRef
  thumbnail: string | null;
  displayTime: string;
  exifModel?: string; // valgfri kameramodel til tidslinjen
  /** Billede i fuld størrelse til "se billede og indtast selv" */
  fullImage?: string | null;
}

interface Props {
  items: BatchItemView[];
  results: ScanResult[];
  isComplete: boolean;
  /** Sæt når køen venter på AI-serveren (#60): "ollamaOffline" | "ollamaModelMissing" */
  waitReason?: string | null;
  onCancel: () => void;
  /** Batch-job-id — nødvendigt for at gemme en manuel indtastning */
  jobId?: string | null;
  /** Personens alder (valideringskontekst i indtastningsfeltet) */
  age?: number | null;
  /** Kaldes når brugeren har gemt en manuel indtastning for et billede */
  onManualSaved?: (result: ScanResult) => void;
}

export default function BatchProgress({
  items,
  results,
  isComplete,
  waitReason,
  onCancel,
  jobId,
  age,
  onManualSaved,
}: Props) {
  const { t, tError } = useI18n();
  const [manualItemId, setManualItemId] = useState<string | null>(null);
  const completedCount = results.length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  // Første item uden resultat er det der scannes lige nu
  const currentIndex = items.findIndex(
    (item) => !results.some((r) => r.imageId === item.id)
  );
  const isWaiting = !isComplete && !!waitReason;
  const manualItem = manualItemId ? items.find((item) => item.id === manualItemId) : undefined;
  const canEnterManually = !!jobId && !!onManualSaved;

  return (
    <div className="space-y-4">
      {/* Venter på AI-serveren (#60): billederne bliver i køen indtil Ollama svarer */}
      {isWaiting && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-900/60">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Hourglass className="w-4 h-4 shrink-0 animate-pulse" /> {t("batch.waitingForAi")}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{tError(waitReason!)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t("batch.waitingForAiHint")}</p>
          {canEnterManually && (
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mt-2">
              {t("batch.manualWhileWaiting")}
            </p>
          )}
        </div>
      )}

      {/* Fremdriftsindikator */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {isComplete ? <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-600" /> {t("batch.done")}</span> : <span className="inline-flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" /> {t("batch.scanningN", { current: currentIndex + 1, total: totalCount })}</span>}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {completedCount}/{totalCount}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              isComplete ? 'bg-green-500' : 'bg-primary-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Estimeret tid — men når vi venter på AI-serveren er det misvisende */}
        {!isComplete && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {isWaiting
              ? t("batch.waitingForAi")
              : completedCount > 0
                ? t("batch.secondsLeft", { seconds: Math.round((totalCount - completedCount) * 80) })
                : t("batch.starting")}
          </p>
        )}
      </div>

      {/* Resultatliste */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const result = results.find(r => r.imageId === item.id);
          const isActive = index === currentIndex && !isComplete;
          const isDone = result !== undefined;
          const hasError = Boolean(result?.error);
          // Manuel indtastning: altid for billeder AI'en har opgivet, og for
          // billeder der stadig venter i køen — men ikke mens AI'en læser
          // billedet, medmindre køen står stille og venter på Ollama (#60).
          const canEnterThis =
            canEnterManually && (hasError || !isDone) && (!isActive || isWaiting);

          return (
            <div
              key={item.id}
              className={`bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-3
                         ${isActive ? 'ring-2 ring-primary-500' : ''}
                         ${hasError ? 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20' : ''}`}
            >
              {/* Thumbnail */}
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={t("card.imageAlt")}
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg shrink-0 bg-gray-200 dark:bg-gray-700" />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                  {item.displayTime}
                </p>

                {isDone && !hasError && result?.reading && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {result.reading.systolic}/{result.reading.diastolic}/{result.reading.pulse}
                    <span className="text-gray-400 ml-1">
                      {result.reading.systolic < 130 && result.reading.diastolic < 80 ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> :
                       result.reading.systolic < 140 ? <AlertTriangle className="w-4 h-4 text-orange-500 inline" /> : <OctagonAlert className="w-4 h-4 text-red-500 inline" />}
                    </span>
                  </p>
                )}

                {hasError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4 inline mr-1 text-red-500" /> {result?.error ? tError(result.error) : ""}
                  </p>
                )}

                {!isDone && !isActive && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("batch.waiting")}</p>
                )}

                {isActive && (
                  <p className="text-xs text-primary-600 dark:text-primary-400 animate-pulse">
                    {isWaiting ? t("batch.waiting") : t("batch.scanningShort")}
                  </p>
                )}

                {canEnterThis && (
                  <button
                    onClick={() => setManualItemId(item.id)}
                    className="mt-1 text-xs font-medium text-primary-600 dark:text-primary-400
                               inline-flex items-center gap-1 hover:underline active:scale-95 transition-all"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> {t("batch.viewImageAndEnter")}
                  </button>
                )}
              </div>

              {/* Status ikon */}
              <div className="shrink-0">
                {isDone && !hasError && <CheckCircle2 className="w-6 h-6 text-green-600" />}
                {hasError && <XCircle className="w-6 h-6 text-red-500 dark:text-red-400" />}
                {isActive && (
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                )}
                {!isDone && !isActive && (
                  <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Annuller knap */}
      {!isComplete && (
        <button
          onClick={onCancel}
          className="w-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-xl font-medium
                     hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
        >
          <X className="w-4 h-4 mr-1 inline" /> {t("batch.cancelScan")}
        </button>
      )}

      {/* Se billede og indtast tallene selv (fx når Ollama ikke kører) */}
      {manualItem && jobId && (
        <BatchManualViewer
          jobId={jobId}
          itemId={manualItem.id}
          imageUrl={manualItem.fullImage ?? manualItem.thumbnail}
          displayTime={manualItem.displayTime}
          age={age}
          onClose={() => setManualItemId(null)}
          onSaved={(result) => onManualSaved?.(result)}
        />
      )}
    </div>
  );
}
