import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureBatchWorker } from "@/lib/batchQueue";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID, createHash } from "crypto";

// Sikkerhedsgrænse: hvor mange billeder et enkelt batch-job må indeholde
const MAX_ITEMS_PER_JOB = 50;
// Minimum base64-størrelse — mindre billeder er næsten sikkert ubrugelige til OCR
const MIN_BASE64_LENGTH = 100;

interface IncomingItem {
  base64?: unknown;
  capturedAt?: unknown;
  clientRef?: unknown;
}

/**
 * POST /api/batch-jobs
 * Modtager alle komprimerede billeder i ÉN request og lægger dem i
 * en server-side kø. Svarer straks med jobId — scanningen foregår
 * bagefter i baggrunden (src/lib/batchQueue.ts), så klienten frit kan
 * navigere væk fra Scan-siden.
 *
 * Body: { personId: number, items: [{ base64: string, capturedAt?: string }] }
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalidJson" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "invalidRequestFormat" }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;

    const personId = raw.personId;
    if (typeof personId !== "number" || !Number.isInteger(personId) || personId < 1) {
      return NextResponse.json({ error: "personIdRequired" }, { status: 400 });
    }

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) {
      return NextResponse.json({ error: "personNotFound" }, { status: 400 });
    }

    const rawItems = raw.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: "noImagesProvided" }, { status: 400 });
    }

    const seenHashes = new Set<string>();
    const candidateHashes: string[] = [];
    const items: Array<{ entry: IncomingItem; imageHash: string }> = [];
    for (const entry of rawItems as IncomingItem[]) {
      if (typeof entry?.base64 !== "string") continue;

      const base64 = entry.base64.replace(/\s/g, "");
      if (base64.length < MIN_BASE64_LENGTH) continue;

      const imageHash = createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");
      if (seenHashes.has(imageHash)) continue;
      seenHashes.add(imageHash);
      candidateHashes.push(imageHash);
      items.push({ entry, imageHash });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: "noImagesProvided" }, { status: 400 });
    }

    const existingHashes = await prisma.batchJobItem.findMany({
      where: {
        imageHash: { in: candidateHashes },
        job: { personId },
      },
      select: { imageHash: true },
    });
    const existingHashSet = new Set(
      existingHashes.map((row) => row.imageHash).filter((hash): hash is string => Boolean(hash))
    );

    const uniqueItems = items.filter(({ imageHash }) => !existingHashSet.has(imageHash));
    if (uniqueItems.length === 0) {
      return NextResponse.json({ error: "duplicateImageDetected" }, { status: 409 });
    }
    if (uniqueItems.length > MAX_ITEMS_PER_JOB) {
      return NextResponse.json({ error: "tooManyImages" }, { status: 400 });
    }

    // Gem hvert billede på disken (samme mappe som /api/scan og readings-billeder)
    const scanDir = join(process.cwd(), "scan-captures");
    await mkdir(scanDir, { recursive: true });

    const itemRows: {
      imagePath: string;
      imageHash: string;
      capturedAt: Date | null;
      clientRef: string | null;
    }[] = [];
    for (const { entry, imageHash } of uniqueItems) {
      if (typeof entry?.base64 !== "string") continue;

      const base64 = entry.base64.replace(/\s/g, "");
      if (base64.length < MIN_BASE64_LENGTH) continue;

      // Valgfrit EXIF-tidspunkt som ISO-streng
      let capturedAt: Date | null = null;
      if (typeof entry.capturedAt === "string" && entry.capturedAt.trim() !== "") {
        const parsed = new Date(entry.capturedAt);
        if (!isNaN(parsed.getTime())) capturedAt = parsed;
      }

      // Valgfrit klient-id så GET kan matche thumbnails i UI'et
      const clientRef =
        typeof entry.clientRef === "string" && entry.clientRef.trim() !== ""
          ? entry.clientRef.slice(0, 100)
          : null;

      const filename = `${randomUUID()}.jpg`;
      await writeFile(join(scanDir, filename), Buffer.from(base64, "base64"));
      itemRows.push({ imagePath: filename, imageHash, capturedAt, clientRef });
    }

    if (itemRows.length === 0) {
      return NextResponse.json({ error: "noImagesProvided" }, { status: 400 });
    }

    const job = await prisma.batchJob.create({
      data: {
        personId,
        items: { create: itemRows },
      },
    });

    // Kick arbejderen i gang — svarer alligevel straks til klienten
    ensureBatchWorker();

    return NextResponse.json(
      { jobId: job.id, itemCount: itemRows.length },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create batch job error:", error);
    return NextResponse.json({ error: "batchJobFailed" }, { status: 500 });
  }
}
