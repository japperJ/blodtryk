import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateReadingInput } from "@/lib/validation";
import { unlink } from "fs/promises";
import { join } from "path";

// GET single reading
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const reading = await prisma.reading.findUnique({ where: { id: Number(params.id) } });
  if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(reading);
}

// DELETE reading
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);

    // Hent målingen først så vi kender billedfilnavnet til oprydning
    const reading = await prisma.reading.findUnique({ where: { id } });
    if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.reading.delete({ where: { id } });

    // Ryd billedfilen op på disken — kun hvis det er et rent filnavn
    // (data-URLs/http-URLs findes ikke som filer). Manglende fil ignoreres,
    // da målingen allerede er slettet.
    const image = reading.image;
    if (image && !image.startsWith("data:") && !image.startsWith("http") && /^[\w\-\.]+$/.test(image)) {
      try {
        await unlink(join(process.cwd(), "scan-captures", image));
      } catch {
        // Filen findes ikke eller kan ikke slettes — målingen er stadig slettet
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// PATCH update reading — delvise opdateringer af systolisk/diastolisk/puls/note.
// Felter der udelades beholdes uændret; valideringen kører på det sammensatte
// (fulde) payload ligesom POST, så ugyldige værdier afvises med de samme
// danske fejlbeskeder.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Ugyldigt JSON-format" }, { status: 400 });
    }

    const id = Number(params.id);
    const existing = await prisma.reading.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Flet patch ind over de gemte værdier (null/undefined = ikke sendt)
    const raw =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    const merged = {
      personId: existing.personId,
      systolic: raw.systolic ?? existing.systolic,
      diastolic: raw.diastolic ?? existing.diastolic,
      pulse: raw.pulse ?? existing.pulse,
      note: raw.note !== undefined ? raw.note : existing.note,
      // Tags kan opdateres OG ryddes (null), men beholdes hvis feltet udelades
      timeOfDay: raw.timeOfDay !== undefined ? raw.timeOfDay : existing.timeOfDay,
      arm: raw.arm !== undefined ? raw.arm : existing.arm,
    };

    // Samme validering som POST — nonsense-værdier giver 400 med dansk fejlbesked
    const validation = validateReadingInput(merged);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Tom/blank note gemmes som null (noten er ryddet)
    const note =
      validation.data.note && validation.data.note.trim() !== "" ? validation.data.note : null;

    const reading = await prisma.reading.update({
      where: { id },
      data: {
        systolic: validation.data.systolic,
        diastolic: validation.data.diastolic,
        pulse: validation.data.pulse,
        note,
        // Kun rør ved tags hvis de var med i anmodningen (kan sættes eller ryddes)
        ...(raw.timeOfDay !== undefined ? { timeOfDay: validation.data.timeOfDay } : {}),
        ...(raw.arm !== undefined ? { arm: validation.data.arm } : {}),
      },
    });

    return NextResponse.json(reading);
  } catch (error) {
    console.error("Update reading error:", error);
    return NextResponse.json({ error: "Kunne ikke opdatere måling" }, { status: 500 });
  }
}
