import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBirthYear } from "@/lib/validation";

// GET all persons with reading count
export async function GET() {
  const persons = await prisma.person.findMany({
    include: {
      _count: { select: { readings: true } },
      readings: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const result = persons.map((p) => ({
    id: p.id,
    name: p.name,
    birthYear: p.birthYear,
    readingCount: p._count.readings,
    lastReadingAt: p.readings[0]?.createdAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  return NextResponse.json(result);
}

// POST create new person
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, birthYear } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "nameRequired" }, { status: 400 });
    }

    // Fødselsår: valgfrit heltal mellem 1900 og indeværende år
    const yearCheck = validateBirthYear(birthYear);
    if (!yearCheck.ok) {
      return NextResponse.json({ error: yearCheck.error }, { status: 400 });
    }

    const person = await prisma.person.create({
      data: { name: name.trim(), birthYear: yearCheck.value },
    });

    return NextResponse.json({
      ...person,
      createdAt: person.createdAt.toISOString(),
      updatedAt: person.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error("Create person error:", error);
    return NextResponse.json({ error: "personCreateFailed" }, { status: 500 });
  }
}
