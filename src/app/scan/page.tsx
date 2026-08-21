"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Stethoscope,
  User,
  Camera as CameraIcon,
  FolderOpen,
  Keyboard,
  ScanLine,
  Check,
  X,
  CircleCheckBig,
  XCircle,
  TriangleAlert,
} from "lucide-react";
import Camera from "@/components/Camera";
import ReadingStepper from "@/components/ReadingStepper";
import BatchUpload, { type UploadImage } from "@/components/BatchUpload";
import BatchProgress, { type ScanResult } from "@/components/BatchProgress";
import BatchTimeline from "@/components/BatchTimeline";
import ContextTagChips from "@/components/ContextTagChips";
import EmptyState from "@/components/EmptyState";
import type { BloodPressureReading, PersonSummary, TimeOfDay, Arm } from "@/types";
import Link from "next/link";

// Kamera-flow steps
type CameraStep = "camera" | "preview" | "scanning" | "confirm" | "saved" | "error";

// Batch-flow steps
type BatchStep = "upload" | "scanning" | "results" | "saved" | "error";

// Manuel-flow steps
type ManualStep = "form" | "saved";

// Aktiv fane
type Tab = "camera" | "batch" | "manual";

// Standardværdier for manuel indtastning
const MANUAL_DEFAULTS: BloodPressureReading = { systolic: 120, diastolic: 80, pulse: 70 };

