import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateReadingInput } from "@/lib/validation";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// GET readings — filtered by personId (required)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("personId");

  if (!personId) {
    return NextResponse.json(
      { error: "personIdRequired" },
      { status: 400 }
    );
  }

  const id = parseInt(personId);
  if (isNaN(id)) {
    return NextResponse.json(
      { error: "invalidPersonId" },
      { status: 400 }
    );
  }

  const readings = await prisma.reading.findMany({
    where: { personId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(readings);
}

// POST new reading — requires personId
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalidJson" }, { status: 400 });
    }

    // Server-side validering før noget DB-arbejde
    const validation = validateReadingInput(body);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const { systolic, diastolic, pulse, age, note, image, timeOfDay, arm, personId, createdAt } =
      validation.data;

    // Tjek at personen eksisterer
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) {
      return NextResponse.json({ error: "personNotFound" }, { status: 400 });
    }

    // Billeder gemmes på disken (issue #15) — ikke som base64 i databasen.
    // Data-URLs afkodes og skrives til scan-captures/<uuid>.jpg; kun filnavnet
    // gemmes i Reading.image. Rense filnavne (allerede migrerede målinger)
    // sendes uændret videre. Fejler filskrivningen gemmes målingen UDEN billede.
    let storedImage = image;
    if (image && image.startsWith("data:")) {
      try {
        const commaIndex = image.indexOf(",");
        const base64Data = commaIndex === -1 ? "" : image.slice(commaIndex + 1);
        const buffer = Buffer.from(base64Data, "base64");
        const scanDir = join(process.cwd(), "scan-captures");
        await mkdir(scanDir, { recursive: true });
        const filename = `${randomUUID()}.jpg`;
        await writeFile(join(scanDir, filename), buffer);
        storedImage = filename;
      } catch (error) {
        console.error("Could not save reading image to disk:", error);
        storedImage = null;
      }
    }

    const reading = await prisma.reading.create({
      data: {
        systolic,
        diastolic,
        pulse,
        age,
        note,
        image: storedImage,
        timeOfDay,
        arm,
        personId,
        // Valgfrit målingstidspunkt — udelades hvis ikke angivet (Prisma-default "nu")
        ...(createdAt ? { createdAt } : {}),
      },
    });

    return NextResponse.json(reading, { status: 201 });
  } catch (error) {
    console.error("Create reading error:", error);
    return NextResponse.json({ error: "readingSaveFailed" }, { status: 500 });
  }
}
