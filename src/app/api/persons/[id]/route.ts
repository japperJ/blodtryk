import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH update person name
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Ugyldigt ID" }, { status: 400 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Navn er påkrævet" }, { status: 400 });
    }

    const person = await prisma.person.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json(person);
  } catch (error) {
    console.error("Update person error:", error);
    return NextResponse.json({ error: "Kunne ikke opdatere person" }, { status: 500 });
  }
}

// DELETE person — flyt målinger til Standard (id: 1)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Ugyldigt ID" }, { status: 400 });
    }

    // Kan ikke slette Standard-personen
    if (id === 1) {
      return NextResponse.json(
        { error: "Kan ikke slette Standard-personen" },
        { status: 400 }
      );
    }

    // Tilknyt målinger til Standard før sletning
    await prisma.reading.updateMany({
      where: { personId: id },
      data: { personId: 1 },
    });

    await prisma.person.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete person error:", error);
    return NextResponse.json({ error: "Kunne ikke slette person" }, { status: 500 });
  }
}
