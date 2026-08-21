"use client";
import { useState } from "react";
import type { Reading } from "@/types";
import { getBPStatus, getAgeGroupLabel } from "@/lib/bpClassification";
import ImageViewer from "./ImageViewer";

interface Props {
  reading: Reading;
  onDelete: (id: number) => void;
}

export default function ReadingCard({ reading, onDelete }: Props) {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const date = new Date(reading.createdAt);
  const status = getBPStatus(reading.systolic, reading.diastolic, reading.age);
  const ageGroupLabel = getAgeGroupLabel(reading.age);

  // Tjek om der er et billede
  const hasImage = !!reading.image;
  const imageSrc = hasImage
    ? (reading.image!.startsWith('data:') || reading.image!.startsWith('http')
        ? reading.image!
        : `/api/image/${encodeURIComponent(reading.image!)}`)
    : null;

  return (
    <>
      <div className="bg-white rounded-xl p-4 shadow-sm border hover:shadow-md transition-shadow">
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
                  alt="Måling"
                  className="w-14 h-14 rounded-lg object-cover border-2 border-gray-100
                             group-hover:border-primary-300 transition-colors"
                />
              </button>
            )}

            {/* Dato/tid + alder */}
            <div>
              <p className="text-sm text-gray-500">
                {date.toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">
                  {date.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {reading.age != null && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {reading.age} år
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className={`text-xs font-medium px-2 py-1 rounded-full ${status.color}`}>
            {status.label}
          </span>
        </div>

        {/* Måling */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{reading.systolic}</p>
            <p className="text-xs text-gray-500">Systolisk</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{reading.diastolic}</p>
            <p className="text-xs text-gray-500">Diastolisk</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{reading.pulse}</p>
            <p className="text-xs text-gray-500">Puls</p>
          </div>
        </div>

        {/* Aldersbaseret vurdering */}
        {reading.age != null && (
          <p className="text-[11px] text-gray-400 text-center mt-2">
            {ageGroupLabel} — {status.description}
          </p>
        )}

        {/* Handlinger */}
        <div className="mt-3 pt-3 border-t flex justify-between items-center">
          {hasImage ? (
            <button
              onClick={() => setShowImageViewer(true)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors"
            >
              🖼️ Se billede
            </button>
          ) : (
            <span className="text-xs text-gray-400">Ingen billede</span>
          )}

          <button
            onClick={() => onDelete(reading.id)}
            className="text-xs text-gray-400 hover:text-danger-600 transition-colors"
          >
            Slet
          </button>
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
