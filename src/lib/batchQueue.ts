// Server-side batch-scan kø (issue: multi-upload robustness).
// Arbejderen henter ét BatchJobItem ad gangen, scanner via Ollama og
// gemmer målingen direkte i databasen. Klienten behøver ikke være
// på Scan-siden — jobbet overlever navigation og server-genstart.
//
// Kørsel: singleton-loop på globalThis (overlever HMR i dev).
// Startes dovent fra API-routes via ensureBatchWorker().

import { prisma } from "@/lib/prisma";
import { readFile } from "fs/promises";
import { join } from "path";
import { scanBloodPressure, checkOllama, type OllamaWaitReason, type OllamaHealth } from "@/lib/ollama";

const SCAN_DIR = join(process.cwd(), "scan-captures");

// Samme tolerance som validation.ts: målinger må ikke dateres langt i fremtiden
const CAPTURED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// Ventetilstand (#60): når Ollama er nede, venter køen i stedet for at fejle.
// Re-check hvert 15. sekund; efter 2 timer opgives resterende billeder.
const WAIT_RECHECK_INTERVAL_MS = 15 * 1000;
const MAX_WAIT_MS = 2 * 60 * 60 * 1000;

export interface BatchWaitState {
  reason: OllamaWaitReason;
  /** Epoch-ms for hvornår denne venteperiode begyndte */
  since: number;
}

const globalForQueue = globalThis as unknown as {
  __batchQueueRunning?: boolean;
  __batchWaitState?: BatchWaitState;
};

function markWaiting(reason: OllamaWaitReason): void {
  const existing = globalForQueue.__batchWaitState;
  if (existing && existing.reason === reason) return;
  console.warn(`Batch queue waiting for Ollama (${reason})`);
  globalForQueue.__batchWaitState = { reason, since: Date.now() };
}

function clearWaitState(): void {
  if (globalForQueue.__batchWaitState) {
    globalForQueue.__batchWaitState = undefined;
    console.log("Batch queue: Ollama is ready again — resuming");
  }
}

