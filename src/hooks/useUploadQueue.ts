"use client";

// Upload-kø-status (#50): poller det aktive batch-job hvert 2. sekund så en
// indikator i Navbar kan vise hvor mange billeder der venter på scanning —
// uanset hvilken menu brugeren er i. Selve scanningen kører på serveren
// (src/lib/batchQueue.ts), så polling er rent informativt.

import { useEffect, useState } from "react";
import {
  UPLOAD_QUEUE_CHANGED_EVENT,
  clearActiveBatchJob,
  getActiveBatchJobId,
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
}

const POLL_INTERVAL_MS = 2000;

interface QueueResponse {
  status: string;
  items?: { status: string }[];
}

/**
 * Returnerer kø-status for det aktive batch-job i denne fane — eller null
 * når intet job kører (eller det netop er afsluttet). Genlæser sessionStorage
 * ved navigation og ved "upload-queue-changed"-events fra Scan-siden.
 */
export function useUploadQueue(): UploadQueueStatus | null {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadQueueStatus | null>(null);

  // Følg det aktive jobId — ved mount, navigation og events fra Scan-siden
  useEffect(() => {
    const sync = () => setJobId(getActiveBatchJobId());
    sync();
    window.addEventListener(UPLOAD_QUEUE_CHANGED_EVENT, sync);
    return () => window.removeEventListener(UPLOAD_QUEUE_CHANGED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!jobId) {
      setStatus(null);
      return;
    }

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const countStatuses = (items: { status: string }[]): UploadQueueStatus => ({
      total: items.length,
      pending: items.filter((i) => i.status === "pending").length,
      scanning: items.filter((i) => i.status === "scanning").length,
      saved: items.filter((i) => i.status === "saved").length,
      failed: items.filter((i) => i.status === "error").length,
    });

    const poll = async () => {
      try {
        const res = await fetch(`/api/batch-jobs/${jobId}`);

        if (res.status === 404) {
          // Jobbet findes ikke længere — ryd op som Scan-siden gør ved genbesøg
          clearActiveBatchJob();
          if (!stopped) {
            setJobId(null);
            setStatus(null);
          }
          return;
        }

        if (res.ok) {
          const data: QueueResponse = await res.json();
          if (!stopped && Array.isArray(data.items)) {
            setStatus(countStatuses(data.items));
          }

          // Jobbet er færdigt eller annulleret — stop indikatoren her, men lad
          // sessionStorage-nøglen stå så genbesøg af Scan-siden stadig viser
          // resultaterne (samme adfærd som før #50).
          if (data.status !== "pending" && data.status !== "processing") {
            return;
          }
        }
      } catch {
        // Midlertidige netværksfejl ignoreres — næste poll prøver igen
      }

      if (!stopped) timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  return status;
}
