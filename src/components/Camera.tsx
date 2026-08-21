"use client";

import { Camera as CameraIcon, Loader2 } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";

interface Props {
  onCapture: (imageDataUrl: string) => void;
}

export default function Camera({ onCapture }: Props) {
  const { videoRef, canvasRef, isActive, isReady, error, start, stop, capture } = useCamera();

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
          <span className="inline-flex items-center gap-2"><CameraIcon className="w-5 h-5" /> Åbn kamera</span>
        </button>
      ) : (
        <div className="w-full max-w-md">
          {/* Live camera preview */}
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg bg-black" style={{ aspectRatio: "4/3" }}>
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
                <p className="text-white text-lg"><Loader2 className="w-5 h-5 animate-spin inline mr-1" /> Starter kamera...</p>
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
            {isReady ? <span className="inline-flex items-center gap-2"><CameraIcon className="w-5 h-5" /> Tag billede</span> : <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Kamera starter...</span>}
            </button>
            <button
              onClick={stop}
              className="px-6 py-3 bg-gray-200 rounded-xl font-semibold
                         hover:bg-gray-300 active:scale-95 transition-all"
            >
              Annuller
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-danger-600 text-center bg-red-50 p-3 rounded-lg">{error}</p>
      )}
    </div>
  );
}
