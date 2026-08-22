import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBirthYear } from "@/lib/validation";

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

    return NextResponse.json(person);
  } catch (error) {
    console.error("Update person error:", error);
    return NextResponse.json({ error: "personUpdateFailed" }, { status: 500 });
  }
}

// DELETE person — flyt målinger til Standard (id: 1)
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

    // Tilknyt målinger til Standard før sletning
    await prisma.reading.updateMany({
      where: { personId: id },
      data: { personId: 1 },
    });

    await prisma.person.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete person error:", error);
    return NextResponse.json({ error: "personDeleteFailed" }, { status: 500 });
  }
}
