"use client";
import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import type { Reading } from "@/types";
import { getBPStatus, getAgeGroupKey, type Severity } from "@/lib/bpClassification";
import { timeOfDayLabel, shortArmLabel, exportFilename } from "@/lib/exporters";
import {
  createDanishReportPdf,
  groupReadingsByDay,
  type DanishReportPeriod,
} from "@/lib/danishReportPdf";
import { INTL_LOCALE } from "@/lib/i18n";
import { useI18n } from "@/lib/I18nProvider";
import { LINE_COLORS } from "@/components/charts/BPLineChart";
import { formatMedicationDate } from "@/lib/medicationDate";
import DanishReportDialog from "@/components/DanishReportDialog";

/** Medicin som den bruges i PDF'en (samme form som API'et returnerer; datoer er ISO-strenge). */
export interface PdfMedication {
  id?: number;
  name: string;
  dose: string;
  active: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

interface Props {
  readings: Reading[];
  personName?: string;
  medications?: PdfMedication[];
}

// Dagligt gennemsnit beregnet lokalt af den filtrerede målliste (chart-grundlag)
interface DailyPoint {
  date: string; // YYYY-MM-DD (lokal tid)
  sysAvg: number;
  diaAvg: number;
  mapAvg: number;
  pulseAvg: number;
}

/** Gruppér målinger pr. lokal kalenderdag og beregn afrundede sys/dia/puls-gennemsnit. */
export function computeDailyAverages(readings: Reading[]): DailyPoint[] {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const map = new Map<
    string,
    { sys: number; dia: number; pul: number; n: number }
  >();
  const sorted = [...readings].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  for (const r of sorted) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    const cur = map.get(key) ?? { sys: 0, dia: 0, pul: 0, n: 0 };
    cur.sys += r.systolic;
    cur.dia += r.diastolic;
    cur.pul += r.pulse;
    cur.n += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => {
      const sysAvg = Math.round(v.sys / v.n);
      const diaAvg = Math.round(v.dia / v.n);
      return {
        date,
        sysAvg,
        diaAvg,
        // MAP = (sys + 2·dia) / 3 — samme formel som i trends-diagrammet
        mapAvg: Math.round((sysAvg + 2 * diaAvg) / 3),
        pulseAvg: Math.round(v.pul / v.n),
      };
    });
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
// Medicin-linjer under x-aksen: én række pr. præparat (samme greb som BPLineChart)
const CHART_MED_GAP = 10;
const CHART_MED_ROW_H = 16;
const CHART_MED_PAD_BOTTOM = 4;

/** Samlet SVG-højde: basis-diagrammet plus plads til evt. medicin-rækker. */
export function trendChartHeightPx(medCount: number): number {
  return (
    CHART_H_PX +
    (medCount > 0 ? CHART_MED_GAP + medCount * CHART_MED_ROW_H + CHART_MED_PAD_BOTTOM : 0)
  );
}

/** XML-escape af brugerdata (medicin-navn/dosis), så en "&" ikke ødelægger hele SVG'en. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tekstetiketter i diagrammet — slås op via i18n i PdfExport-komponenten. */
export interface TrendChartLabels {
  sys: string;
  dia: string;
  map: string;
  pulse: string;
}

/**
 * Byg en selvstændig SVG-streng med linjediagram over daglige sys/dia/MAP-gennemsnit
 * samt medicin-linjer (start–stop) under x-aksen.
 * Ren streng-bygning (ingen React/DOM) så den kan rasteriseres via Image/canvas.
 * Farver deles med trends-sidens linjediagram (LINE_COLORS).
 *
 * medLabel formaterer én medicin-linjes tekst (navn, dosis, periode) — sendes ind
 * fordi streng-bygningen ikke selv har adgang til i18n.
 */
export function buildTrendChartSvg(
  data: DailyPoint[],
  labels: TrendChartLabels,
  medications: PdfMedication[] = [],
  medLabel?: (med: PdfMedication) => string
): string {
  const W = CHART_W_PX;
  const H = CHART_H_PX;
  const totalH = trendChartHeightPx(medications.length);
  const PAD = { top: 28, right: 12, bottom: 20, left: 34 };

  const values: number[] = [];
  for (const p of data) values.push(p.sysAvg, p.diaAvg, p.mapAvg, p.pulseAvg);
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

  // Kurver (dia først så sys tegnes øverst; MAP og puls som stiplede linjer ligesom trends)
  parts.push(
    `<polyline points="${toPoints((p) => p.diaAvg)}" fill="none" stroke="${LINE_COLORS.diastolic}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<polyline points="${toPoints((p) => p.sysAvg)}" fill="none" stroke="${LINE_COLORS.systolic}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<polyline points="${toPoints((p) => p.mapAvg)}" fill="none" stroke="${LINE_COLORS.map}" stroke-width="2" stroke-dasharray="6 4" stroke-linejoin="round" stroke-linecap="round"/>`,
    `<polyline points="${toPoints((p) => p.pulseAvg)}" fill="none" stroke="${LINE_COLORS.pulse}" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round" stroke-linecap="round"/>`
  );

  // Prikker ved overkommeligt antal punkter
  if (data.length <= 62) {
    data.forEach((p, i) => {
      parts.push(
        `<circle cx="${xAt(i)}" cy="${yAt(p.diaAvg)}" r="2.5" fill="${LINE_COLORS.diastolic}"/>`,
        `<circle cx="${xAt(i)}" cy="${yAt(p.sysAvg)}" r="2.5" fill="${LINE_COLORS.systolic}"/>`,
        `<circle cx="${xAt(i)}" cy="${yAt(p.mapAvg)}" r="2.2" fill="${LINE_COLORS.map}"/>`,
        `<circle cx="${xAt(i)}" cy="${yAt(p.pulseAvg)}" r="2" fill="${LINE_COLORS.pulse}"/>`
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
    { color: LINE_COLORS.pulse, label: labels.pulse, dashed: true },
    { color: LINE_COLORS.map, label: labels.map, dashed: true },
    { color: LINE_COLORS.diastolic, label: labels.dia, dashed: false },
    { color: LINE_COLORS.systolic, label: labels.sys, dashed: false },
  ];
  let lx = W - PAD.right;
  for (const item of legend) {
    lx -= item.label.length * 6; // ca. tekstbredde ved font-size 11
    parts.push(
      `<text x="${lx}" y="16" text-anchor="start" font-size="11" fill="#6b7280">${item.label}</text>`
    );
    lx -= 14;
    if (item.dashed) {
      parts.push(
        `<line x1="${lx}" x2="${lx + 9}" y1="11.5" y2="11.5" stroke="${item.color}" stroke-width="1.5" stroke-dasharray="3 2"/>`
      );
    } else {
      parts.push(`<rect x="${lx}" y="7" width="9" height="9" fill="${item.color}"/>`);
    }
    lx -= 10;
  }

  // Medicin: vandret linje pr. præparat fra startdato til slutdato (som BPLineChart).
  // Datoerne mappes via de faktiske datopunkter, så huller i målingerne ikke
  // forskubber "startede/stoppet"-markeringerne.
  const dayOf = (iso: string): string => iso.slice(0, 10);
  const dateFraction = (iso: string): number => {
    if (data.length === 1) return 0.5;
    const target = dayOf(iso);
    if (target <= dayOf(data[0].date)) return 0;
    if (target >= dayOf(data[data.length - 1].date)) return 1;
    for (let i = 0; i < data.length - 1; i++) {
      const a = dayOf(data[i].date);
      const b = dayOf(data[i + 1].date);
      if (target >= a && target <= b) {
        const span = new Date(b).getTime() - new Date(a).getTime();
        const frac = span <= 0 ? 0 : (new Date(target).getTime() - new Date(a).getTime()) / span;
        return (i + frac) / (data.length - 1);
      }
    }
    return 1;
  };
  const xAtFraction = (f: number): number =>
    data.length === 1 ? PAD.left + innerW / 2 : PAD.left + f * innerW;

  const medAreaTop = H + CHART_MED_GAP;
  medications.forEach((med, i) => {
    const rowTop = medAreaTop + i * CHART_MED_ROW_H;
    const lineY = rowTop + 5;
    const x1 = xAtFraction(med.startDate ? dateFraction(med.startDate) : 0);
    const x2 = Math.max(xAtFraction(med.endDate ? dateFraction(med.endDate) : 1), x1 + 3);
    const label = escapeXml((medLabel?.(med) ?? `${med.name} ${med.dose}`.trim()).slice(0, 74));

    // Hold etiketten inden for rammen: vend den mod højre kant når der ikke er plads
    const estW = label.length * 4.6; // ca. tekstbredde ved font-size 8.5
    const useEnd = x1 + 2 + estW > W - PAD.right;
    const labelX = useEnd
      ? Math.max(x2 - 2, PAD.left + estW)
      : Math.min(x1 + 2, W - PAD.right - estW);

    parts.push(
      `<g opacity="${med.active ? 1 : 0.5}">`,
      `<line x1="${x1}" x2="${x2}" y1="${lineY}" y2="${lineY}" stroke="${LINE_COLORS.medication}" stroke-width="2.5" stroke-linecap="round"${med.active ? "" : ' stroke-dasharray="3 2"'}/>`,
      med.endDate
        ? `<line x1="${x2}" x2="${x2}" y1="${lineY - 4}" y2="${lineY + 4}" stroke="${LINE_COLORS.medication}" stroke-width="1.5" opacity="0.8"/>`
        : `<polygon points="${x2},${lineY - 3} ${x2 + 4},${lineY} ${x2},${lineY + 3}" fill="${LINE_COLORS.medication}"/>`,
      `<text x="${labelX}" y="${rowTop + CHART_MED_ROW_H - 2}" text-anchor="${useEnd ? "end" : "start"}" font-size="8.5" fill="#6b7280">${label}</text>`,
      `</g>`
    );
  });

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}" viewBox="0 0 ${W} ${totalH}" font-family="sans-serif">` +
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

/**
 * Hent målingsbillede som dataURL + dimensioner (#49).
 * imageRef er enten et filnavn i scan-captures/ (serveres via /api/image),
 * en data-URL eller en http-URL (ældre målinger). Kaster ved fejl —
 * caller behandler billeder som best-effort.
 */
async function fetchImageForPdf(
  imageRef: string
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
  format: "JPEG" | "PNG";
}> {
  const src =
    imageRef.startsWith("data:") || imageRef.startsWith("http")
      ? imageRef
      : `/api/image/${encodeURIComponent(imageRef)}`;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`imageFetchFailed:${res.status}`);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("readFailed"));
    reader.readAsDataURL(blob);
  });
  const dims = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const img = new window.Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("decodeFailed"));
      img.src = dataUrl;
    }
  );
  return {
    dataUrl,
    width: dims.width,
    height: dims.height,
    format: dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG",
  };
}

