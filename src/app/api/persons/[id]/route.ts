import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBirthYear } from "@/lib/validation";
import { unlink } from "fs/promises";
import { join } from "path";

// Billeder gemmes som rene filnavne i scan-captures/ — data-URLs og
// http-URLs findes ikke som filer og skal ikke røres.
function isStoredImageName(value: string | null): value is string {
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("http")) return false;
  // Placeholder-filer for dubletter (fx "duplicate-<uuid>.skip") findes ikke på disken
  if (value.endsWith(".skip")) return false;
  return /^[\w\-\.]+$/.test(value);
}

// Sletter billedfilerne på disken, men kun dem der ikke længere bruges af en
// anden måling eller batch-item (delt filnavn må ikke ødelægge andres data).
// Manglende filer ignoreres — databasen er allerede opdateret.
async function deleteImageFiles(filenames: string[]): Promise<void> {
  if (filenames.length === 0) return;

  const [readings, items] = await Promise.all([
    prisma.reading.findMany({
      where: { image: { in: filenames } },
      select: { image: true },
    }),
    prisma.batchJobItem.findMany({
      where: { imagePath: { in: filenames } },
      select: { imagePath: true },
    }),
  ]);
  const stillInUse = new Set<string>([
    ...readings.map((r) => r.image as string),
    ...items.map((i) => i.imagePath),
  ]);

  for (const filename of filenames) {
    if (stillInUse.has(filename)) continue;
    try {
      await unlink(join(process.cwd(), "scan-captures", filename));
    } catch {
      // Filen findes ikke eller kan ikke slettes — personen er stadig slettet
    }
  }
}

// PATCH update person — navn og/eller fødselsår
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "invalidId" }, { status: 400 });
    }

    const body = await request.json();
    const hasName = "name" in body;
    const hasBirthYear = "birthYear" in body;

    // Mindst ét felt skal være med i anmodningen
    if (!hasName && !hasBirthYear) {
      return NextResponse.json(
        { error: "noFieldsToUpdate" },
        { status: 400 }
      );
    }

    const data: { name?: string; birthYear?: number | null } = {};

    if (hasName) {
      const { name } = body;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "nameRequired" }, { status: 400 });
      }
      data.name = name.trim();
    }

    if (hasBirthYear) {
      // Fødselsår: valgfrit heltal mellem 1900 og indeværende år (null rydder feltet)
      const yearCheck = validateBirthYear(body.birthYear);
      if (!yearCheck.ok) {
        return NextResponse.json({ error: yearCheck.error }, { status: 400 });
      }
      data.birthYear = yearCheck.value;
    }

    const person = await prisma.person.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ...person,
      createdAt: person.createdAt.toISOString(),
      updatedAt: person.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Update person error:", error);
    return NextResponse.json({ error: "personUpdateFailed" }, { status: 500 });
  }
}

// DELETE person — sletter personen og ALLE tilknyttede data: målinger,
// medicin, batch-jobs og billedfilerne på disken.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "invalidId" }, { status: 400 });
    }

    // Kan ikke slette Standard-personen
    if (id === 1) {
      return NextResponse.json(
        { error: "cannotDeleteStandard" },
        { status: 400 }
      );
    }

    // Saml personens data (og billedfilnavne) før sletning, så vi både kan
    // rydde op i den rigtige rækkefølge og slette filerne bagefter.
    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        readings: { select: { image: true } },
        batchJobs: { select: { items: { select: { imagePath: true } } } },
      },
    });

    if (!person) {
      return NextResponse.json({ error: "personNotFound" }, { status: 404 });
    }

    // Målingernes billeder + batch-jobbenes billeder (også uploads der fejlede
    // eller aldrig blev til en måling).
    const imageFiles = new Set<string>();
    for (const reading of person.readings) {
      if (isStoredImageName(reading.image)) imageFiles.add(reading.image);
    }
    for (const job of person.batchJobs) {
      for (const item of job.items) {
        if (isStoredImageName(item.imagePath)) imageFiles.add(item.imagePath);
      }
    }

    // Alt slettes i én transaktion. Rækkefølgen er påkrævet af
    // fremmednøglerne: batch-items peger på både jobs og målinger, så de
    // slettes først — ellers afviser databasen sletningen (P2003).
    await prisma.$transaction([
      prisma.batchJobItem.deleteMany({ where: { job: { personId: id } } }),
      prisma.batchJob.deleteMany({ where: { personId: id } }),
      prisma.reading.deleteMany({ where: { personId: id } }),
      prisma.medication.deleteMany({ where: { personId: id } }),
      prisma.person.delete({ where: { id } }),
    ]);

    await deleteImageFiles(Array.from(imageFiles));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete person error:", error);
    return NextResponse.json({ error: "personDeleteFailed" }, { status: 500 });
  }
}
