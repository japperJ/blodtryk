"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import Camera from "@/components/Camera";
import BatchUpload, { type UploadImage } from "@/components/BatchUpload";
import BatchProgress, { type ScanResult } from "@/components/BatchProgress";
import BatchTimeline from "@/components/BatchTimeline";
import type { BloodPressureReading, PersonSummary } from "@/types";
import Link from "next/link";

// Kamera-flow steps
type CameraStep = "camera" | "preview" | "scanning" | "confirm" | "saved" | "error";

// Batch-flow steps
type BatchStep = "upload" | "scanning" | "results" | "saved" | "error";

// Aktiv fane
type Tab = "camera" | "batch";

export default function ScanPage() {
  // Valgt person
  const [selectedPerson, setSelectedPerson] = useState<PersonSummary | null>(null);

  // Faneblad
  const [activeTab, setActiveTab] = useState<Tab>("camera");

  // ========== KAMERA-FLOW ==========
  const [cameraStep, setCameraStep] = useState<CameraStep>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [reading, setReading] = useState<BloodPressureReading | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [userAge, setUserAge] = useState<number | null>(null);

  // Hent valgt person
  useEffect(() => {
    const fetchPerson = async () => {
      const savedId = localStorage.getItem("selectedPersonId");
      if (!savedId) return;

      try {
        const res = await fetch("/api/persons");
        const persons = await res.json();
        const person = persons.find((p: PersonSummary) => p.id === parseInt(savedId));
        if (person) setSelectedPerson(person);
      } catch (err) {
        console.error("Failed to fetch person:", err);
      }
    };
    fetchPerson();
  }, []);

  const handleCapture = (imageDataUrl: string) => {
    setCapturedImage(imageDataUrl);
    setCameraStep("preview");
    setErrorMsg("");
  };

  const handleCameraConfirm = async () => {
    if (!capturedImage) return;
    setCameraStep("scanning");

    try {
      const rawBase64 = capturedImage.split(",")[1] || "";
      const scanRes = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: rawBase64,
      });
      const data = await scanRes.json();

      if (!scanRes.ok) {
        throw new Error(data.error || "Scan failed");
      }

      setReading(data.reading);
      setCameraStep("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Ukendt fejl");
      setCameraStep("error");
    }
  };

  const handleCameraSave = async () => {
    if (!reading) return;
    setIsSaving(true);

    try {
      await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...reading,
          age: userAge,
          image: capturedImage || null,
          personId: selectedPerson?.id,
        }),
      });
      setCameraStep("saved");
    } catch {
      setErrorMsg("Kunne ikke gemme måling");
      setCameraStep("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCameraUpdate = (field: keyof BloodPressureReading, value: string) => {
    if (!reading) return;
    setReading({ ...reading, [field]: Number(value) || 0 });
  };

  const handleCameraReset = () => {
    setCameraStep("camera");
    setCapturedImage(null);
    setReading(null);
    setErrorMsg("");
    setUserAge(null);
  };

  const handleRetake = () => {
    setCameraStep("camera");
    setCapturedImage(null);
  };

  // ========== BATCH-FLOW ==========
  const [batchStep, setBatchStep] = useState<BatchStep>("upload");
  const [batchImages, setBatchImages] = useState<UploadImage[]>([]);
  const [batchResults, setBatchResults] = useState<ScanResult[]>([]);
  const [batchCurrentIndex, setBatchCurrentIndex] = useState(0);
  const [batchErrorMsg, setBatchErrorMsg] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleImagesReady = useCallback((images: UploadImage[], age: number | null) => {
    setBatchImages(images);
    setBatchResults([]);
    setBatchCurrentIndex(0);
    setUserAge(age);
    setBatchStep("scanning");
    startBatchScan(images);
  }, []);

  const startBatchScan = async (images: UploadImage[]) => {
    abortControllerRef.current = new AbortController();
    const results: ScanResult[] = [];

    for (let i = 0; i < images.length; i++) {
      if (abortControllerRef.current.signal.aborted) break;

      const img = images[i];
      setBatchCurrentIndex(i);

      try {
        const scanRes = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: img.compressedBase64,
          signal: abortControllerRef.current.signal,
        });
        const data = await scanRes.json();

        if (scanRes.ok && data.reading) {
          results.push({
            imageId: img.id,
            reading: data.reading,
            error: null,
            timestamp: img.exif.dateOriginal,
          });
        } else {
          results.push({
            imageId: img.id,
            reading: null,
            error: data.error || "Scan fejlede",
            timestamp: img.exif.dateOriginal,
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') break;
        results.push({
          imageId: img.id,
          reading: null,
          error: err instanceof Error ? err.message : "Ukendt fejl",
          timestamp: img.exif.dateOriginal,
        });
      }

      setBatchResults([...results]);
    }

    setBatchStep("results");
  };

  const handleCancelBatch = () => {
    abortControllerRef.current?.abort();
    setBatchStep("results");
  };

  const handleSaveBatch = async () => {
    setIsSaving(true);

    try {
      for (const result of batchResults) {
        if (!result.reading) continue;

        const image = batchImages.find(img => img.id === result.imageId);
        if (!image) continue;

        try {
          await fetch("/api/readings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...result.reading,
              age: userAge,
              image: `data:image/jpeg;base64,${image.compressedBase64}`,
              personId: selectedPerson?.id,
            }),
          });
        } catch {
          // Fortsæt med næste ved fejl
        }
      }

      setBatchStep("saved");
    } catch {
      setBatchErrorMsg("Kunne ikke gemme målinger");
      setBatchStep("error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchReset = () => {
    setBatchStep("upload");
    setBatchImages([]);
    setBatchResults([]);
    setBatchCurrentIndex(0);
    setBatchErrorMsg("");
    setUserAge(null);
  };

  // Ingen person valgt — vis besked
  if (!selectedPerson) {
    return (
      <main className="min-h-screen bg-gray-50 pb-24">
        <div className="max-w-lg mx-auto p-4 pt-12 text-center">
          <p className="text-4xl mb-4">👤</p>
          <p className="text-lg font-semibold text-gray-900 mb-2">Vælg en person</p>
          <p className="text-gray-500 mb-6">
            Du skal vælge en person før du kan scanne målinger.
          </p>
          <Link
            href="/persons"
            className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                       hover:bg-primary-700 active:scale-95 transition-all"
          >
            Gå til personer
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        {/* Person-badge */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">🩺 Ny måling</h1>
          <Link
            href="/persons"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50
                       text-primary-700 text-sm font-medium hover:bg-primary-100 transition-colors"
          >
            <span>👤</span>
            <span>{selectedPerson.name}</span>
          </Link>
        </div>

        {/* Faneblad */}
        {cameraStep === "camera" && batchStep === "upload" && (
          <div className="flex gap-1 p-1 bg-gray-200 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab("camera")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all
                         ${activeTab === "camera"
                           ? 'bg-white text-gray-900 shadow-sm'
                           : 'text-gray-500 hover:text-gray-700'}`}
            >
              📷 Kamera
            </button>
            <button
              onClick={() => setActiveTab("batch")}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all
                         ${activeTab === "batch"
                           ? 'bg-white text-gray-900 shadow-sm'
                           : 'text-gray-500 hover:text-gray-700'}`}
            >
              📁 Upload
            </button>
          </div>
        )}

        {/* ========== KAMERA-FLOW ========== */}
        {activeTab === "camera" && (
          <>
            {cameraStep === "camera" && <Camera onCapture={handleCapture} />}

            {cameraStep === "preview" && capturedImage && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 text-center">Tjek billedet inden AI-scanning:</p>
                <img
                  src={capturedImage}
                  alt="Preview"
                  className="w-full max-w-sm mx-auto rounded-xl border-2 border-gray-200 shadow-lg"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleCameraConfirm}
                    className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all"
                  >
                    🔍 Scan med AI
                  </button>
                  <button
                    onClick={handleRetake}
                    className="px-6 py-3 bg-gray-200 rounded-xl font-semibold
                               hover:bg-gray-300 active:scale-95 transition-all"
                  >
                    📷 Tag igen
                  </button>
                </div>
              </div>
            )}

            {cameraStep === "scanning" && (
              <div className="text-center py-12">
                {capturedImage && (
                  <img
                    src={capturedImage}
                    alt="Captured blood pressure meter"
                    className="w-full max-w-sm mx-auto rounded-xl border shadow-lg mb-6"
                  />
                )}
                <div className="animate-pulse text-lg text-gray-600">
                  <p className="text-3xl mb-2">🔍</p>
                  <p>Scanner måling med AI...</p>
                  <p className="text-sm text-gray-400 mt-2">Ca. 60-90 sekunder</p>
                </div>
              </div>
            )}

            {cameraStep === "confirm" && reading && (
              <div className="space-y-4">
                {capturedImage && (
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full max-w-[200px] mx-auto rounded-xl border shadow opacity-60"
                  />
                )}

                <div className="bg-white rounded-2xl p-4 shadow-sm border">
                  <p className="text-xs text-gray-400 text-center mb-3">
                    AI aflæste — ret hvis nødvendigt:
                  </p>

                  <div className="space-y-3">
                    {([
                      { key: "systolic" as const, label: "Systolisk", unit: "mmHg", color: "text-red-600" },
                      { key: "diastolic" as const, label: "Diastolisk", unit: "mmHg", color: "text-orange-600" },
                      { key: "pulse" as const, label: "Puls", unit: "bpm", color: "text-blue-600" },
                    ]).map(({ key, label, unit, color }) => (
                      <div key={key} className="flex items-center gap-3">
                        <div className="w-20 shrink-0">
                          <p className="text-sm font-medium text-gray-600">{label}</p>
                          <p className="text-[10px] text-gray-400">{unit}</p>
                        </div>
                        <button
                          onClick={() => handleCameraUpdate(key, String(reading[key] - 1))}
                          className="w-12 h-12 rounded-full bg-gray-100 text-2xl font-bold text-gray-600
                                     hover:bg-gray-200 active:scale-90 transition-all flex items-center justify-center shrink-0"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={reading[key]}
                          onChange={(e) => handleCameraUpdate(key, e.target.value)}
                          className={`flex-1 text-center text-4xl font-bold border-2 border-gray-200 rounded-xl
                                       py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-0 ${color}`}
                        />
                        <button
                          onClick={() => handleCameraUpdate(key, String(reading[key] + 1))}
                          className="w-12 h-12 rounded-full bg-gray-100 text-2xl font-bold text-gray-600
                                     hover:bg-gray-200 active:scale-90 transition-all flex items-center justify-center shrink-0"
                        >
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alder-input */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border">
                  <div className="flex items-center gap-3">
                    <div className="w-20 shrink-0">
                      <p className="text-sm font-medium text-gray-600">Alder</p>
                      <p className="text-[10px] text-gray-400">for bedre vurdering</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={userAge ?? ""}
                      onChange={(e) => setUserAge(e.target.value ? Number(e.target.value) : null)}
                      placeholder="f.eks. 65"
                      className="flex-1 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl
                                 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-0
                                 text-gray-900 placeholder-gray-300"
                    />
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-sm text-gray-500">år</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCameraSave}
                    disabled={isSaving}
                    className="flex-1 bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSaving ? "Gemmer..." : "✓ Gem måling"}
                  </button>
                  <button
                    onClick={handleCameraReset}
                    className="w-14 h-14 bg-gray-200 rounded-xl text-lg font-semibold
                               hover:bg-gray-300 active:scale-95 transition-all flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {cameraStep === "saved" && (
              <div className="text-center py-12">
                <p className="text-5xl mb-4">✅</p>
                <p className="text-xl font-semibold text-gray-900">Måling gemt!</p>
                <button
                  onClick={handleCameraReset}
                  className="mt-6 bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  Tag en ny måling
                </button>
              </div>
            )}

            {cameraStep === "error" && (
              <div className="text-center py-12">
                <p className="text-5xl mb-4">❌</p>
                <p className="text-xl font-semibold text-danger-600">Fejl</p>
                <p className="text-gray-600 mt-2">{errorMsg}</p>
                <button
                  onClick={handleCameraReset}
                  className="mt-6 bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  Prøv igen
                </button>
              </div>
            )}
          </>
        )}

        {/* ========== BATCH-FLOW ========== */}
        {activeTab === "batch" && (
          <>
            {batchStep === "upload" && (
              <BatchUpload onImagesReady={handleImagesReady} />
            )}

            {batchStep === "scanning" && (
              <BatchProgress
                images={batchImages}
                results={batchResults}
                currentIndex={batchCurrentIndex}
                isComplete={false}
                onCancel={handleCancelBatch}
              />
            )}

            {batchStep === "results" && (
              <BatchTimeline
                images={batchImages}
                results={batchResults}
                onSaveAll={handleSaveBatch}
                isSaving={isSaving}
                onReset={handleBatchReset}
              />
            )}

            {batchStep === "saved" && (
              <div className="text-center py-12">
                <p className="text-5xl mb-4">✅</p>
                <p className="text-xl font-semibold text-gray-900">
                  {batchResults.filter(r => r.reading).length} måling{batchResults.filter(r => r.reading).length !== 1 ? 'er' : ''} gemt!
                </p>
                <button
                  onClick={handleBatchReset}
                  className="mt-6 bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  Upload flere billeder
                </button>
              </div>
            )}

            {batchStep === "error" && (
              <div className="text-center py-12">
                <p className="text-5xl mb-4">❌</p>
                <p className="text-xl font-semibold text-danger-600">Fejl</p>
                <p className="text-gray-600 mt-2">{batchErrorMsg}</p>
                <button
                  onClick={handleBatchReset}
                  className="mt-6 bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  Prøv igen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
