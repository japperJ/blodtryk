"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import type { Reading } from "@/types";
import { getBPStatus, getAgeGroupKey } from "@/lib/bpClassification";
import { useI18n } from "@/lib/I18nProvider";
import { INTL_LOCALE } from "@/lib/i18n";
import ImageViewer from "./ImageViewer";

interface Props {
  reading: Reading;
  onDelete: (id: number) => void;
  onEdit?: (reading: Reading) => void;
}

export default function ReadingCard({ reading, onDelete, onEdit }: Props) {
  const { t, locale } = useI18n();
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showFullNote, setShowFullNote] = useState(false);
  const date = new Date(reading.createdAt);
  const status = getBPStatus(reading.systolic, reading.diastolic, reading.age);
  const ageGroupKey = getAgeGroupKey(reading.age);

  // Note — blank streng behandles som ingen note
  const noteText = reading.note?.trim() ?? "";

  // Tjek om der er et billede
  const hasImage = !!reading.image;
  const imageSrc = hasImage
    ? (reading.image!.startsWith('data:') || reading.image!.startsWith('http')
        ? reading.image!
        : `/api/image/${encodeURIComponent(reading.image!)}`)
    : null;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-start gap-3">
            {/* Thumbnail */}
            {hasImage && imageSrc && (
              <button
                onClick={() => setShowImageViewer(true)}
                className="shrink-0 group"
              >
                <img
                  src={imageSrc}
                  alt={t("card.imageAlt")}
                  className="w-14 h-14 rounded-lg object-cover border-2 border-gray-100 dark:border-gray-600
                             group-hover:border-primary-300 transition-colors"
                />
              </button>
            )}

            {/* Dato/tid + alder */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {date.toLocaleDateString(INTL_LOCALE[locale], { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {date.toLocaleTimeString(INTL_LOCALE[locale], { hour: "2-digit", minute: "2-digit" })}
                </p>
                {reading.age != null && (
                  <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
                    {t("card.ageChip", { age: reading.age })}
                  </span>
                )}
                {/* Kontekst-tags — kun vist hvis angivet */}
                {reading.timeOfDay && (
                  <span
                    className="text-[10px] bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded-full"
                    title={reading.timeOfDay === "morning" ? t("tod.morningTitle") : t("tod.eveningTitle")}
                  >
                    {reading.timeOfDay === "morning" ? t("tod.morningEmoji") : t("tod.eveningEmoji")}
                  </span>
                )}
                {reading.arm && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                    {reading.arm === "left" ? t("arm.left") : t("arm.right")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.color}`}>
            {t(status.labelKey)}
          </span>
        </div>

        {/* Måling */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reading.systolic}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("field.systolic")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reading.diastolic}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("field.diastolic")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{reading.pulse}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("field.pulse")}</p>
          </div>
        </div>

        {/* Aldersbaseret vurdering */}
        {reading.age != null && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-2">
            {ageGroupKey && t(ageGroupKey)} — {t(status.descriptionKey)}
          </p>
        )}

        {/* Note — afkortet til én linje, tryk for at folde ud/sammen */}
        {noteText && (
          <button
            type="button"
            onClick={() => setShowFullNote((v) => !v)}
            title={showFullNote ? t("card.hideNote") : t("card.showFullNote")}
            className="w-full text-left mt-2"
          >
            {showFullNote ? (
              <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap break-words">
                📝 {noteText}
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">📝 {noteText}</p>
            )}
          </button>
        )}

        {/* Handlinger */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
          {hasImage ? (
            <button
              onClick={() => setShowImageViewer(true)}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
            >
              🖼️ {t("card.viewImage")}
            </button>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">{t("card.noImage")}</span>
          )}

          <div className="flex items-center gap-3">
            {onEdit && (
              <button
                onClick={() => onEdit(reading)}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <span className="inline-flex items-center gap-1"><Pencil className="w-3 h-3" /> {t("common.edit")}</span>
              </button>
            )}
            <button
              onClick={() => onDelete(reading.id)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-danger-600 dark:hover:text-red-400 transition-colors"
            >
              {t("common.delete")}
            </button>
          </div>
        </div>
      </div>

      {/* ImageViewer modal */}
      {showImageViewer && (
        <ImageViewer
          imageUrl={reading.image}
          reading={{
            systolic: reading.systolic,
            diastolic: reading.diastolic,
            pulse: reading.pulse,
          }}
          timestamp={reading.createdAt}
          onClose={() => setShowImageViewer(false)}
        />
      )}
    </>
  );
}
