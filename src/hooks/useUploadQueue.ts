"use client";

// Upload-kø-status (#50): poller den valgte persons aktive batch-job hvert
// 2. sekund så en indikator i Navbar kan vise hvor mange billeder der venter
// på scanning — uanset hvilken menu brugeren er i. Køen er pr. person:
// skifter man person, viser pillen den nye persons kø. Selve scanningen
// kører på serveren (src/lib/batchQueue.ts), så polling er rent informativt.

import { useEffect, useState } from "react";
import {
  SELECTED_PERSON_CHANGED_EVENT,
  UPLOAD_QUEUE_CHANGED_EVENT,
  clearActiveBatchJob,
  getActiveBatchJobId,
  getSelectedPersonId,
} from "@/lib/uploadQueue";

export interface UploadQueueStatus {
  /** Alle billeder i det aktive job */
  total: number;
  /** Venter stadig på at blive scannet */
  pending: number;
  /** Scannes lige nu */
  scanning: number;
  /** Scannet og gemt som måling */
  saved: number;
  /** Scanning mislykkedes */
  failed: number;
  /** Køen venter på AI-serveren (#60): "ollamaOffline" | "ollamaModelMissing" | null */
  waitReason: string | null;
}

const POLL_INTERVAL_MS = 2000;

interface QueueResponse {
  status: string;
  items?: { status: string }[];
  waitReason?: string | null;
}

/**
 * Returnerer kø-status for den valgte persons aktive batch-job — eller null
 * når den person ikke har et kørende job. Personskift og nye jobs opfanges
 * med det samme via events, og senest to sekunder efter af selve poll-ticken.
 */
export function useUploadQueue(): UploadQueueStatus | null {
  const [status, setStatus] = useState<UploadQueueStatus | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Sidst sete job pr. seneste tick — bruges til at genstarte overvågning
    // når der startes et nyt job (også for samme person)
    let lastJobId: string | null = null;
    // Færdigt job: hold nøglen (Scan-siden viser resultaterne) men stop
    // pillens polling, indtil der startes et nyt job
    let finished = false;

    const countStatuses = (items: { status: string }[]): Omit<UploadQueueStatus, "waitReason"> => ({
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      scanning: items.filter((i) => i.status === "scanning").length,
      saved: items.filter((i) => i.status === "saved").length,
      failed: items.filter((i) => i.status === "error").length,
    });

    const tick = async () => {
      const personId = getSelectedPersonId();
      const jobId = personId ? getActiveBatchJobId(personId) : null;

      // Nyt job (eller ryddet) — nulstil "færdig"-mærket
      if (jobId !== lastJobId) {
        lastJobId = jobId;
        finished = false;
      }

      if (!jobId || finished) {
        setStatus(null);
      } else {
        try {
          const res = await fetch(`/api/batch-jobs/${jobId}`);

          // Ignorer svar der lander efter en personskift
          if (!stopped && getSelectedPersonId() === personId) {
            if (res.status === 404) {
              // Jobbet findes ikke længere — ryd op som Scan-siden gør ved genbesøg
              clearActiveBatchJob(personId);
              setStatus(null);
            } else if (res.ok) {
              const data: QueueResponse = await res.json();
              if (Array.isArray(data.items)) {
                setStatus({
                  ...countStatuses(data.items),
                  waitReason:
                    data.status === "pending" || data.status === "processing"
                      ? data.waitReason ?? null
                      : null,
                });
              }

              if (data.status !== "pending" && data.status !== "processing") {
                finished = true;
                setStatus(null);
              }
            }
          }
        } catch {
          // Midlertidige netværksfejl ignoreres — næste tick prøver igen
        }
      }

      if (!stopped) timer = setTimeout(() => void tick(), POLL_INTERVAL_MS);
    };

    // Events fra Scan-siden og persons-skift udløser en ekstra tick med det samme
    const wake = () => {
      clearTimeout(timer);
      void tick();
    };
    window.addEventListener(UPLOAD_QUEUE_CHANGED_EVENT, wake);
    window.addEventListener(SELECTED_PERSON_CHANGED_EVENT, wake);

    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener(UPLOAD_QUEUE_CHANGED_EVENT, wake);
      window.removeEventListener(SELECTED_PERSON_CHANGED_EVENT, wake);
    };
  }, []);

  return status;
}
