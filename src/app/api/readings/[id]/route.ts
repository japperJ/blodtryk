import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET single reading
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const reading = await prisma.reading.findUnique({ where: { id: Number(params.id) } });
  if (!reading) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(reading);
}

// DELETE reading
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.reading.delete({ where: { id: Number(params.id) } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// PATCH update reading
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const reading = await prisma.reading.update({
      where: { id: Number(params.id) },
      data: body,
    });
    return NextResponse.json(reading);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
