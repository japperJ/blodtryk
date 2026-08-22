import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const NAME_MAX = 100;
const DOSE_MAX = 100;

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !isNaN(new Date(value).getTime());
}

// GET alle medicin for en person — aktive først, derefter nyeste først
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "invalidId" }, { status: 400 });
  }

  const person = await prisma.person.findUnique({ where: { id } });
  if (!person) {
    return NextResponse.json({ error: "personNotFound" }, { status: 404 });
  }

  const medications = await prisma.medication.findMany({
    where: { personId: id },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(medications);
}

// POST nyt medicin-indslag — name og dose er påkrævet
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = Number((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "invalidId" }, { status: 400 });
    }

    const person = await prisma.person.findUnique({ where: { id } });
    if (!person) {
      return NextResponse.json({ error: "personNotFound" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalidJson" }, { status: 400 });
    }

    const raw =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    // Navn: påkrævet tekststreng
    if (
      typeof raw.name !== "string" ||
      raw.name.trim() === "" ||
      raw.name.length > NAME_MAX
    ) {
      return NextResponse.json({ error: "nameTooLong" }, { status: 400 });
    }

    // Dosis: påkrævet fritekst ("5 mg", "1 tablet")
    if (
      typeof raw.dose !== "string" ||
      raw.dose.trim() === "" ||
      raw.dose.length > DOSE_MAX
    ) {
      return NextResponse.json({ error: "doseTooLong" }, { status: 400 });
    }

    // Valgfrie datoer
    let startDate: Date | null = null;
    if (raw.startDate != null) {
      if (!isValidDate(raw.startDate)) {
        return NextResponse.json({ error: "invalidStartDate" }, { status: 400 });
      }
      startDate = new Date(raw.startDate as string);
    }
    let endDate: Date | null = null;
    if (raw.endDate != null) {
      if (!isValidDate(raw.endDate)) {
        return NextResponse.json({ error: "invalidEndDate" }, { status: 400 });
      }
      endDate = new Date(raw.endDate as string);
    }

    const medication = await prisma.medication.create({
      data: {
        personId: id,
        name: (raw.name as string).trim(),
        dose: (raw.dose as string).trim(),
        startDate,
        endDate,
        active: raw.active === undefined ? true : Boolean(raw.active),
      },
    });

    return NextResponse.json(medication, { status: 201 });
  } catch (error) {
    console.error("Create medication error:", error);
    return NextResponse.json({ error: "medicationCreateFailed" }, { status: 500 });
  }
}
