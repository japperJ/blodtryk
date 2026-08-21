"use client";
import { ImageOff, Save, X } from "lucide-react";
import type { ScanResult } from "./BatchProgress";
import type { UploadImage } from "./BatchUpload";
import { getBPStatus } from "@/lib/bpClassification";

interface Props {
  images: UploadImage[];
  results: ScanResult[];
  onSaveAll: () => void;
  isSaving: boolean;
  onReset: () => void;
  age?: number | null; // Personens alder til aldersjusteret klassificering
}

export default function BatchTimeline({ images, results, onSaveAll, isSaving, onReset, age }: Props) {
  // Sorter resultater efter tidspunkt (nyeste først)
  const sortedResults = [...results]
    .filter(r => r.reading !== null) // Kun succesfulde
    .sort((a, b) => {
      const timeA = a.timestamp?.getTime() || 0;
      const timeB = b.timestamp?.getTime() || 0;
      return timeB - timeA; // Nyeste først
    });

  const failedCount = results.filter(r => r.error !== null).length;
  const successCount = sortedResults.length;

  return (
    <div className="space-y-4">
      {/* Oversigt */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              📊 {successCount} måling{successCount !== 1 ? 'er' : ''} klar
            </p>
            {failedCount > 0 && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {failedCount} billede{failedCount !== 1 ? 'r' : ''} kunne ikke aflæses
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tidslinje */}
      <div className="space-y-2">
        {sortedResults.map((result) => {
          const image = images.find(img => img.id === result.imageId);
          if (!image || !result.reading) return null;

          const date = result.timestamp;
          const status = getBPStatus(result.reading.systolic, result.reading.diastolic, age);

          return (
            <div
              key={result.imageId}
              className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-3"
            >
              {/* Thumbnail */}
              <img
                src={image.thumbnail}
                alt="Billede"
                className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-gray-600"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {date ? date.toLocaleDateString('da-DK', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    }) : 'Ukendt dato'}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {date ? date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }) : ''}
                  {image.exif.model && ` • ${image.exif.model}`}
                </p>
              </div>

              {/* Måling */}
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {result.reading.systolic}/{result.reading.diastolic}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Puls {result.reading.pulse}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fejlede billeder */}
      {failedCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-900/60">
          <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
            <ImageOff className="w-4 h-4 inline mr-1 text-red-700 dark:text-red-300" />️ Billeder der ikke kunne aflæses:
          </p>
          <div className="space-y-1">
            {results.filter(r => r.error).map((result) => {
              const image = images.find(img => img.id === result.imageId);
              return (
                <div key={result.imageId} className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <img
                    src={image?.thumbnail}
                    alt=""
                    className="w-8 h-8 rounded object-cover opacity-50"
                  />
                  <span>{result.error}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Handlinger */}
      <div className="flex gap-3">
        <button
          onClick={onSaveAll}
          disabled={isSaving || successCount === 0}
          className="flex-1 bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold
                     hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {isSaving ? 'Gemmer...' : `💾 Gem ${successCount} måling${successCount !== 1 ? 'er' : ''}`}
        </button>

        <button
          onClick={onReset}
          className="w-14 h-14 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-xl text-lg font-semibold
                     hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all flex items-center justify-center"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

