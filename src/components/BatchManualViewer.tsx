"use client";

// "Se billede og indtast selv" til batch-billeder der ikke er læst endnu.
// Bruges når AI'en ikke kan læse billedet — fx når Ollama ikke kører og køen
// venter — så målingen stadig kan gemmes sammen med billedet. Samme
// indtastningsfelt (ManualReadingEditor) som ved fejlede billeder, men med
// billedet i stor størrelse så tallene kan læses af skærmen.

import { ArrowLeft, ImageOff } from "lucide-react";
import { useState } from "react";
import ManualReadingEditor from "./ManualReadingEditor";
import type { ScanResult } from "./BatchProgress";
import { useI18n } from "@/lib/I18nProvider";

// Startpunkt for en ny, manuel måling (samme som MANUAL_DEFAULTS i scan/page.tsx)
const DEFAULT_READING = { systolic: 120, diastolic: 80, pulse: 70 };

interface Props {
  jobId: string;
  itemId: string;
  /** Billede i fuld størrelse — data-URL eller filnavn/sti til /api/image */
  imageUrl: string | null;
  displayTime: string;
  age?: number | null;
  onClose: () => void;
  onSaved: (result: ScanResult) => void;
}

export default function BatchManualViewer({
  jobId,
  itemId,
  imageUrl,
  displayTime,
  age,
  onClose,
  onSaved,
}: Props) {
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Dubletter (og andre sprunget over-billeder) har ingen fil på serveren —
  // vis en forklarende tekst i stedet for et knækket billede
  const [imageFailed, setImageFailed] = useState(false);

  const imageSrc = imageUrl
    ? imageUrl.startsWith("data:") || imageUrl.startsWith("http") || imageUrl.startsWith("/")
      ? imageUrl
      : `/api/image/${encodeURIComponent(imageUrl)}`
    : null;

  const handleSave = async (values: {
    systolic: number;
    diastolic: number;
    pulse: number;
    timeOfDay: "morning" | "evening" | null;
    arm: "left" | "right" | null;
    note: string | null;
  }) => {
    if (isSaving) return;
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/batch-jobs/${jobId}/items/${encodeURIComponent(itemId)}/manual`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );

      const data: { reading?: { systolic: number; diastolic: number; pulse: number; createdAt?: string }; error?: string } | null =
        await res.json().catch(() => null);

      if (!res.ok || !data?.reading) {
        setError(data?.error ?? "manualEntryFailed");
        return;
      }

      onSaved({
        imageId: itemId,
        reading: {
          systolic: data.reading.systolic,
          diastolic: data.reading.diastolic,
          pulse: data.reading.pulse,
        },
        error: null,
        timestamp: data.reading.createdAt ? new Date(data.reading.createdAt) : null,
      });
      onClose();
    } catch {
      setError("manualEntryFailed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm p-4 flex justify-between items-center">
        <button
          onClick={onClose}
          className="text-white text-sm font-medium flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> {t("common.back")}
        </button>
        <p className="text-white/80 text-sm">{displayTime}</p>
      </div>

      {/* Billede */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto min-h-[30vh]">
        {imageSrc && !imageFailed ? (
          <img
            src={imageSrc}
            alt={t("viewer.imageAlt")}
            onError={() => setImageFailed(true)}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        ) : (
          <p className="text-white/80 text-sm">
            <ImageOff className="w-4 h-4 inline mr-1" /> {t("viewer.unreadable")}
          </p>
        )}
      </div>

      {/* Indtastning */}
      <div className="w-full max-w-lg mx-auto bg-white dark:bg-gray-800 p-4 rounded-t-2xl shadow-lg overflow-y-auto max-h-[70vh]">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t("viewer.manualEntryTitle")}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{t("viewer.manualEntryHint")}</p>

        <ManualReadingEditor
          initialReading={DEFAULT_READING}
          age={age}
          onSave={handleSave}
          onCancel={onClose}
          error={error}
        />
      </div>
    </div>
  );
}
