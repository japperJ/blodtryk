import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function asOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalidJson" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "invalidRequestFormat" }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const backup =
      raw.backup && typeof raw.backup === "object" && !Array.isArray(raw.backup)
        ? (raw.backup as Record<string, unknown>)
        : raw;

    const personInfo =
      backup.person && typeof backup.person === "object" && !Array.isArray(backup.person)
        ? (backup.person as Record<string, unknown>)
        : null;

    if (!personInfo || typeof personInfo.name !== "string" || personInfo.name.trim() === "") {
      return NextResponse.json({ error: "nameRequired" }, { status: 400 });
    }

    const targetPersonId = asInt(raw.personId ?? backup.personId ?? null);
    const name = personInfo.name.trim();
    const birthYear = asOptionalInt(personInfo.birthYear);

    let person = targetPersonId ? await prisma.person.findUnique({ where: { id: targetPersonId } }) : null;

    if (!person) {
      person = await prisma.person.create({
        data: {
          name,
          birthYear,
        },
      });
    } else {
      const updates: { name?: string; birthYear?: number | null } = {};
      if (person.name !== name) updates.name = name;
      if (person.birthYear !== birthYear) updates.birthYear = birthYear;
      if (Object.keys(updates).length > 0) {
        person = await prisma.person.update({
          where: { id: person.id },
          data: updates,
        });
      }
    }

    await prisma.reading.deleteMany({ where: { personId: person.id } });
    await prisma.medication.deleteMany({ where: { personId: person.id } });

    const readings = Array.isArray(backup.readings) ? backup.readings : [];
    const medications = Array.isArray(backup.medications) ? backup.medications : [];

    for (const item of readings) {
      if (!item || typeof item !== "object") continue;
      const reading = item as Record<string, unknown>;
      const systolic = asInt(reading.systolic);
      const diastolic = asInt(reading.diastolic);
      const pulse = asInt(reading.pulse);
      if (systolic === null || diastolic === null || pulse === null) continue;

      await prisma.reading.create({
        data: {
          personId: person.id,
          systolic,
          diastolic,
          pulse,
          age: asOptionalInt(reading.age),
          note: typeof reading.note === "string" ? reading.note : null,
          image: typeof reading.image === "string" ? reading.image : null,
          timeOfDay: typeof reading.timeOfDay === "string" ? reading.timeOfDay : null,
          arm: typeof reading.arm === "string" ? reading.arm : null,
          createdAt:
            typeof reading.createdAt === "string" && reading.createdAt
              ? new Date(reading.createdAt)
              : undefined,
        },
      });
    }

    for (const item of medications) {
      if (!item || typeof item !== "object") continue;
      const medication = item as Record<string, unknown>;
      const medName = typeof medication.name === "string" ? medication.name.trim() : "";
      const dose = typeof medication.dose === "string" ? medication.dose.trim() : "";
      if (!medName || !dose) continue;

      await prisma.medication.create({
        data: {
          personId: person.id,
          name: medName,
          dose,
          active: medication.active === undefined ? true : Boolean(medication.active),
          startDate:
            typeof medication.startDate === "string" && medication.startDate
              ? new Date(medication.startDate)
              : null,
          endDate:
            typeof medication.endDate === "string" && medication.endDate
              ? new Date(medication.endDate)
              : null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      personId: person.id,
      restoredReadings: readings.length,
      restoredMedications: medications.length,
    });
  } catch (error) {
    console.error("Restore backup error:", error);
    return NextResponse.json({ error: "personCreateFailed" }, { status: 500 });
  }
}
