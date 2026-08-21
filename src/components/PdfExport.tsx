"use client";
import { useState } from "react";
import jsPDF from "jspdf";
import type { Reading } from "@/types";
import { getBPStatus, getAgeGroupLabel, type Severity } from "@/lib/bpClassification";
import { timeOfDayLabel, shortArmLabel } from "@/lib/exporters";
import { LINE_COLORS } from "@/components/charts/BPLineChart";

interface Props {
  readings: Reading[];
  personName?: string;
  medications?: { name: string; dose: string; active: boolean }[];
}

// Dagligt gennemsnit beregnet lokalt af den filtrerede målliste (chart-grundlag)
interface DailyPoint {
  date: string; // YYYY-MM-DD (lokal tid)
  sysAvg: number;
  diaAvg: number;
}

/** Gruppér målinger pr. lokal kalenderdag og beregn afrundede sys/dia-gennemsnit. */
export function computeDailyAverages(readings: Reading[]): DailyPoint[] {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const map = new Map<string, { sys: number; dia: number; n: number }>();
  const sorted = [...readings].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  for (const r of sorted) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const cur = map.get(key) ?? { sys: 0, dia: 0, n: 0 };
    cur.sys += r.systolic;
    cur.dia += r.diastolic;
    cur.n += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({
      date,
      sysAvg: Math.round(v.sys / v.n),
      diaAvg: Math.round(v.dia / v.n),
    }));
}

// Y-akse: "pæne" trin (multipla af 5) med luft i kanterne — samme tilgang som BPLineChart
function niceScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  const span = Math.max(20, max - min);
  const step = Math.max(5, Math.ceil(span / 4 / 5) * 5);
  const lo = Math.floor((min - span * 0.05) / step) * step;
  const hi = Math.ceil((max + span * 0.05) / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { lo, hi, ticks };
}

// Chart-størrelser i SVG-px og i PDF-mm (samme sideforhold)
const CHART_W_PX = 600;
const CHART_H_PX = 230;
const CHART_W_MM = 180;
const CHART_H_MM = (CHART_W_MM * CHART_H_PX) / CHART_W_PX;

/**
 * Byg en selvstændig SVG-streng med linjediagram over daglige sys/dia-gennemsnit.
 * Ren streng-bygning (ingen React/DOM) så den kan rasteriseres via Image/canvas.
 * Farver deles med trends-sidens linjediagram (LINE_COLORS).
 */
export function buildTrendChartSvg(data: DailyPoint[]): string {
  const W = CHART_W_PX;
  const H = CHART_H_PX;
  const PAD = { top: 28, right: 12, bottom: 20, left: 34 };

  const values: number[] = [];
  for (const p of data) values.push(p.sysAvg, p.diaAvg);
  const { lo, hi, ticks } = niceScale(Math.min(...values), Math.max(...values));

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  // Kategorisk x-akse (som BPLineChart): jævn fordeling efter punkt-indeks
  const xAt = (i: number): number =>
    PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number): number => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const toPoints = (get: (p: DailyPoint) => number): string =>
    data.map((p, i) => `${xAt(i)},${yAt(get(p))}`).join(" ");

  const parts: string[] = [];

  // Gridlines + y-labels
  for (const t of ticks) {
    parts.push(
      `<line x1="${PAD.left}" x2="${W - PAD.right}" y1="${yAt(t)}" y2="${yAt(t)}" stroke="#e5e7eb" stroke-width="1"/>`,
      `<text x="${PAD.left - 4}" y="${yAt(t) + 3}" text-anchor="end" font-size="10" fill="#9ca3af">${t}</text>`
    );
  }

  // Kurver (dia først så sys tegnes øverst)
  parts.push(
    `<polyline points="${toPoints((p) => p.diaAvg)}" fill="none" stroke="${LINE_COLORS.diastolic}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<polyline points="${toPoints((p) => p.sysAvg)}" fill="none" stroke="${LINE_COLORS.systolic}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
  );

  // Prikker ved overkommeligt antal punkter
  if (data.length <= 62) {
    data.forEach((p, i) => {
      parts.push(
        `<circle cx="${xAt(i)}" cy="${yAt(p.diaAvg)}" r="2.5" fill="${LINE_COLORS.diastolic}"/>`,
        `<circle cx="${xAt(i)}" cy="${yAt(p.sysAvg)}" r="2.5" fill="${LINE_COLORS.systolic}"/>`
      );
    });
  }

  // Sparsomme x-labels: første/sidste altid, plus midte og evt. kvartaler
  const shortDate = (iso: string): string => {
    const [y, m, d] = iso.split("-");
    return `${Number(d)}/${Number(m)}`;
  };
  const labelIdx = new Set<number>([0, data.length - 1]);
  if (data.length > 2) labelIdx.add(Math.floor((data.length - 1) / 2));
  if (data.length > 8) {
    labelIdx.add(Math.floor((data.length - 1) / 4));
    labelIdx.add(Math.floor((3 * (data.length - 1)) / 4));
  }
  for (const i of Array.from(labelIdx).sort((a, b) => a - b)) {
    const anchor = i === 0 ? "start" : i === data.length - 1 ? "end" : "middle";
    parts.push(
      `<text x="${xAt(i)}" y="${H - 5}" text-anchor="${anchor}" font-size="10" fill="#9ca3af">${shortDate(data[i].date)}</text>`
    );
  }

  // Legende øverst til højre (tegnes fra højre mod venstre)
  const legend = [
    { color: LINE_COLORS.diastolic, label: "Diastolisk" },
    { color: LINE_COLORS.systolic, label: "Systolisk" },
  ];
  let lx = W - PAD.right;
  for (const item of legend) {
    lx -= item.label.length * 6; // ca. tekstbredde ved font-size 11
    parts.push(
      `<text x="${lx}" y="16" text-anchor="start" font-size="11" fill="#6b7280">${item.label}</text>`
    );
    lx -= 14;
    parts.push(`<rect x="${lx}" y="7" width="9" height="9" fill="${item.color}"/>`);
    lx -= 10;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="sans-serif">` +
    parts.join("") +
    `</svg>`
  );
}