export default function PdfExport({ readings, personName, medications }: Props) {
  const [generating, setGenerating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [danishDialogOpen, setDanishDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t, locale } = useI18n();
  const intlLocale = INTL_LOCALE[locale];

  // Luk menuen ved klik udenfor eller Escape (samme mønster som Navbar-popoveren)
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // #51: includeImages styrer om målingsbillederne (#49) skal med i rapporten
  const exportPdf = async (includeImages: boolean) => {
    setMenuOpen(false);
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
        doc.text(t("pdf.report"), margin, 8);
        doc.text(
          t("pdf.generated", { date: new Date().toLocaleString(intlLocale) }),
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
      doc.text(t("pdf.report"), margin, y + 5);
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

      doc.text(t("pdf.generated", { date: new Date().toLocaleString(intlLocale) }), margin, y);
      y += 5;

      // Alder info
      const ages = readings.map((r) => r.age).filter((a): a is number => a != null);
      if (ages.length > 0) {
        const uniqueAges = Array.from(new Set(ages));
        if (uniqueAges.length === 1) {
            doc.text(
              t("pdf.ageLine", {
                age: uniqueAges[0],
                group: t(getAgeGroupKey(uniqueAges[0])),
              }),
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
          t("pdf.medsLine", {
            meds: activeMeds.map((m) => `${m.name} ${m.dose}`).join(", "),
          }),
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
        doc.text(t("pdf.summary"), margin, y);
        y += 7;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");

        // Periode: første–sidste måling
        const first = new Date(sorted[0].createdAt);
        const last = new Date(sorted[sorted.length - 1].createdAt);
        const firstStr = first.toLocaleDateString(intlLocale);
        const lastStr = last.toLocaleDateString(intlLocale);
        doc.setTextColor(0);
        doc.text(
          firstStr === lastStr
            ? t("pdf.period", { range: firstStr })
            : t("pdf.period", { range: `${firstStr} – ${lastStr}` }),
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

        doc.text(t("pdf.count", { count: readings.length }), margin, y);
        y += 5;
        doc.text(t("pdf.avg", { sys: avgSys, dia: avgDia }), margin, y);
        y += 5;

        // Puls-gennemsnit kun hvis der findes pulsværdier
        const pulseValues = readings.map((r) => r.pulse).filter((p) => p > 0);
        if (pulseValues.length > 0) {
          const avgPulse = Math.round(pulseValues.reduce((s, p) => s + p, 0) / pulseValues.length);
          doc.text(t("pdf.avgPulse", { pulse: avgPulse }), margin, y);
          y += 5;
        }

        doc.text(t("pdf.sysMinMax", { min: minSys, max: maxSys }), margin, y);
        y += 5;
        doc.text(t("pdf.diaMinMax", { min: minDia, max: maxDia }), margin, y);
        y += 6;

        // Klassifikationsfordeling: getBPStatus pr. måling (med alder),
        // optalt pr. sværhedsgrad — samme fremgangsmåde som stats-API'en (#9)
        const severityOrder: Severity[] = ["normal", "elevated", "stage1", "stage2", "crisis"];
        const classMap = new Map<
          Severity,
          { severity: Severity; labelKey: string; count: number }
        >();
        for (const r of readings) {
          const status = getBPStatus(r.systolic, r.diastolic, r.age);
          const cur = classMap.get(status.severity) ?? {
            severity: status.severity,
            labelKey: status.labelKey,
            count: 0,
          };
          cur.count += 1;
          classMap.set(status.severity, cur);
        }
        const distribution = severityOrder
          .filter((s) => classMap.has(s))
          .map((s) => classMap.get(s)!);

        const distLabel = t("pdf.distribution");
        doc.setTextColor(100);
        doc.text(distLabel, margin, y);
        let dx = margin + doc.getTextWidth(distLabel) + 3;
        for (const seg of distribution) {
          const txt = `${t(seg.labelKey)}: ${seg.count}`;
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
        doc.text(t("pdf.overall", { label: t(avgStatus.labelKey) }), margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(t(avgStatus.descriptionKey), margin, y);
        y += 8;
      }

      // === Trenddiagram (best-effort: springes stille over hvis rasterisering fejler) ===
      try {
        const daily = computeDailyAverages(readings);
        if (daily.length >= 2) {
          const meds = medications ?? [];
          const svg = buildTrendChartSvg(
            daily,
            {
              sys: t("field.systolic"),
              dia: t("field.diastolic"),
              map: t("field.map"),
              pulse: t("field.pulse"),
            },
            meds,
            (med) =>
              t("chart.medLine", {
                name: med.name,
                dose: med.dose,
                start: formatMedicationDate(med.startDate ?? null) ?? t("meds.dateUnknown"),
                end: formatMedicationDate(med.endDate ?? null) ?? t("meds.ongoing"),
              })
          );
          // Diagrammet vokser med antallet af medicin-rækker, så højden følger med
          const chartHPx = trendChartHeightPx(meds.length);
          const chartHMm = (CHART_W_MM * chartHPx) / CHART_W_PX;
          const png = await rasterizeSvgToPng(svg, CHART_W_PX, chartHPx);
          if (png) {
            checkPage(chartHMm + 14);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(0);
            doc.text(t("pdf.dailyAverages"), margin, y);
            y += 4;
            doc.addImage(png, "PNG", margin, y, CHART_W_MM, chartHMm);
            y += chartHMm + 6;
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
        const tod = timeOfDayLabel(r.timeOfDay, locale);
        const arm = shortArmLabel(r.arm, locale);
        return [tod, arm].filter(Boolean).join(" ");
      };

      const drawTableHeader = () => {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text(t("pdf.colDate"), colDate, y);
        doc.text(t("pdf.colTime"), colTime, y);
        doc.text(t("pdf.colAge"), colAge, y);
        doc.text(t("pdf.colSys"), colSys, y);
        doc.text(t("pdf.colDia"), colDia, y);
        doc.text(t("pdf.colPulse"), colPulse, y);
        doc.text(t("pdf.colAssessment"), colStatus, y);
        if (hasTags) {
          doc.text(t("pdf.colTag"), colTag, y);
        }
        if (hasNotes) {
          doc.text(t("pdf.colNote"), colNote, y);
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
        doc.text(t(status.labelKey), colStatus, y);

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

      // === Billedside (#49): målingsbilleder på egne sider i samme PDF ===
      // #51: udelades helt når eksporten er bedt om uden billeder
      const withImages = includeImages
        ? sorted.filter((r) => r.image && r.image.trim() !== "")
        : [];
      if (withImages.length > 0) {
        const loaded = (
          await Promise.all(
            withImages.map(async (reading) => {
              try {
                return { reading, ...(await fetchImageForPdf(reading.image!)) };
              } catch {
                return null; // Billeder er best-effort — måling uden billede springes over
              }
            })
          )
        ).filter((x): x is NonNullable<typeof x> => x !== null);

        if (loaded.length > 0) {
          doc.addPage();
          addPageHeader();
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0);
          doc.text(t("pdf.images"), margin, margin + 5);

          // 2-kolonne grid: hvert billede passer i en celle på colW × MAX_IMG_H
          // (aspektforhold bevaret, centreret) med billedtekst (dato/tid + værdi) øverst.
          const COL_GAP = 6;
          const colW = (pageWidth - margin * 2 - COL_GAP) / 2;
          const MAX_IMG_H = 62;
          const CAPTION_H = 5;
          const CELL_H = CAPTION_H + MAX_IMG_H;
          const ROW_GAP = 7;
          const p2 = (n: number) => String(n).padStart(2, "0");

          let imgY = margin + 13;
          let col = 0;

          const startImagePage = () => {
            doc.addPage();
            addPageHeader();
            imgY = margin + 5;
            col = 0;
          };

          for (const item of loaded) {
            if (col === 0 && imgY + CELL_H > pageHeight - margin - 14) {
              startImagePage();
            }

            const ratio = item.height / item.width;
            const imgH = Math.min(MAX_IMG_H, colW * ratio);
            const imgW = Math.min(colW, MAX_IMG_H / ratio);
            const x =
              margin + col * (colW + COL_GAP) + (colW - imgW) / 2;

            const d = new Date(item.reading.createdAt);
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100);
            doc.text(
              `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p2(d.getHours())}:${p2(d.getMinutes())} — ${item.reading.systolic}/${item.reading.diastolic} mmHg, ${item.reading.pulse} bpm`,
              margin + col * (colW + COL_GAP),
              imgY + 3
            );
            doc.addImage(
              item.dataUrl,
              item.format,
              x,
              imgY + CAPTION_H + (MAX_IMG_H - imgH) / 2,
              imgW,
              imgH
            );

            if (col === 0) {
              col = 1;
            } else {
              col = 0;
              imgY += CELL_H + ROW_GAP;
            }
          }
        }
      }

      // Sidefod på alle sider: Blodtryk-branding + genereringsdato + sidenumre
      const generatedDate = new Date().toLocaleDateString(intlLocale);
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(200);
        doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text(t("pdf.brand"), margin, pageHeight - 8);
        doc.text(t("pdf.generated", { date: generatedDate }), pageWidth - margin, pageHeight - 8, {
          align: "right",
        });
        doc.text(t("pdf.pageOf", { page: i, total: totalPages }), pageWidth / 2, pageHeight - 8, {
          align: "center",
        });
      }

      const filename = exportFilename(personName ?? undefined, "pdf");

      doc.save(filename);
    } finally {
      setGenerating(false);
    }
  };

  // Dansk lægeskema: samme skemaformat, danske læger får fra web-patient.dk
  // (side 1 = opsummering, side 2+ = én skematabel pr. dag). Brugeren vælger
  // først perioden, som både afgrænser målingerne og vises i skemaet.
  const openDanishDialog = () => {
    setMenuOpen(false);
    setDanishDialogOpen(true);
  };

  const exportDanishReport = (period: DanishReportPeriod) => {
    setGenerating(true);
    try {
      const doc = createDanishReportPdf(readings, personName, period);
      doc.save(exportFilename(personName ?? undefined, "pdf", "laegeskema"));
      setDanishDialogOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  // Standardperiode: den periode målingerne dækker
  const danishDays = groupReadingsByDay(readings);
  const danishDefaultStart = danishDays.length ? danishDays[0].date : new Date();
  const danishDefaultEnd = danishDays.length ? danishDays[danishDays.length - 1].date : new Date();

  return (
    <>
    <div ref={menuRef} className="relative shrink-0">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        disabled={generating}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="inline-flex items-center justify-center min-h-[44px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-sm px-4 py-2 rounded-lg font-medium
                   hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all shadow-sm
                   disabled:opacity-50 disabled:cursor-wait"
      >
        📄 PDF
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-20 w-48 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-1.5"
        >
          <button
            role="menuitem"
            disabled={generating}
            onClick={() => exportPdf(true)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-900 dark:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {t("pdf.exportWithImages")}
          </button>
          <button
            role="menuitem"
            disabled={generating}
            onClick={() => exportPdf(false)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-900 dark:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {t("pdf.exportWithoutImages")}
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
          <button
            role="menuitem"
            disabled={generating}
            onClick={openDanishDialog}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-900 dark:text-gray-100
                       hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {t("pdf.exportDanishForm")}
          </button>
        </div>
      )}
    </div>

    {danishDialogOpen && (
      <DanishReportDialog
        readings={readings}
        defaultStart={danishDefaultStart}
        defaultEnd={danishDefaultEnd}
        busy={generating}
        onExport={exportDanishReport}
        onClose={() => setDanishDialogOpen(false)}
      />
    )}
    </>
  );
}
