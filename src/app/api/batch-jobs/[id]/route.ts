import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureBatchWorker, getBatchWaitState } from "@/lib/batchQueue";

/**
 * GET /api/batch-jobs/[id]
 * Poll-endpoint til fremskridts-UI. Returnerer jobstatus og hvert items
 * tilstand. Klienten kan navigere væk imens — jobbet fortsætter på serveren.
 * Kaldes også ved genbesøg af Scan-siden (jobId gemmes i sessionStorage).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const job = await prisma.batchJob.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { id: "asc" },
        include: {
          reading: {
            select: { id: true, systolic: true, diastolic: true, pulse: true },
          },
        },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: "batchJobNotFound" }, { status: 404 });
  }

  // Ventetilstand (#60): jobstatus "processing" kan betyde at arbejderen venter
  // på Ollama — så klienten kan vise en forståelig besked i stedet for at tro
  // at der scannes.
  const wait = getBatchWaitState();

  return NextResponse.json({
    id: job.id,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
    waitReason: wait?.reason ?? null,
    waitingSince: wait ? new Date(wait.since).toISOString() : null,
    items: job.items.map((item) => ({
      id: item.id,
      imagePath: item.imagePath,
      capturedAt: item.capturedAt ? item.capturedAt.toISOString() : null,
      status: item.status,
      error: item.error,
      clientRef: item.clientRef,
      reading: item.reading ? {
        id: item.reading.id,
        systolic: item.reading.systolic,
        diastolic: item.reading.diastolic,
        pulse: item.reading.pulse,
      } : null,
    })),
  });
}

/**
 * DELETE /api/batch-jobs/[id]
 * Annullerer jobbet: arbejderen springer resterende pending-items over
 * (den filtrerer allerede på job.status != cancelled). Allerede gemte
 * målinger forbliver i databasen.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const job = await prisma.batchJob.updateMany({
    where: { id, status: { in: ["pending", "processing"] } },
    data: { status: "cancelled" },
  });

  if (job.count === 0) {
    const exists = await prisma.batchJob.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return NextResponse.json({ error: "batchJobNotFound" }, { status: 404 });
    }
  }

  // Sørg for at arbejderen vågner og registrerer annulleringen
  ensureBatchWorker();

  return NextResponse.json({ ok: true });
}
