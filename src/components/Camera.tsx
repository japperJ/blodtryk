"use client";

import { Camera as CameraIcon, Loader2 } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { useI18n } from "@/lib/I18nProvider";

interface Props {
  onCapture: (imageDataUrl: string) => void;
}

export default function Camera({ onCapture }: Props) {
  const { videoRef, canvasRef, isActive, isReady, error, start, stop, capture } = useCamera();
  const { t } = useI18n();

  const handleCapture = async () => {
    const data = await capture();
    if (data) {
      stop();
      onCapture(data);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas ref={canvasRef} className="hidden" />

      {!isActive ? (
        <button
          onClick={start}
          className="bg-primary-600 text-white px-8 py-4 rounded-xl text-lg font-semibold
                     hover:bg-primary-700 active:scale-95 transition-all shadow-lg"
        >
          <span className="inline-flex items-center gap-2"><CameraIcon className="w-5 h-5" /> {t("camera.open")}</span>
        </button>
      ) : (
        <div className="w-full max-w-md">
          {/* Live camera preview */}
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-lg bg-black" style={{ aspectRatio: "4/3" }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: "cover" }}
            />
            {!isReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <p className="text-white text-lg"><Loader2 className="w-5 h-5 animate-spin inline mr-1" /> {t("camera.starting")}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCapture}
              disabled={!isReady}
              className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold
                         hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {isReady ? <span className="inline-flex items-center gap-2"><CameraIcon className="w-5 h-5" /> {t("camera.capture")}</span> : <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> {t("camera.starting")}</span>}
            </button>
            <button
              onClick={stop}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-xl font-semibold
                         hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-danger-600 dark:text-red-400 text-center bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">{error ? t(error) : null}</p>
      )}
    </div>
  );
}
