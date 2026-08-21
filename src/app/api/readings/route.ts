import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateReadingInput } from "@/lib/validation";

// GET readings — filtered by personId (required)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personId = searchParams.get("personId");

  if (!personId) {
    return NextResponse.json(
      { error: "personId er påkrævet" },
      { status: 400 }
    );
  }

  const id = parseInt(personId);
  if (isNaN(id)) {
    return NextResponse.json(
      { error: "Ugyldigt personId" },
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
      return NextResponse.json({ error: "Ugyldigt JSON-format" }, { status: 400 });
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
      return NextResponse.json({ error: "Personen findes ikke" }, { status: 400 });
    }

    const reading = await prisma.reading.create({
      data: {
        systolic,
        diastolic,
        pulse,
        age,
        note,
        image,
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
    return NextResponse.json({ error: "Failed to save reading" }, { status: 500 });
  }
}
