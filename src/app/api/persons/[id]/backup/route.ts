import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalidId" }, { status: 400 });
  }

  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      readings: { orderBy: { createdAt: "asc" } },
      medications: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!person) {
    return NextResponse.json({ error: "personNotFound" }, { status: 404 });
  }

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    person: {
      id: person.id,
      name: person.name,
      birthYear: person.birthYear,
    },
    readings: person.readings.map((reading) => ({
      id: reading.id,
      personId: reading.personId,
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      pulse: reading.pulse,
      age: reading.age,
      note: reading.note,
      image: reading.image,
      timeOfDay: reading.timeOfDay,
      arm: reading.arm,
      createdAt: reading.createdAt.toISOString(),
      updatedAt: reading.updatedAt.toISOString(),
    })),
    medications: person.medications.map((medication) => ({
      id: medication.id,
      personId: medication.personId,
      name: medication.name,
      dose: medication.dose,
      startDate: medication.startDate?.toISOString() ?? null,
      endDate: medication.endDate?.toISOString() ?? null,
      active: medication.active,
      createdAt: medication.createdAt.toISOString(),
      updatedAt: medication.updatedAt.toISOString(),
    })),
  });
}
