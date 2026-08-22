"use client";

import { ArrowLeft, ImageOff, Pencil } from "lucide-react";
import { useState } from "react";

interface Props {
  imageUrl: string | null;
  reading: {
    systolic: number;
    diastolic: number;
    pulse: number;
  } | null;
  timestamp: string;
  onClose: () => void;
}

export default function ImageViewer({ imageUrl, reading, timestamp, onClose }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReading, setEditedReading] = useState(reading);

  if (!imageUrl) return null;

  // Tjek om det er en data-URL eller en filsti
  const imageSrc = imageUrl.startsWith('data:') || imageUrl.startsWith('http')
    ? imageUrl
    : `/api/image/${encodeURIComponent(imageUrl)}`;

  const date = new Date(timestamp);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm p-4 flex justify-between items-center">
        <button
          onClick={onClose}
          className="text-white text-sm font-medium flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Tilbage
        </button>
        <p className="text-white/80 text-sm">
          {date.toLocaleDateString('da-DK', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {' '}
          {date.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Billede */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <img
          src={imageSrc}
          alt="Blodtryksmåling"
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </div>

      {/* Info panel */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-t-2xl shadow-lg">
        {reading && !isEditing && (
          <>
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">AI aflæste:</p>
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-primary-600 dark:text-primary-400 font-medium"
              >
                <span className="inline-flex items-center gap-1"><Pencil className="w-3.5 h-3.5" /> Ret</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{reading.systolic}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Systolisk</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{reading.diastolic}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Diastolisk</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{reading.pulse}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Puls</p>
              </div>
            </div>
          </>
        )}

        {isEditing && editedReading && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Ret måling:</p>

            {([
              { key: "systolic" as const, label: "Systolisk", color: "text-red-600 dark:text-red-400" },
              { key: "diastolic" as const, label: "Diastolisk", color: "text-orange-600 dark:text-orange-400" },
              { key: "pulse" as const, label: "Puls", color: "text-blue-600 dark:text-blue-400" },
            ]).map(({ key, label, color }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-20 text-sm text-gray-600 dark:text-gray-300">{label}</span>
                <button
                  onClick={() => setEditedReading({
                    ...editedReading,
                    [key]: editedReading[key] - 1,
                  })}
                  className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700 dark:text-gray-100 text-xl font-bold
                             hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-90 transition-all"
                >
                  −
                </button>
                <input
                  type="number"
                  value={editedReading[key]}
                  onChange={(e) => setEditedReading({
                    ...editedReading,
                    [key]: Number(e.target.value) || 0,
                  })}
                  className={`flex-1 text-center text-2xl font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-2 ${color}`}
                />
                <button
                  onClick={() => setEditedReading({
                    ...editedReading,
                    [key]: editedReading[key] + 1,
                  })}
                  className="w-11 h-11 rounded-full bg-gray-100 dark:bg-gray-700 dark:text-gray-100 text-xl font-bold
                             hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-90 transition-all"
                >
                  +
                </button>
              </div>
            ))}

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  // TODO: Gem den redigerede måling
                  setIsEditing(false);
                }}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold"
              >
                Gem rettelse
              </button>
              <button
                onClick={() => {
                  setEditedReading(reading);
                  setIsEditing(false);
                }}
                className="px-4 py-3 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-lg font-semibold"
              >
                Annuller
              </button>
            </div>
          </div>
        )}

        {!reading && (
          <div className="text-center py-4">
            <p className="text-red-600 dark:text-red-400"><ImageOff className="w-4 h-4 inline mr-1" /> Billedet kunne ikke aflæses</p>
          </div>
        )}
      </div>
    </div>
  );
}