/**
 * Rasterisér SVG-streng → PNG dataURL via Image + canvas (2x skala).
 * Returnerer null ved enhver fejl (SSR, canvas-taint osv.) — chartet er best-effort.
 */
async function rasterizeSvgToPng(
  svg: string,
  svgW: number,
  svgH: number,
  scale = 2
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined" || typeof document === "undefined") {
        resolve(null);
        return;
      }
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(svgW * scale);
          canvas.height = Math.round(svgH * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = "#ffffff"; // hvid baggrund i stedet for transparent
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, svgW, svgH);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    } catch {
      resolve(null);
    }
  });
}

export default function PdfExport({ readings, personName, medications }: Props) {
  const [generating, setGenerating] = useState(false);

  const exportPdf = async () => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      let y = margin;

      const addPageHeader = () => {
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Blodtryksrapport", margin, 8);
        doc.text(
          `Genereret: ${new Date().toLocaleString("da-DK")}`,
          pageWidth - margin,
          8,
          { align: "right" }
        );
        doc.setDrawColor(200);
        doc.line(margin, 10, pageWidth - margin, 10);
      };

      const checkPage = (needed: number) => {
        if (y + needed > pageHeight - margin) {
          doc.addPage();
          addPageHeader();
          y = margin + 5;
        }
      };

      // Farver styres af maskinlæsbar sværhedsgrad (ikke label-tekst),
      // så labels kan omdøbes frit uden at ødelægge PDF-farverne
      const setStatusColor = (severity: Severity) => {
        switch (severity) {
          case "crisis":
            doc.setTextColor(180, 0, 0);
            break;
          case "stage2":
            doc.setTextColor(200, 0, 0);
            break;
          case "stage1":
            doc.setTextColor(220, 100, 0);
            break;
          case "elevated":
            doc.setTextColor(200, 150, 0);
            break;
          default: // normal
            doc.setTextColor(0, 140, 0);
        }
      };

      const sorted = [...readings].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // === Forside ===
      doc.setFontSize(20);
      doc.setTextColor(0);
      doc.text("Blodtryksrapport", margin, y + 5);
      y += 15;

      doc.setFontSize(10);
      doc.setTextColor(100);

      // Persons navn
      if (personName) {
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text(personName, margin, y);
        y += 7;

        doc.setFontSize(10);
        doc.setTextColor(100);
      }

      doc.text(`Genereret: ${new Date().toLocaleString("da-DK")}`, margin, y);
      y += 5;

      // Alder info
      const ages = readings.map((r) => r.age).filter((a): a is number => a != null);
      if (ages.length > 0) {
        const uniqueAges = Array.from(new Set(ages));
        if (uniqueAges.length === 1) {
          doc.text(
            `Alder: ${uniqueAges[0]} aar (${getAgeGroupLabel(uniqueAges[0])})`,
            margin,
            y
          );
          y += 5;
        }
      }

      // Aktive medicin (#14) — listes under personens navn når de findes
      const activeMeds = (medications ?? []).filter((m) => m.active);
      if (activeMeds.length > 0) {
        doc.text(
          `Medicin: ${activeMeds.map((m) => `${m.name} ${m.dose}`).join(", ")}`,
          margin,
          y
        );
        y += 5;
      }

      // === Resumé (side 1, før tabellen) ===
      if (readings.length > 0) {
        checkPage(60);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Resumé", margin, y);
        y += 7;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        // Periode: første–sidste måling
        const first = new Date(sorted[0].createdAt);
        const last = new Date(sorted[sorted.length - 1].createdAt);
        const firstStr = first.toLocaleDateString("da-DK");
        const lastStr = last.toLocaleDateString("da-DK");
        doc.setTextColor(0);
        doc.text(
          firstStr === lastStr
            ? `Periode: ${firstStr}`
            : `Periode: ${firstStr} – ${lastStr}`,
          margin,
          y
        );
        y += 5;

        // Gennemsnit og min/maks for systolisk + diastolisk
        const avgSys = Math.round(readings.reduce((s, r) => s + r.systolic, 0) / readings.length);
        const avgDia = Math.round(readings.reduce((s, r) => s + r.diastolic, 0) / readings.length);
        const minSys = Math.min(...readings.map((r) => r.systolic));
        const maxSys = Math.max(...readings.map((r) => r.systolic));
        const minDia = Math.min(...readings.map((r) => r.diastolic));
        const maxDia = Math.max(...readings.map((r) => r.diastolic));

        doc.text(`Antal maalinger: ${readings.length}`, margin, y);
        y += 5;
        doc.text(`Gennemsnit: ${avgSys}/${avgDia} mmHg`, margin, y);
        y += 5;

        // Puls-gennemsnit kun hvis der findes pulsværdier
        const pulseValues = readings.map((r) => r.pulse).filter((p) => p > 0);
        if (pulseValues.length > 0) {
          const avgPulse = Math.round(pulseValues.reduce((s, p) => s + p, 0) / pulseValues.length);
          doc.text(`Gennemsnitlig puls: ${avgPulse} bpm`, margin, y);
          y += 5;
        }

        doc.text(`Systolisk (min-maks): ${minSys}-${maxSys} mmHg`, margin, y);
        y += 5;
        doc.text(`Diastolisk (min-maks): ${minDia}-${maxDia} mmHg`, margin, y);
        y += 6;

        // Klassifikationsfordeling: getBPStatus pr. måling (med alder),
        // optalt pr. sværhedsgrad — samme fremgangsmåde som stats-API'en (#9)
        const severityOrder: Severity[] = ["normal", "elevated", "stage1", "stage2", "crisis"];
        const classMap = new Map<Severity, { severity: Severity; label: string; count: number }>();
        for (const r of readings) {
          const status = getBPStatus(r.systolic, r.diastolic, r.age);
          const cur = classMap.get(status.severity) ?? {
            severity: status.severity,
            label: status.label,
            count: 0,
          };
          cur.count += 1;
          classMap.set(status.severity, cur);
        }
        const distribution = severityOrder
          .filter((s) => classMap.has(s))
          .map((s) => classMap.get(s)!);

        doc.setTextColor(100);
        doc.text("Fordeling:", margin, y);
        let dx = margin + doc.getTextWidth("Fordeling:") + 3;
        for (const seg of distribution) {
          const txt = `${seg.label}: ${seg.count}`;
          const w = doc.getTextWidth(txt);
          if (dx + w > pageWidth - margin) {
            dx = margin;
            y += 5;
          }
          setStatusColor(seg.severity);
          doc.text(txt, dx, y);
          dx += w + 4;
        }
        y += 7;

        // Samlet vurdering baseret på gennemsnittet
        const avgStatus = getBPStatus(avgSys, avgDia, ages[0] || null);
        doc.setFont("helvetica", "bold");
        setStatusColor(avgStatus.severity);
        doc.text(`Samlet vurdering: ${avgStatus.label}`, margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(avgStatus.description, margin, y);
        y += 8;
      }

      // === Trenddiagram (best-effort: springes stille over hvis rasterisering fejler) ===
      try {
        const daily = computeDailyAverages(readings);
        if (daily.length >= 2) {
          const svg = buildTrendChartSvg(daily);
          const png = await rasterizeSvgToPng(svg, CHART_W_PX, CHART_H_PX);
          if (png) {
            checkPage(CHART_H_MM + 14);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0);
            doc.text("Daglige gennemsnit", margin, y);
            y += 4;
            doc.addImage(png, "PNG", margin, y, CHART_W_MM, CHART_H_MM);
            y += CHART_H_MM + 6;
          }
        }
      } catch {
        // Diagram er dekorativt — rapporten skal altid genereres
      }

      // === Tabel ===
      // Note-/Tag-kolonner vises kun hvis mindst én måling har henholdsvis note eller tags
      const hasNotes = readings.some((r) => r.note != null && r.note.trim() !== "");
      const hasTags = readings.some(
        (r) =>
          r.timeOfDay === "morning" ||
          r.timeOfDay === "evening" ||
          r.arm === "left" ||
          r.arm === "right"
      );

      const colDate = margin;
      const colTime = margin + 23;
      const colAge = margin + 39;
      const colSys = margin + 53;
      const colDia = margin + 67;
      const colPulse = margin + 81;
      const colStatus = margin + 95;
      const colTag = margin + 125;
      const colNote = margin + 141;
      const noteWidth = pageWidth - margin - colNote;

      // Lodret rytme (#36): linjeafstand mellem målinger var for tæt —
      // rækkeafstand øges fra 6 mm til 9 mm og notelinjer fra 4 til 4,5 mm.
      const ROW_H = 9;
      const NOTE_LINE_H = 4.5;

      const tagText = (r: Reading): string => {
        const tod = timeOfDayLabel(r.timeOfDay);
        const arm = shortArmLabel(r.arm);
        return [tod, arm].filter(Boolean).join(" ");
      };

      const drawTableHeader = () => {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Dato", colDate, y);
        doc.text("Tid", colTime, y);
        doc.text("Alder", colAge, y);
        doc.text("Sys", colSys, y);
        doc.text("Dia", colDia, y);
        doc.text("Puls", colPulse, y);
        doc.text("Vurdering", colStatus, y);
        if (hasTags) {
          doc.text("Tag", colTag, y);
        }
        if (hasNotes) {
          doc.text("Note", colNote, y);
        }
        y += 2;
        doc.setDrawColor(180);
        doc.line(margin, y, pageWidth - margin, y);
        y += 6;
      };

      drawTableHeader();

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      for (const reading of sorted) {
        const date = new Date(reading.createdAt);
        const status = getBPStatus(reading.systolic, reading.diastolic, reading.age);

        // Note pakkes til kolonnebredden (maks. 2 linjer, … ved afkortning)
        let noteLines: string[] = [];
        if (hasNotes) {
          const noteText = reading.note?.trim() ?? "";
          if (noteText) {
            const wrapped = doc.splitTextToSize(noteText, noteWidth) as string[];
            if (wrapped.length > 2) {
              noteLines = [wrapped[0], `${wrapped[1].trimEnd()}…`];
            } else {
              noteLines = wrapped;
            }
          }
        }

        checkPage(ROW_H + 4 + (noteLines.length - 1) * NOTE_LINE_H);

        const dateStr = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getFullYear()).slice(2)}`;
        const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

        doc.setTextColor(0);
        doc.text(dateStr, colDate, y);
        doc.text(timeStr, colTime, y);

        doc.setTextColor(100);
        doc.text(reading.age != null ? `${reading.age}` : "-", colAge, y);

        doc.setTextColor(0);
        doc.text(String(reading.systolic), colSys, y);
        doc.text(String(reading.diastolic), colDia, y);
        doc.text(String(reading.pulse), colPulse, y);

        setStatusColor(status.severity);
        doc.text(status.label, colStatus, y);

        if (hasTags) {
          doc.setTextColor(100);
          doc.text(tagText(reading), colTag, y);
        }

        if (noteLines.length > 0) {
          doc.setTextColor(100);
          noteLines.forEach((line, i) => doc.text(line, colNote, y + i * NOTE_LINE_H));
        }

        // Separatoren tegnes præcis halvvejs mellem denne rækkes sidste
        // tekstbasislinje og næste rækkes basislinje (#36) — så den altid
        // ligger MELLEM rækkerne og aldrig rammer tal eller tekst.
        const nextY = y + ROW_H + (noteLines.length - 1) * NOTE_LINE_H;
        doc.setDrawColor(230);
        const sepY = nextY - ROW_H / 2;
        doc.line(margin, sepY, pageWidth - margin, sepY);
        y = nextY;
      }

      // Sidefod på alle sider: Blodtryk-branding + genereringsdato + sidenumre
      const generatedDate = new Date().toLocaleDateString("da-DK");
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(200);
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text("Blodtryk", margin, pageHeight - 8);
        doc.text(`Genereret: ${generatedDate}`, pageWidth - margin, pageHeight - 8, {
          align: "right",
        });
        doc.text(`Side ${i} af ${totalPages}`, pageWidth / 2, pageHeight - 8, {
          align: "center",
        });
      }

      const filename = personName
        ? `blodtryk-${personName.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`
        : `blodtryk-${new Date().toISOString().split("T")[0]}.pdf`;

      doc.save(filename);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={exportPdf}
      disabled={generating}
      className="inline-flex items-center justify-center min-h-[44px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm px-4 py-2 rounded-lg font-medium
                 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all shadow-sm
                 disabled:opacity-50 disabled:cursor-wait"
    >
      📄 PDF
    </button>
  );
}
