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
import { scanBloodPressure } from "@/lib/ollama";

const SCAN_DIR = join(process.cwd(), "scan-captures");

// Samme tolerance som validation.ts: målinger må ikke dateres langt i fremtiden
const CAPTURED_AT_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const globalForQueue = globalThis as unknown as {
  __batchQueueRunning?: boolean;
};

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

async function runWorker(): Promise<void> {
  try {
    let more = true;
    while (more) {
      more = await processNextItem();
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
