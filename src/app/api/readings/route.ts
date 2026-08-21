import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    const body = await request.json();
    const { systolic, diastolic, pulse, age, note, image, personId } = body;

    if (typeof systolic !== "number" || typeof diastolic !== "number" || typeof pulse !== "number") {
      return NextResponse.json({ error: "Invalid reading values" }, { status: 400 });
    }

    if (typeof personId !== "number" || personId < 1) {
      return NextResponse.json({ error: "personId er påkrævet" }, { status: 400 });
    }

    // Tjek at personen eksisterer
    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) {
      return NextResponse.json({ error: "Personen findes ikke" }, { status: 404 });
    }

    const reading = await prisma.reading.create({
      data: {
        systolic,
        diastolic,
        pulse,
        age: (typeof age === "number" && age > 0 && age < 150) ? age : null,
        note: note || null,
        image: image || null,
        personId,
      },
    });

    return NextResponse.json(reading, { status: 201 });
  } catch (error) {
    console.error("Create reading error:", error);
    return NextResponse.json({ error: "Failed to save reading" }, { status: 500 });
  }
}
