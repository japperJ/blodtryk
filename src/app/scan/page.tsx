"use client";
import { useState, useCallback, useEffect } from "react";
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
import BatchProgress, { type BatchItemView, type ScanResult } from "@/components/BatchProgress";
import BatchTimeline from "@/components/BatchTimeline";
import ContextTagChips from "@/components/ContextTagChips";
import EmptyState from "@/components/EmptyState";
import type { BloodPressureReading, PersonSummary, TimeOfDay, Arm } from "@/types";
import Link from "next/link";
import { useI18n } from "@/lib/I18nProvider";
import { INTL_LOCALE } from "@/lib/i18n";

// sessionStorage-nøgle så et igangværende batch-job kan genoptages efter navigation
const ACTIVE_BATCH_JOB_KEY = "activeBatchJobId";

// Ét items tilstand fra GET /api/batch-jobs/[id]
interface BatchJobItemStatus {
  id: number;
  clientRef: string | null;
  imagePath: string;
  capturedAt: string | null;
  status: string;
  error: string | null;
  reading?: { systolic: number; diastolic: number; pulse: number } | null;
}

// Kamera-flow steps
type CameraStep = "camera" | "preview" | "scanning" | "confirm" | "saved" | "error";

// Batch-flow steps ("saved" findes ikke længere — serveren gemer automatisk)
type BatchStep = "upload" | "scanning" | "results" | "error";

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
  const { t, tError, locale } = useI18n();
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
        throw new Error(data.error || "scanFailed");
      }

      setReading(data.reading);
      setCameraStep("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "unknown");
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
      setErrorMsg("readingSaveFailed");
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
  const [batchItems, setBatchItems] = useState<BatchItemView[]>([]);
  const [batchResults, setBatchResults] = useState<ScanResult[]>([]);
  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [batchErrorMsg, setBatchErrorMsg] = useState("");

  // Bygger letvægts-visninger ud fra de valgte billeder (thumbnail + EXIF-tid
  // er allerede beregnet i BatchUpload)
  const buildItemViews = useCallback((images: UploadImage[]): BatchItemView[] => {
    return images.map((img) => ({
      id: img.id,
      thumbnail: img.thumbnail || null,
      displayTime: img.displayTime,
      exifModel: img.exif.model || undefined,
    }));
  }, []);

  // Sender alle billeder til serveren i ÉN request. Serveren lægger dem i en
  // kø i databasen og scanner sekventielt, så navigation væk fra siden ikke
  // afbryder jobbet. Klienten holder kun styr på jobId'et.
  const startBatchScan = useCallback(async (images: UploadImage[]) => {
    setBatchStep("scanning");
    try {
      const res = await fetch("/api/batch-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId: selectedPerson?.id,
          items: images.map((img) => ({
            clientRef: img.id,
            base64: img.compressedBase64,
            ...(img.exif.dateOriginal
              ? { capturedAt: img.exif.dateOriginal.toISOString() }
              : {}),
          })),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.jobId) {
        throw new Error(typeof data?.error === "string" ? data.error : "scanFailed");
      }

      // Gem jobId så brugeren kan vende tilbage til et kørende job efter
      // navigation eller genindlæsning af siden
      sessionStorage.setItem(ACTIVE_BATCH_JOB_KEY, data.jobId);
      setBatchJobId(data.jobId);
    } catch (err) {
      setBatchErrorMsg(err instanceof Error && err.message ? err.message : "scanFailed");
      setBatchStep("error");
    }
  }, [selectedPerson?.id]);

  const handleImagesReady = useCallback(
    (images: UploadImage[]) => {
      setBatchImages(images);
      setBatchItems(buildItemViews(images));
      setBatchResults([]);
      void startBatchScan(images);
    },
    [buildItemViews, startBatchScan]
  );

  // Poller jobstatus hvert 2. sekund mens serveren scanner. Kun færdige items
  // (saved/error) mappes ind i resultaterne, så fremskridtstælleren ikke
  // tæller billeder der stadig venter i køen med.
  useEffect(() => {
    if (!batchJobId || batchStep !== "scanning") return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/batch-jobs/${batchJobId}`);
        if (!res.ok) throw new Error("batchJobNotFound");
        const data: { status: string; items?: BatchJobItemStatus[] } = await res.json();

        if (cancelled || !Array.isArray(data.items)) return;

        const finished = data.items.filter(
          (item) => item.status === "saved" || item.status === "error"
        );
        setBatchResults(
          finished.map((item) => ({
            imageId: item.clientRef ?? `srv-${item.id}`,
            reading: item.reading ?? null,
            error: item.status === "error" ? item.error || "scanFailed" : null,
            timestamp: item.capturedAt ? new Date(item.capturedAt) : null,
          }))
        );

        if (data.status === "done" || data.status === "cancelled") {
          sessionStorage.removeItem(ACTIVE_BATCH_JOB_KEY);
          setBatchJobId(null);
          setBatchItems((prev) =>
            prev.length > 0
              ? prev
              : data.items!.map((item) => ({
                  id: item.clientRef ?? `srv-${item.id}`,
                  thumbnail: `/api/image/${encodeURIComponent(item.imagePath)}`,
                  displayTime: item.capturedAt
                    ? new Date(item.capturedAt).toLocaleString(INTL_LOCALE[locale])
                    : "",
                }))
          );
          setBatchStep("results");
        }
      } catch {
        // Midlertidige netværksfejl ignoreres — næste poll prøver igen
      }
    };

    void poll();
    const interval = setInterval(() => void poll(), 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // locale bruges kun hvis thumbnails skal genopbygges efter navigation
  }, [batchJobId, batchStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // Genoptager et kørende job ved genbesøg af siden. Jobbet selv lever på
  // serveren og er upåvirket af navigation — her hentes blot status igen.
  useEffect(() => {
    const savedJobId = sessionStorage.getItem(ACTIVE_BATCH_JOB_KEY);
    if (!savedJobId) return;

    let cancelled = false;

    const resume = async () => {
      try {
        const res = await fetch(`/api/batch-jobs/${savedJobId}`);
        if (!res.ok) throw new Error("batchJobNotFound");
        const data: { status: string; items?: BatchJobItemStatus[] } = await res.json();

        if (cancelled || !Array.isArray(data.items)) return;

        // Genopbyg visninger fra serverens items — thumbnails hentes via det
        // eksisterende sikre /api/image-endpoint
        const views: BatchItemView[] = data.items.map((item) => ({
          id: item.clientRef ?? `srv-${item.id}`,
          thumbnail: `/api/image/${encodeURIComponent(item.imagePath)}`,
          displayTime: item.capturedAt
            ? new Date(item.capturedAt).toLocaleString(INTL_LOCALE[locale])
            : "",
        }));

        const finished = data.items.filter(
          (item) => item.status === "saved" || item.status === "error"
        );
        setBatchResults(
          finished.map((item) => ({
            imageId: item.clientRef ?? `srv-${item.id}`,
            reading: item.reading ?? null,
            error: item.status === "error" ? item.error || "scanFailed" : null,
            timestamp: item.capturedAt ? new Date(item.capturedAt) : null,
          }))
        );

        setBatchItems(views);

        if (data.status === "pending" || data.status === "processing") {
          setBatchJobId(savedJobId);
          setBatchStep("scanning");
        } else {
          sessionStorage.removeItem(ACTIVE_BATCH_JOB_KEY);
          setBatchStep("results");
        }
      } catch {
        sessionStorage.removeItem(ACTIVE_BATCH_JOB_KEY);
      }
    };

    void resume();
    return () => {
      cancelled = true;
    };
    // Bevidst kun ved mount — locale er stabil under et sidebesøg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelBatch = async () => {
    if (!batchJobId) {
      setBatchStep("results");
      return;
    }

    try {
      await fetch(`/api/batch-jobs/${batchJobId}`, { method: "DELETE" });
      // Polling opdager status "cancelled" og skifter selv til resultaterne
    } catch {
      setBatchStep("results");
    }
  };

  // Prøv mislykkede billeder igen — kun muligt så længe de komprimerede
  // billeder stadig ligger i browserhukommelsen (samme sidebesøg)
  const canRetryFailed =
    batchResults.some((r) => r.error !== null) &&
    batchResults
      .filter((r) => r.error !== null)
      .every((r) => batchImages.some((img) => img.id === r.imageId));

  const handleRetryFailed = async () => {
    const failedImages = batchImages.filter((img) =>
      batchResults.some((r) => r.imageId === img.id && r.error !== null)
    );
    if (failedImages.length === 0 || !batchJobId) return;

    setBatchResults([]);
    await startBatchScan(failedImages);
  };

  const handleBatchReset = () => {
    setBatchStep("upload");
    setBatchImages([]);
    setBatchItems([]);
    setBatchResults([]);
    setBatchJobId(null);
    setBatchErrorMsg("");
    sessionStorage.removeItem(ACTIVE_BATCH_JOB_KEY);
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
        setManualError(data?.error || "readingSaveFailed");
        return;
      }

      setManualStep("saved");
    } catch {
      setManualError("readingSaveFailed");
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
            title={t("scan.choosePersonTitle")}
            description={t("scan.choosePersonDesc")}
            action={
              <Link
                href="/persons"
                className="inline-block bg-primary-600 text-white px-6 py-3 rounded-xl font-semibold
                           hover:bg-primary-700 active:scale-95 transition-all"
              >
                {t("scan.goToPersons")}
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
            {t("scan.title")}
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
              {t("scan.tabCamera")}
            </button>
            <button
              onClick={() => setActiveTab("batch")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all
                         ${activeTab === "batch"
                           ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                           : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <FolderOpen className="w-4 h-4" aria-hidden />
              {t("scan.tabUpload")}
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all
                         ${activeTab === "manual"
                           ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
                           : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
            >
              <Keyboard className="w-4 h-4" aria-hidden />
              {t("scan.tabManual")}
            </button>
          </div>
        )}

        {/* ========== KAMERA-FLOW ========== */}
        {activeTab === "camera" && (
          <>
            {cameraStep === "camera" && <Camera onCapture={handleCapture} />}

            {cameraStep === "preview" && capturedImage && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{t("scan.reviewPrompt")}</p>
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
                    {t("scan.scanWithAi")}
                  </button>
                  <button
                    onClick={handleRetake}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-xl font-semibold
                               hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
                  >
                    <CameraIcon className="w-5 h-5" aria-hidden />
                    {t("scan.retake")}
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
                  <p>{t("scan.scanning")}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{t("scan.estimatedTime")}</p>
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
                    {t("scan.aiReadTitle")}
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
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t("scan.ageLabel")}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{t("scan.ageFromBirthYear")}</p>
                      </div>
                      <p className="flex-1 text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {derivedAge} {t("scan.yearsUnit")}
                      </p>
                      <div className="w-12 shrink-0" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-20 shrink-0">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t("scan.ageLabel")}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{t("scan.ageForBetter")}</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={userAge ?? ""}
                        onChange={(e) => setUserAge(e.target.value ? Number(e.target.value) : null)}
                        placeholder={t("scan.agePlaceholder")}
                        className="flex-1 text-center text-2xl font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                                   py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-0
                                   text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t("scan.yearsUnit")}</p>
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
                    {isSaving ? t("common.saving") : <span className="inline-flex items-center gap-2"><Check className="w-5 h-5" /> {t("scan.saveReading")}</span>}
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
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("scan.saved")}</p>
                <button
                  onClick={handleCameraReset}
                  className="mt-6 bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  {t("scan.takeNew")}
                </button>
              </div>
            )}

            {cameraStep === "error" && (
              <div className="text-center py-12">
                <XCircle className="w-16 h-16 text-danger-600 mx-auto mb-4" />
                <p className="text-xl font-semibold text-danger-600 dark:text-red-400">{t("common.error")}</p>
                <p className="text-gray-600 dark:text-gray-300 mt-2">{tError(errorMsg)}</p>
                <button
                  onClick={handleCameraReset}
                  className="mt-6 bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  {t("common.retry")}
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
                items={batchItems}
                results={batchResults}
                isComplete={false}
                onCancel={handleCancelBatch}
              />
            )}

            {batchStep === "results" && (
              <BatchTimeline
                items={batchItems}
                results={batchResults}
                onReset={handleBatchReset}
                age={derivedAge}
                onRetryFailed={canRetryFailed ? handleRetryFailed : undefined}
              />
            )}

            {batchStep === "error" && (
              <div className="text-center py-12">
                <XCircle className="w-16 h-16 text-danger-600 mx-auto mb-4" />
                <p className="text-xl font-semibold text-danger-600 dark:text-red-400">{t("common.error")}</p>
                <p className="text-gray-600 dark:text-gray-300 mt-2">{tError(batchErrorMsg)}</p>
                <button
                  onClick={handleBatchReset}
                  className="mt-6 bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                             hover:bg-primary-700 active:scale-95 transition-all"
                >
                  {t("common.retry")}
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
                    {t("scan.manualPrompt")}
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
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t("scan.ageLabel")}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{t("scan.ageFromBirthYear")}</p>
                      </div>
                      <p className="flex-1 text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {derivedAge} {t("scan.yearsUnit")}
                      </p>
                      <div className="w-12 shrink-0" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-20 shrink-0">
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{t("scan.ageLabel")}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">{t("scan.ageForBetter")}</p>
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={userAge ?? ""}
                        onChange={(e) => setUserAge(e.target.value ? Number(e.target.value) : null)}
                        placeholder={t("scan.agePlaceholder")}
                        className="flex-1 text-center text-2xl font-bold border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl
                                   py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-0
                                   text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <div className="w-12 shrink-0 text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t("scan.yearsUnit")}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tidspunkt for målingen */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t("scan.whenLabel")}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">{t("scan.whenHint")}</span>
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
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t("scan.noteLabel")}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block">{t("scan.noteOptional")}</span>
                    <textarea
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder={t("scan.noteExample")}
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
                    <p className="text-sm text-danger-600 dark:text-red-400 font-medium">{tError(manualError)}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSavingManual}
                    className="flex-1 bg-primary-600 text-white py-4 rounded-xl text-lg font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSavingManual ? t("common.saving") : <span className="inline-flex items-center gap-2"><Check className="w-5 h-5" /> {t("scan.saveReading")}</span>}
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
                <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t("scan.saved")}</p>
                <div className="mt-6 flex gap-3 justify-center">
                  <button
                    onClick={handleManualReset}
                    className="bg-primary-600 text-white px-8 py-3 rounded-xl font-semibold
                               hover:bg-primary-700 active:scale-95 transition-all"
                  >
                    {t("scan.addNew")}
                  </button>
                  <Link
                    href="/readings"
                    className="px-8 py-3 bg-gray-200 dark:bg-gray-700 dark:text-gray-100 rounded-xl font-semibold inline-block
                               hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-95 transition-all"
                  >
                    {t("scan.viewReadings")}
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
