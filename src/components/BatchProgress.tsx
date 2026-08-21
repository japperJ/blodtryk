"use client";
import type { UploadImage } from "./BatchUpload";

export interface ScanResult {
  imageId: string;
  reading: { systolic: number; diastolic: number; pulse: number } | null;
  error: string | null;
  timestamp: Date | null;
}

interface Props {
  images: UploadImage[];
  results: ScanResult[];
  currentIndex: number;
  isComplete: boolean;
  onCancel: () => void;
}

export default function BatchProgress({ images, results, currentIndex, isComplete, onCancel }: Props) {
  const completedCount = results.length;
  const totalCount = images.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Fremdriftsindikator */}
      <div className="bg-white rounded-xl p-4 shadow-sm border">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">
            {isComplete ? '✅ Scanning færdig' : `⏳ Scanner billede ${currentIndex + 1} af ${totalCount}...`}
          </p>
          <p className="text-sm text-gray-500">
            {completedCount}/{totalCount}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              isComplete ? 'bg-green-500' : 'bg-primary-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Estimeret tid */}
        {!isComplete && (
          <p className="text-xs text-gray-400 mt-2">
            {completedCount > 0
              ? `Ca. ${Math.round(((totalCount - completedCount) * 80))} sekunder tilbage`
              : 'Starter scanning...'}
          </p>
        )}
      </div>

      {/* Resultatliste */}
      <div className="space-y-2">
        {images.map((img, index) => {
          const result = results.find(r => r.imageId === img.id);
          const isActive = index === currentIndex && !isComplete;
          const isDone = result !== undefined;
          const hasError = result?.error !== null;

          return (
            <div
              key={img.id}
              className={`bg-white rounded-xl p-3 shadow-sm border flex items-center gap-3
                         ${isActive ? 'ring-2 ring-primary-500' : ''}
                         ${hasError ? 'border-red-200 bg-red-50' : ''}`}
            >
              {/* Thumbnail */}
              <img
                src={img.thumbnail}
                alt="Billede"
                className="w-12 h-12 rounded-lg object-cover shrink-0"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {img.displayTime}
                </p>

                {isDone && !hasError && result?.reading && (
                  <p className="text-sm text-gray-600">
                    {result.reading.systolic}/{result.reading.diastolic}/{result.reading.pulse}
                    <span className="text-gray-400 ml-1">
                      {result.reading.systolic < 130 && result.reading.diastolic < 80 ? '✅' :
                       result.reading.systolic < 140 ? '⚠️' : '🔴'}
                    </span>
                  </p>
                )}

                {hasError && (
                  <p className="text-sm text-red-600">
                    ❌ {result?.error}
                  </p>
                )}

                {!isDone && !isActive && (
                  <p className="text-xs text-gray-400">Venter...</p>
                )}

                {isActive && (
                  <p className="text-xs text-primary-600 animate-pulse">
                    Scanner...
                  </p>
                )}
              </div>

              {/* Status ikon */}
              <div className="shrink-0">
                {isDone && !hasError && '✅'}
                {hasError && '❌'}
                {isActive && (
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                )}
                {!isDone && !isActive && (
                  <div className="w-5 h-5 rounded-full bg-gray-200" />
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
          className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-medium
                     hover:bg-gray-300 active:scale-95 transition-all"
        >
          ✕ Annuller scanning
        </button>
      )}
    </div>
  );
}
