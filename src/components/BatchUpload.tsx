"use client";

import { Images, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { extractExifData, formatExifDate, type ExifData } from "@/lib/exif";
import { compressImageForOCR, createThumbnail } from "@/lib/imageUtils";

export interface UploadImage {
  id: string;
  file: File;
  thumbnail: string;       // Data-URL til miniaturebillede
  compressedBase64: string; // Komprimeret base64 til OCR
  exif: ExifData;
  displayTime: string;     // Formateret tidspunkt
}

interface Props {
  onImagesReady: (images: UploadImage[]) => void;
}

export default function BatchUpload({ onImagesReady }: Props) {
  const [selectedImages, setSelectedImages] = useState<UploadImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filtrer kun billeder
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      alert('Valgte filer er ikke billeder');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: imageFiles.length });

    const processedImages: UploadImage[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      setProgress({ current: i + 1, total: imageFiles.length });

      try {
        // Læs EXIF-data
        const exif = await extractExifData(file);

        // Opret thumbnail
        const thumbnail = await createThumbnail(file);

        // Komprimer billede til OCR
        const compressedBase64 = await compressImageForOCR(file);

        // Unikt ID
        const id = `upload-${Date.now()}-${i}`;

        processedImages.push({
          id,
          file,
          thumbnail,
          compressedBase64,
          exif,
          displayTime: formatExifDate(exif.dateOriginal),
        });
      } catch (error) {
        console.error(`Failed to process image ${file.name}:`, error);
        // Spring over ved fejl
      }
    }

    setSelectedImages(processedImages);
    setIsProcessing(false);
    setProgress({ current: 0, total: 0 });
  };

  const handleStartScan = () => {
    if (selectedImages.length === 0) return;
    onImagesReady(selectedImages);
  };

  const handleRemoveImage = (id: string) => {
    setSelectedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {/* Upload område */}
      <div
        onClick={handleClick}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center
                   hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-all cursor-pointer"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {isProcessing ? (
          <div className="space-y-2">
            <p className="text-2xl"><Loader2 className="w-8 h-8 animate-spin text-primary-600 dark:text-primary-400 inline" /> </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Behandler billede {progress.current} af {progress.total}...
            </p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-4xl mb-2">📁</p>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
              Vælg billeder fra galleriet
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Tryk for at vælge — kan vælge flere på én gang
            </p>
          </>
        )}
      </div>

      {/* Valgte billeder */}
      {selectedImages.length > 0 && !isProcessing && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2"><Images className="w-4 h-4" /> {selectedImages.length} billede{selectedImages.length !== 1 ? 'r' : ''} valgt</p>

            <div className="grid grid-cols-5 gap-2">
              {selectedImages.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.thumbnail}
                    alt="Preview"
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px]
                                  text-center py-0.5 rounded-b-lg truncate px-1">
                    {img.exif.dateOriginal
                      ? img.exif.dateOriginal.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
                      : '?'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveImage(img.id);
                    }}
                    className="absolute top-0.5 right-0.5 h-6 w-6 bg-red-500 text-white rounded-full
                               text-xs flex items-center justify-center opacity-0 group-hover:opacity-100
                               transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Oversigt over tidsstempler */}
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tidsstempler fra kamera: {selectedImages.map(img =>
                  img.exif.dateOriginal
                    ? img.exif.dateOriginal.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })
                    : '?'
                ).join(' → ')}
              </p>
            </div>
          </div>

          {/* Start scanning knap */}
          <button
            onClick={handleStartScan}
            className="w-full bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold
                       hover:bg-primary-700 active:scale-95 transition-all"
          >
            🔍 Scan {selectedImages.length} billede{selectedImages.length !== 1 ? 'r' : ''}
          </button>
        </>
      )}
    </div>
  );
}