/** Aktuel ventetilstand (null når Ollama er klar / køen kører normalt). */
export function getBatchWaitState(): BatchWaitState | null {
  return globalForQueue.__batchWaitState ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Finder næste pending-item (ældste job først), scanner det og gemmer resultatet.
 * Returnerer true hvis der var en item at behandle, false hvis køen er tom.
 */
async function processNextItem(): Promise<boolean> {
  // Crash-recovery: items der sad i "scanning" da serveren døde, prøves igen.
  // Sikkert fordi kun én worker kører ad gangen (guard på globalThis-flagget).
  await prisma.batchJobItem.updateMany({
    where: { status: "scanning" },
    data: { status: "pending" },
  });

  const item = await prisma.batchJobItem.findFirst({
    where: {
      status: "pending",
      job: { status: { not: "cancelled" } },
    },
    orderBy: [{ jobId: "asc" }, { id: "asc" }],
    include: { job: { include: { person: true } } },
  });

  if (!item) return false;

  await prisma.batchJob.update({
    where: { id: item.jobId, status: { not: "cancelled" } },
    data: { status: "processing" },
  }).catch(() => undefined);

  await prisma.batchJobItem.update({
    where: { id: item.id },
    data: { status: "scanning", error: null },
  });

  try {
    const buffer = await readFile(join(SCAN_DIR, item.imagePath));
    const result = await scanBloodPressure(buffer.toString("base64"));

    if ("error" in result) {
      // Midlertidig AI-fejl midt i jobbet (#60): billedet tilbage i køen så
      // venteløkken kan prøve igen når Ollama er klar — ikke et permanent fejl.
      if (result.error === "ollamaOffline" || result.error === "ollamaModelMissing") {
        await prisma.batchJobItem.update({
          where: { id: item.id },
          data: { status: "pending", error: null },
        });
        markWaiting(result.error);
        await sleep(WAIT_RECHECK_INTERVAL_MS);
        return true;
      }

      await prisma.batchJobItem.update({
        where: { id: item.id },
        data: { status: "error", error: result.error },
      });
    } else {
      // Samme alderafledning som klienten: indeværende år - fødselsår
      const currentYear = new Date().getFullYear();
      const age =
        item.job.person.birthYear != null ? currentYear - item.job.person.birthYear : null;

      // EXIF-tidspunkt bruges kun hvis det er gyldigt (ikke langt i fremtiden)
      const capturedAt =
        item.capturedAt &&
        item.capturedAt.getTime() <= Date.now() + CAPTURED_AT_FUTURE_TOLERANCE_MS
          ? item.capturedAt
          : null;

      const reading = await prisma.reading.create({
        data: {
          systolic: result.systolic,
          diastolic: result.diastolic,
          pulse: result.pulse,
          age,
          image: item.imagePath,
          personId: item.job.personId,
          ...(capturedAt ? { createdAt: capturedAt } : {}),
        },
      });

      await prisma.batchJobItem.update({
        where: { id: item.id },
        data: { status: "saved", readingId: reading.id },
      });
    }
  } catch (error) {
    console.error(`Batch item ${item.id} failed:`, error);
    await prisma.batchJobItem
      .update({
        where: { id: item.id },
        data: {
          status: "error",
          error: error instanceof Error ? error.message.slice(0, 200) : "scanFailed",
        },
      })
      .catch(() => undefined);
  }

  // Jobbet er færdigt når ingen items venter længere
  const remaining = await prisma.batchJobItem.count({
    where: { jobId: item.jobId, status: { in: ["pending", "scanning"] } },
  });
  if (remaining === 0) {
    await prisma.batchJob.updateMany({
      where: { id: item.jobId, status: { not: "cancelled" } },
      data: { status: "done" },
    });
  }

  return true;
}

/**
 * Opgiv resterende pending billeder når Ollama har været utilgængelig i
 * MAX_WAIT_MS (#60). Billederne fejler med den stabile årsagskode så UI'et
 * kan vise en forståelig besked, og jobs afsluttes som "done".
 */
async function failRemainingPending(reason: OllamaWaitReason): Promise<void> {
  console.warn(
    `Ollama unavailable for ${MAX_WAIT_MS / 60000} min — giving up on remaining queued images (${reason})`
  );
  const pendingItems = await prisma.batchJobItem.findMany({
    where: { status: "pending", job: { status: { not: "cancelled" } } },
    select: { id: true, jobId: true },
  });
  if (pendingItems.length === 0) return;

  await prisma.batchJobItem.updateMany({
    where: { id: { in: pendingItems.map((i) => i.id) } },
    data: { status: "error", error: reason },
  });

  // Afslut berørte jobs der ikke har flere items at behandle
  const jobIds = Array.from(new Set(pendingItems.map((i) => i.jobId)));
  for (const jobId of jobIds) {
    const remaining = await prisma.batchJobItem.count({
      where: { jobId, status: { in: ["pending", "scanning"] } },
    });
    if (remaining === 0) {
      await prisma.batchJob.updateMany({
        where: { id: jobId, status: { not: "cancelled" } },
        data: { status: "done" },
      });
    }
  }
}

async function runWorker(): Promise<void> {
  try {
    // Cachet sundhedstjek (#60): mens Ollama er nede tjekkes der kun hvert
    // WAIT_RECHECK_INTERVAL_MS i stedet for ved hvert eneste billede.
    let health: OllamaHealth = await checkOllama();
    let lastHealthCheck = Date.now();
    const refreshHealth = async (): Promise<OllamaHealth> => {
      if (Date.now() - lastHealthCheck >= WAIT_RECHECK_INTERVAL_MS) {
        health = await checkOllama();
        lastHealthCheck = Date.now();
      }
      return health;
    };

    for (;;) {
      const current = await refreshHealth();

      if (!current.ready && current.reason) {
        markWaiting(current.reason);

        const waitState = getBatchWaitState();
        if (!waitState || Date.now() - waitState.since >= MAX_WAIT_MS) {
          // To timer uden AI-server: opgiv resterende billeder (#60)
          await failRemainingPending(current.reason);
          clearWaitState();
          break;
        }

        await sleep(WAIT_RECHECK_INTERVAL_MS);
        continue;
      }

      clearWaitState();

      const more = await processNextItem();
      if (!more) break;
    }
  } catch (error) {
    console.error("Batch queue worker crashed:", error);
  } finally {
    globalForQueue.__batchQueueRunning = false;
  }
}

/** Starter arbejderen hvis den ikke allerede kører. */
export function ensureBatchWorker(): void {
  if (globalForQueue.__batchQueueRunning) return;
  globalForQueue.__batchQueueRunning = true;
  void runWorker();
}