// Hjælper: Dato -> værdi til <input type="datetime-local"> i lokal tid
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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

  // Kontekst-tags for kamera-flowets bekræftelsestrin
  const [cameraTimeOfDay, setCameraTimeOfDay] = useState<TimeOfDay | null>(null);
  const [cameraArm, setCameraArm] = useState<Arm | null>(null);

  // Alder beregnet ud fra personens fødselsår (null hvis ikke oplyst)
  const currentYear = new Date().getFullYear();
  const derivedAge =
    selectedPerson?.birthYear != null ? currentYear - selectedPerson.birthYear : null;

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
          age: derivedAge ?? userAge,
          image: capturedImage || null,
          timeOfDay: cameraTimeOfDay,
          arm: cameraArm,
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

  const handleCameraUpdate = (field: keyof BloodPressureReading, value: number) => {
    if (!reading) return;
    setReading({ ...reading, [field]: value });
  };

  const handleCameraReset = () => {
    setCameraStep("camera");
    setCapturedImage(null);
    setReading(null);
    setErrorMsg("");
    setUserAge(null);
    setCameraTimeOfDay(null);
    setCameraArm(null);
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

  const handleImagesReady = useCallback((images: UploadImage[]) => {
    setBatchImages(images);
    setBatchResults([]);
    setBatchCurrentIndex(0);
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
              age: derivedAge,
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
  };

  // ========== MANUEL-FLOW ==========
  const [manualStep, setManualStep] = useState<ManualStep>("form");
  const [manualValues, setManualValues] = useState<BloodPressureReading>(MANUAL_DEFAULTS);
  const [measuredAt, setMeasuredAt] = useState(""); // sat efter mount (undgår hydration-mismatch)
  const [manualNote, setManualNote] = useState("");
  const [manualError, setManualError] = useState("");
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Kontekst-tags for manuel indtastning
  const [manualTimeOfDay, setManualTimeOfDay] = useState<TimeOfDay | null>(null);
  const [manualArm, setManualArm] = useState<Arm | null>(null);

  useEffect(() => {
    setMeasuredAt(toLocalInputValue(new Date()));
  }, []);

  const handleManualUpdate = (key: keyof BloodPressureReading, value: number) => {
    setManualValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleManualSave = async () => {
    if (!selectedPerson) return;
    setIsSavingManual(true);
    setManualError("");

    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systolic: manualValues.systolic,
          diastolic: manualValues.diastolic,
          pulse: manualValues.pulse,
          age: derivedAge ?? userAge,
          note: manualNote.trim() ? manualNote.trim() : null,
          timeOfDay: manualTimeOfDay,
          arm: manualArm,
          personId: selectedPerson.id,
          createdAt: measuredAt ? new Date(measuredAt).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Vis API-valideringsfejl inline på formularen
        setManualError(data?.error || "Kunne ikke gemme måling");
        return;
      }

      setManualStep("saved");
    } catch {
      setManualError("Kunne ikke gemme måling");
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleManualReset = () => {
    setManualStep("form");
    setManualValues(MANUAL_DEFAULTS);
    setMeasuredAt(toLocalInputValue(new Date()));
    setManualNote("");
    setManualTimeOfDay(null);
    setManualArm(null);
    setManualError("");
  };

  // Ingen person valgt — vis besked
  if (!selectedPerson) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
        <div className="max-w-lg mx-auto p-4 pt-12">
          <EmptyState
            icon={User}
            title="Vælg en person"
            description="Du skal vælge en person før du kan scanne målinger."
            action={
              <Link
                href="/persons"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                Gå til personer
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <div className="max-w-lg mx-auto p-4 pt-6">
        {/* Person-badge */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Stethoscope className="w-6 h-6 text-primary-600 dark:text-primary-400" aria-hidden />
            Ny måling
          </h1>
          <Link
            href="/persons"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/40
                       text-primary-700 dark:text-primary-300 text-sm font-medium hover:bg-primary-100 dark:hover:bg-primary-900/60 transition-colors"
          >
            <User className="w-4 h-4" aria-hidden />
            <span>{selectedPerson.name}</span>
          </Link>
        </div>

        {/* Faneblad */}
        {cameraStep === "camera" && batchStep === "upload" && manualStep === "form" && (
          <div className="flex gap-1 p-1 bg-gray-200 dark:bg-gray-700 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab("camera")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all
                         ${activeTab === "camera"
                           ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                           : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <CameraIcon className="w-4 h-4" aria-hidden />
              Kamera
            </button>
            <button
              onClick={() => setActiveTab("batch")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all
                         ${activeTab === "batch"
                           ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                           : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <FolderOpen className="w-4 h-4" aria-hidden />
              Upload
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all
                         ${activeTab === "manual"
                           ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                           : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <Keyboard className="w-4 h-4" aria-hidden />
              Manuel
            </button>
          </div>
        )}

        {/* ========== KAMERA-FLOW ========== */}
        {activeTab === "camera" && (
          <>
            {cameraStep === "camera" && <Camera onCapture={handleCapture} />}

            {cameraStep === "preview" && capturedImage && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Tjek billedet inden AI-scanning:</p>
                <img
                  src={capturedImage}
                  alt="Preview"
                  className="w-full max-w-sm mx-auto rounded-xl border-2 border-gray-200 dark:border-gray-600 shadow-lg"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleCameraConfirm}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-xl font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all"
                  >
                    <ScanLine className="w-5 h-5" aria-hidden />
                    Scan med AI
                  </button>
                  <button
                    onClick={handleRetake}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-xl font-semibold
                               hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
                  >
                    <CameraIcon className="w-5 h-5" aria-hidden />
                    Tag igen
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
                <div className="animate-pulse text-lg text-gray-600 dark:text-gray-300">
                  <ScanLine className="w-10 h-10 mx-auto mb-2 text-primary-600 dark:text-primary-400" aria-hidden />
                  <p>Scanner måling med AI...</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Ca. 60-90 sekunder</p>
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

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
                    AI aflæste — ret hvis nødvendigt:
                  </p>

                  <ReadingStepper
                    values={reading}
                    onChange={handleCameraUpdate}
                  />
                </div>

                {/* Kontekst-tags — morgen/aften og arm (valgfri) */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <ContextTagChips
                    timeOfDay={cameraTimeOfDay}
                    arm={cameraArm}
                    onChange={(field, value) =>
                      field === "timeOfDay"
                        ? setCameraTimeOfDay(value as TimeOfDay | null)
                        : setCameraArm(value as Arm | null)
                    }
                  />
                </div>

                {/* Alder — beregnet ud fra fødselsår, eller manuel indtastning som fallback */}
                {derivedAge != null ? (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-20 shrink-0">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Alder</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">ud fra fødselsår</p>
                      </div>
                      <p className="flex-1 text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {derivedAge} år
                      </p>
                      <div className="w-12 shrink-0" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-20 shrink-0">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Alder</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">for bedre vurdering</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={userAge ?? ""}
                        onChange={(e) => setUserAge(e.target.value ? Number(e.target.value) : null)}
                        placeholder="f.eks. 65"
                        className="flex-1 text-center text-2xl font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                                   py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-0
                                   text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">år</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleCameraSave}
                    disabled={isSaving}
                    className="flex-1 bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSaving ? "Gemmer..." : <span className="inline-flex items-center gap-2"><Check className="w-5 h-5" /> Gem måling</span>}
                  </button>
                  <button
                    onClick={handleCameraReset}
                    className="w-14 h-14 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-xl text-lg font-semibold
                               hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all flex items-center justify-center"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
            )}

            {cameraStep === "saved" && (
              <div className="text-center py-12">
                <CircleCheckBig className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Måling gemt!</p>
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
                <XCircle className="w-16 h-16 text-danger-600 mx-auto mb-4" />
                <p className="text-xl font-semibold text-danger-600 dark:text-red-400">Fejl</p>
                <p className="text-gray-600 dark:text-gray-300 mt-2">{errorMsg}</p>
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
                age={derivedAge}
              />
            )}

            {batchStep === "saved" && (
              <div className="text-center py-12">
                <CircleCheckBig className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
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
                <XCircle className="w-16 h-16 text-danger-600 mx-auto mb-4" />
                <p className="text-xl font-semibold text-danger-600 dark:text-red-400">Fejl</p>
                <p className="text-gray-600 dark:text-gray-300 mt-2">{batchErrorMsg}</p>
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

        {/* ========== MANUEL-FLOW ========== */}
        {activeTab === "manual" && (
          <>
            {manualStep === "form" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleManualSave();
                }}
                className="space-y-4"
              >
                {/* Målingsværdier */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mb-3">
                    Indtast målingen manuelt:
                  </p>

                  <ReadingStepper values={manualValues} onChange={handleManualUpdate} />
                </div>

                {/* Kontekst-tags — morgen/aften og arm (valgfri) */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <ContextTagChips
                    timeOfDay={manualTimeOfDay}
                    arm={manualArm}
                    onChange={(field, value) =>
                      field === "timeOfDay"
                        ? setManualTimeOfDay(value as TimeOfDay | null)
                        : setManualArm(value as Arm | null)
                    }
                  />
                </div>

                {/* Alder — beregnet ud fra fødselsår, eller manuel indtastning som fallback */}
                {derivedAge != null ? (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-20 shrink-0">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Alder</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">ud fra fødselsår</p>
                      </div>
                      <p className="flex-1 text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {derivedAge} år
                      </p>
                      <div className="w-12 shrink-0" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-20 shrink-0">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Alder</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">for bedre vurdering</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={userAge ?? ""}
                        onChange={(e) => setUserAge(e.target.value ? Number(e.target.value) : null)}
                        placeholder="f.eks. 65"
                        className="flex-1 text-center text-2xl font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                                   py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-0
                                   text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">år</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tidspunkt for målingen */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Tidspunkt</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">hvornår blev der målt?</span>
                    <input
                      type="datetime-local"
                      value={measuredAt}
                      onChange={(e) => setMeasuredAt(e.target.value)}
                      className="mt-2 w-full text-center text-lg font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                                 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500
                                 text-gray-900 dark:text-gray-100"
                    />
                  </label>
                </div>

                {/* Note — valgfri */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Note</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">valgfri</span>
                    <textarea
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="f.eks. målt efter morgenmotion"
                      className="mt-2 w-full text-base border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl px-3 py-2
                                 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none
                                 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block text-right">
                      {manualNote.length}/500
                    </span>
                  </label>
                </div>

                {/* Inline fejl fra API-validering */}
                {manualError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/60 rounded-xl p-3 flex items-start gap-2">
                    <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-sm text-danger-600 dark:text-red-400 font-medium">{manualError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSavingManual}
                    className="flex-1 bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSavingManual ? "Gemmer..." : <span className="inline-flex items-center gap-2"><Check className="w-5 h-5" /> Gem måling</span>}
                  </button>
                  <button
                    type="button"
                    onClick={handleManualReset}
                    className="w-14 h-14 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-xl text-lg font-semibold
                               hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all flex items-center justify-center"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </form>
            )}

            {manualStep === "saved" && (
              <div className="text-center py-12">
                <CircleCheckBig className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">Måling gemt!</p>
                <div className="mt-6 flex gap-3 justify-center">
                  <button
                    onClick={handleManualReset}
                    className="bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all"
                  >
                    Tilføj ny
                  </button>
                  <Link
                    href="/readings"
                    className="px-8 py-3 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-xl font-semibold inline-block
                               hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
                  >
                    Se målinger
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
