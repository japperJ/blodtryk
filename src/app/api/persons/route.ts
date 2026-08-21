import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    readingCount: p._count.readings,
    lastReadingAt: p.readings[0]?.createdAt ?? null,
    createdAt: p.createdAt,
  }));

  return NextResponse.json(result);
}

// POST create new person
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Navn er påkrævet" }, { status: 400 });
    }

    const person = await prisma.person.create({
      data: { name: name.trim() },
    });

    return NextResponse.json(person, { status: 201 });
  } catch (error) {
    console.error("Create person error:", error);
    return NextResponse.json({ error: "Kunne ikke oprette person" }, { status: 500 });
  }
}
