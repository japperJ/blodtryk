import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  validateReadingInput,
  validateBirthYear,
  CREATED_AT_FUTURE_TOLERANCE_MS,
} from "@/lib/validation";

// PATCH /api/batch-jobs/[id]/items/[itemId]/manual
// Save manual entry for a batch job item — either one the AI gave up on
// ("error") or one that is still queued ("pending"), e.g. while Ollama is
// offline and the batch is waiting for the AI.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id, itemId } = await params;

    if (!id || !itemId) {
      return NextResponse.json({ error: "missingParams" }, { status: 400 });
    }

    // Find the batch job item — the itemId may be a numeric database ID
    // or a clientRef string (e.g. "upload-1787808902712-0").
    const numericId = parseInt(itemId, 10);
    let item;

    if (!Number.isNaN(numericId)) {
      // Look up by primary key, then verify it belongs to this job
      item = await prisma.batchJobItem.findUnique({
        where: { id: numericId },
        include: { job: { include: { person: true } } },
      });
      if (item && item.jobId !== id) {
        item = null; // belongs to a different job
      }
    } else {
      // Look up by clientRef scoped to this job
      item = await prisma.batchJobItem.findFirst({
        where: { jobId: id, clientRef: itemId },
        include: { job: { include: { person: true } } },
      });
    }

    if (!item) {
      return NextResponse.json({ error: "batchJobItemNotFound" }, { status: 404 });
    }

    if (item.status === "saved") {
      return NextResponse.json({ error: "itemAlreadySaved" }, { status: 409 });
    }
    if (item.status === "scanning") {
      return NextResponse.json({ error: "itemBusy" }, { status: 409 });
    }
    if (item.status !== "pending" && item.status !== "error") {
      return NextResponse.json({ error: "itemNotScannable" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalidJson" }, { status: 400 });
    }

    const rawBody = body as Record<string, unknown>;

    // Build validated reading input using existing validation
    // We need personId from the job
    const personId = item.job.personId;

    // Calculate age from birthYear (same logic as batch worker)
    const currentYear = new Date().getFullYear();
    const age =
      item.job.person.birthYear != null ? currentYear - item.job.person.birthYear : null;

    // Samme tolerance som arbejderen: et EXIF-tidspunkt langt ude i fremtiden
    // (forkert kameraur) må ikke blokere en manuel indtastning — brug da
    // serverens tid i stedet.
    const capturedAt = item.capturedAt ? new Date(item.capturedAt) : null;
    const createdAtInput =
      capturedAt && capturedAt.getTime() <= Date.now() + CREATED_AT_FUTURE_TOLERANCE_MS
        ? capturedAt.toISOString()
        : null;

    // Prepare data for validation
    const validationData = {
      systolic: rawBody.systolic,
      diastolic: rawBody.diastolic,
      pulse: rawBody.pulse,
      age,
      note: rawBody.note ?? null,
      image: item.imagePath,
      timeOfDay: rawBody.timeOfDay ?? null,
      arm: rawBody.arm ?? null,
      personId,
      createdAt: createdAtInput,
    };

    const validation = validateReadingInput(validationData);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { systolic, diastolic, pulse, note, timeOfDay, arm, createdAt } = validation.data;

    // Overtag billedet atomisk, så arbejderen ikke scanner det samtidig.
    const claim = await prisma.batchJobItem.updateMany({
      where: { id: item.id, status: item.status },
      data: { status: "scanning", error: null },
    });
    if (claim.count === 0) {
      return NextResponse.json({ error: "itemBusy" }, { status: 409 });
    }

    // Create the reading
    let reading;
    try {
      reading = await prisma.reading.create({
        data: {
          systolic,
          diastolic,
          pulse,
          age,
          note,
          image: item.imagePath,
          timeOfDay,
          arm,
          personId,
          ...(createdAt ? { createdAt } : {}),
        },
      });
    } catch (error) {
      // Kunne målingen ikke gemmes, gives billedet tilbage til sin gamle
      // tilstand, så det ikke hænger fast i "scanning".
      await prisma.batchJobItem
        .updateMany({
          where: { id: item.id, status: "scanning" },
          data: { status: item.status, error: item.error },
        })
        .catch(() => undefined);
      throw error;
    }

    // Update batch job item with manual entry and mark as saved
    await prisma.batchJobItem.update({
      where: { id: item.id },
      data: {
        status: "saved",
        readingId: reading.id,
        manualSystolic: systolic,
        manualDiastolic: diastolic,
        manualPulse: pulse,
        manualTimeOfDay: timeOfDay,
        manualArm: arm,
        manualNote: note,
        error: null,
      },
    });

    // Check if job is complete
    const remaining = await prisma.batchJobItem.count({
      where: { jobId: id, status: { in: ["pending", "scanning", "error"] } },
    });

    if (remaining === 0) {
      await prisma.batchJob.updateMany({
        where: { id, status: { not: "cancelled" } },
        data: { status: "done" },
      });
    }

    return NextResponse.json({ reading });
  } catch (error) {
    console.error("Manual batch entry error:", error);
    return NextResponse.json({ error: "manualEntryFailed" }, { status: 500 });
  }
}