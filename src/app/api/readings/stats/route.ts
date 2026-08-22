import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBPStatus } from "@/lib/bpClassification";

// Tilladte vinduer for days-parameteren
const ALLOWED_DAYS = ["7", "30", "90", "all"] as const;

// Aggregeret statistik for én person — data-grundlag for trends/dashboard (#10/#17).
interface StatsEntry {
  systolic: number;
  diastolic: number;
  pulse: number;
}

interface StatsResponse {
  count: number;
  avg: StatsEntry;
  min: StatsEntry;
  max: StatsEntry;
  daily: { date: string; sysAvg: number; diaAvg: number; pulseAvg: number; count: number }[];
  weekly: { weekStart: string; sysAvg: number; diaAvg: number; count: number }[];
  classification: { severity: string; labelKey: string; count: number }[];
  byTimeOfDay?: { morning?: { sysAvg: number }; evening?: { sysAvg: number } };
  streakDays: number;
}

// Hjælper: lokal dato-nøgle på formen YYYY-MM-DD
function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Hjælper: mandag i ugen for den givne dato (dansk uge-konvention)
function mondayOf(d: Date): Date {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const weekday = (start.getDay() + 6) % 7; // mandag = 0
  start.setDate(start.getDate() - weekday);
  return start;
}

// Hjælper: gennemsnit som heltal
const round = (sum: number, n: number) => (n === 0 ? 0 : Math.round(sum / n));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // personId er påkrævet og skal være et gyldigt tal
  const personIdParam = searchParams.get("personId");
  if (!personIdParam) {
    return NextResponse.json({ error: "personIdRequired" }, { status: 400 });
  }
  const personId = parseInt(personIdParam);
  if (isNaN(personId)) {
    return NextResponse.json({ error: "invalidPersonId" }, { status: 400 });
  }

  // days-vindue: 7|30|90|all (standard 30)
  const daysParam = searchParams.get("days") ?? "30";
  if (!ALLOWED_DAYS.includes(daysParam as (typeof ALLOWED_DAYS)[number])) {
    return NextResponse.json(
      { error: "daysMustBeValid" },
      { status: 400 }
    );
  }

  // Personen skal eksistere
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) {
    return NextResponse.json({ error: "personNotFound" }, { status: 400 });
  }

  // Tidsafgrænsning: start af dag N-1 dage siden (i dag tælles med)
  let cutoff: Date | null = null;
  if (daysParam !== "all") {
    const n = parseInt(daysParam);
    cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (n - 1));
  }

  const readings = await prisma.reading.findMany({
    where: {
      personId,
      ...(cutoff ? { createdAt: { gte: cutoff } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: {
      systolic: true,
      diastolic: true,
      pulse: true,
      age: true,
      timeOfDay: true,
      createdAt: true,
    },
  });

  // Nulstillet struktur (ikke fejl) når personen ikke har målinger i vinduet
  if (readings.length === 0) {
    const zero: StatsEntry = { systolic: 0, diastolic: 0, pulse: 0 };
    const response: StatsResponse = {
      count: 0,
      avg: { ...zero },
      min: { ...zero },
      max: { ...zero },
      daily: [],
      weekly: [],
      classification: [],
      streakDays: 0,
    };
    return NextResponse.json(response);
  }

  // Gennemsnit/min/max på tværs af alle målinger i vinduet
  const sum: StatsEntry = { systolic: 0, diastolic: 0, pulse: 0 };
  const min: StatsEntry = { systolic: Infinity, diastolic: Infinity, pulse: Infinity };
  const max: StatsEntry = { systolic: -Infinity, diastolic: -Infinity, pulse: -Infinity };

  // Daglige/ugentlige grupperinger
  const dailyMap = new Map<string, { sys: number; dia: number; pul: number; count: number }>();
  const weeklyMap = new Map<string, { sys: number; dia: number; count: number }>();

  // Klassificerings-fordeling via den delte, aldersbevidste klassifikator
  const classMap = new Map<string, { severity: string; labelKey: string; count: number }>();

  // Kontekst-tags: morgen/aften
  let morningSys = 0;
  let eveningSys = 0;
  let morningCount = 0;
  let eveningCount = 0;

  // Dato-nøgler til streak-beregning
  const dayKeys = new Set<string>();

  for (const r of readings) {
    sum.systolic += r.systolic;
    sum.diastolic += r.diastolic;
    sum.pulse += r.pulse;
    min.systolic = Math.min(min.systolic, r.systolic);
    min.diastolic = Math.min(min.diastolic, r.diastolic);
    min.pulse = Math.min(min.pulse, r.pulse);
    max.systolic = Math.max(max.systolic, r.systolic);
    max.diastolic = Math.max(max.diastolic, r.diastolic);
    max.pulse = Math.max(max.pulse, r.pulse);

    const key = dateKey(r.createdAt);
    dayKeys.add(key);

    const d = dailyMap.get(key) ?? { sys: 0, dia: 0, pul: 0, count: 0 };
    d.sys += r.systolic;
    d.dia += r.diastolic;
    d.pul += r.pulse;
    d.count += 1;
    dailyMap.set(key, d);

    const weekKey = dateKey(mondayOf(r.createdAt));
    const w = weeklyMap.get(weekKey) ?? { sys: 0, dia: 0, count: 0 };
    w.sys += r.systolic;
    w.dia += r.diastolic;
    w.count += 1;
    weeklyMap.set(weekKey, w);

    const status = getBPStatus(r.systolic, r.diastolic, r.age);
    const c = classMap.get(status.severity) ?? {
      severity: status.severity,
      labelKey: status.labelKey,
      count: 0,
    };
    c.count += 1;
    classMap.set(status.severity, c);

    if (r.timeOfDay === "morning") {
      morningSys += r.systolic;
      morningCount += 1;
    } else if (r.timeOfDay === "evening") {
      eveningSys += r.systolic;
      eveningCount += 1;
    }
  }

  // Streak: antal sammenhængende dage bagud fra i dag (eller i går),
  // med mindst én måling pr. dag — beregnet inden for det valgte vindue
  let streakDays = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!dayKeys.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1); // tillad at streaken slutter i går
  }
  while (dayKeys.has(dateKey(cursor))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Stabil rækkefølge for sværhedsgrader
  const severityOrder = ["normal", "elevated", "stage1", "stage2", "crisis"];
  const classification = severityOrder
    .filter((s) => classMap.has(s))
    .map((s) => classMap.get(s)!);

  // byTimeOfDay kun med nøgler der har data — udelades helt uden taggede målinger
  const byTimeOfDay: StatsResponse["byTimeOfDay"] = {};
  if (morningCount > 0) byTimeOfDay.morning = { sysAvg: round(morningSys, morningCount) };
  if (eveningCount > 0) byTimeOfDay.evening = { sysAvg: round(eveningSys, eveningCount) };

  const response: StatsResponse = {
    count: readings.length,
    avg: {
      systolic: round(sum.systolic, readings.length),
      diastolic: round(sum.diastolic, readings.length),
      pulse: round(sum.pulse, readings.length),
    },
    min,
    max,
    daily: Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        sysAvg: round(v.sys, v.count),
        diaAvg: round(v.dia, v.count),
        pulseAvg: round(v.pul, v.count),
        count: v.count,
      })),
    weekly: Array.from(weeklyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStart, v]) => ({
        weekStart,
        sysAvg: round(v.sys, v.count),
        diaAvg: round(v.dia, v.count),
        count: v.count,
      })),
    classification,
    // Udelades helt i JSON når ingen taggede målinger findes
    ...(Object.keys(byTimeOfDay).length > 0 ? { byTimeOfDay } : {}),
    streakDays,
  };

  return NextResponse.json(response);
}
