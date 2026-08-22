import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const NAME_MAX = 100;
const DOSE_MAX = 100;

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !isNaN(new Date(value).getTime());
}

// PATCH opdatér medicin — navn/dosis/datoer/active.
// Deaktivering sker via active:false (historikken bevares).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = Number((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Ugyldigt ID" }, { status: 400 });
    }

    const existing = await prisma.medication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Medicin blev ikke fundet" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Ugyldigt JSON-format" }, { status: 400 });
    }

    const raw =
      typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    if (Object.keys(raw).length === 0) {
      return NextResponse.json(
        { error: "Angiv mindst ét felt at opdatere" },
        { status: 400 }
      );
    }

    const data: {
      name?: string;
      dose?: string;
      startDate?: Date | null;
      endDate?: Date | null;
      active?: boolean;
    } = {};

    if (raw.name !== undefined) {
      if (typeof raw.name !== "string" || raw.name.trim() === "" || raw.name.length > NAME_MAX) {
        return NextResponse.json(
          { error: `Navn er påkrævet (højst ${NAME_MAX} tegn)` },
          { status: 400 }
        );
      }
      data.name = raw.name.trim();
    }

    if (raw.dose !== undefined) {
      if (typeof raw.dose !== "string" || raw.dose.trim() === "" || raw.dose.length > DOSE_MAX) {
        return NextResponse.json(
          { error: `Dosis er påkrævet (højst ${DOSE_MAX} tegn)` },
          { status: 400 }
        );
      }
      data.dose = raw.dose.trim();
    }

    if (raw.startDate !== undefined) {
      if (raw.startDate === null) {
        data.startDate = null;
      } else if (!isValidDate(raw.startDate)) {
        return NextResponse.json({ error: "Ugyldig startdato" }, { status: 400 });
      } else {
        data.startDate = new Date(raw.startDate as string);
      }
    }

    if (raw.endDate !== undefined) {
      if (raw.endDate === null) {
        data.endDate = null;
      } else if (!isValidDate(raw.endDate)) {
        return NextResponse.json({ error: "Ugyldig slutdato" }, { status: 400 });
      } else {
        data.endDate = new Date(raw.endDate as string);
      }
    }

    if (raw.active !== undefined) {
      if (typeof raw.active !== "boolean") {
        return NextResponse.json({ error: "active skal være true eller false" }, { status: 400 });
      }
      data.active = raw.active;
    }

    const medication = await prisma.medication.update({
      where: { id },
      data,
    });

    return NextResponse.json(medication);
  } catch (error) {
    console.error("Update medication error:", error);
    return NextResponse.json({ error: "Kunne ikke opdatere medicin" }, { status: 500 });
  }
}

// DELETE fjerner medicin-indslaget helt
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = Number((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Ugyldigt ID" }, { status: 400 });
    }

    const existing = await prisma.medication.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Medicin blev ikke fundet" }, { status: 404 });
    }

    await prisma.medication.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete medication error:", error);
    return NextResponse.json({ error: "Kunne ikke slette medicin" }, { status: 500 });
  }
}
