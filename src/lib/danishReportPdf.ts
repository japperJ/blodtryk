// Dansk lægeskema-PDF: genskaber det skema, danske læger er vant til
// (web-patient.dk-formatet), så tæt som muligt — samme A4-geometri, farver,
// skriftstørrelser og tabelopbygning som reference-PDF'en "blodtryks skema.pdf".
//
// Alle mål er i punkter (1 pt = 1/72 tomme) og aflæst direkte fra originalen.
// Modulet har bevidst kun jsPDF som afhængighed (typer importeres type-only),
// så det kan kompileres og verificeres standalone mod reference-PDF'en.
//
// Sådan læses originalen:
//   side 1 = OPSUMMERING (analyse-tabel + tabel med gennemsnit/variation/normal)
//   side 2+ = "Startdato" og én blok pr. dag ("Dag N") med morgen/aften-skemaer
//
// Opsummeringen i originalen udelader første måledag (verificeret: alle
// gennemsnit, min/maks og variationer svarer til dag 2 og frem).
import jsPDF from "jspdf";
import type { Reading } from "@/types";

type RGB = [number, number, number];
type Slot = "morning" | "evening";
type ParameterKey = "systolic" | "diastolic" | "pulse";

// ------------------------------------------------------- side + farver
// Sidestørrelse: identisk med originalen (A4 afrundet til hele punkter)
const PAGE_W = 595;
const PAGE_H = 842;

const NAVY: RGB = [0, 55, 101];
const BAND: RGB = [230, 235, 240];
const GRID: RGB = [222, 226, 230];
const TEXT: RGB = [33, 37, 41];
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
const INPUT_BORDER: RGB = [221, 221, 221];

// ---------------------------------------------------------------- typografi
const BORDER = 0.8;
const SIZE_BODY = 9.6;
const SIZE_CELL = 8;
const SIZE_VALUE = 12;
const SIZE_FOOTER = 12;

// ------------------------------------------------- fælles bjælke + sidefod
const BAR_X = 39.2;
const BAR_W = 516.8;
const BAR_H = 20;
const BAR_TEXT_X = 41.6;
const BAR_TEXT_BASE = 12.8; // baseline i forhold til bjælkens top

const FOOTER = { x: 14.4, y: 797.6, w: 571.2, h: 28.8, textLeft: 21.6, textRight: 577.2, base: 816 };

// Tynn ramme om indholdsblokkene (i originalen en del af baggrundsbilledet)
const FRAME_X = 38.4;
const FRAME_W = 518.4;
const FRAME_H = 136; // højde på en dagsblok

// ---------------------------------------------------------------- side 1
const SUMMARY_BAR_TOP = 102.4;
const SUMMARY_FRAME_TOP = 101.6;
const SUMMARY_FRAME_H = 301.6;
const TITLE = { x: 45.6, base: 43.2 };
const PERSON = { x: 45.6, base: 72 };
const SENT = { right: 521.0, base: 86.4 };

// Analyse-tabel (OPSUMMERING): Analysenavn | Værdi | Analysekode
const ANALYSIS_TOP = 124.8;
const ANALYSIS_ROW_H = 19.2;
const ANALYSIS_COLUMNS: Array<[number, number]> = [
  [41.6, 349.6],
  [349.6, 451.2],
  [451.2, 552.8],
];
const ANALYSIS_LABEL_X = 50.4;
const ANALYSIS_VALUE_RIGHT = 447;
const ANALYSIS_CODE_RIGHT = 548.5;
// Faste analysekoder fra behandlerformatet
const ANALYSIS_ROWS: Array<{ label: string; code: string; key: ParameterKey }> = [
  { label: "Arm-Blodtryk,hjemme(systolisk)", code: "MCS88019", key: "systolic" },
  { label: "Arm-Blodtryk,hjemme(diastolisk)", code: "MCS88020", key: "diastolic" },
  { label: "Puls;Hjerte", code: "NPU21692", key: "pulse" },
];

// Gennemsnits-tabel: Hjemme-blodtryk | Gennemsnit | Variation | Normal
const AVERAGE_TOP = 207.2;
const AVERAGE_ROW_H = 19.2;
const AVERAGE_COLUMNS: Array<[number, number]> = [
  [41.6, 248],
  [248, 349.6],
  [349.6, 451.2],
  [451.2, 552.8],
];
const AVERAGE_LABEL_X = 50.4;
const AVERAGE_HEADER_RIGHT = [345.3, 446.9, 548.5];
const AVERAGE_VALUE_RIGHT = [346.1, 447.7, 549.8];
const TABLE_TEXT_BASE = 12.8; // baseline i forhold til rækkens top (8 pt tekst)

// Hjemmeblodtryk-mål og normalområde for puls (faste referenceværdier)
const TARGETS: Record<ParameterKey, string> = {
  systolic: "< 135 mm Hg",
  diastolic: "< 85 mm Hg",
  pulse: "60-80 pr min",
};
const UNIT: Record<ParameterKey, string> = { systolic: "mm Hg", diastolic: "mm Hg", pulse: "pr min" };

// ---------------------------------------------------------------- side 2+
const START_DATE_LABEL = { x: 38.4, base: 24 };
const START_DATE_BOX = { x: 38.4, y: 32, w: 112, h: 17.6 };
const START_DATE_TEXT = { x: 40.8, base: 44 };

const DAY_BAR_TOP = 61.6;
const DAY_BLOCK_PITCH = 140.8;
const DAY_TABLE_TOP_OFFSET = 22.4; // bjælkens top -> tabellens top
const DAY_ROW_H = 27.2;
const DAY_HEADER_BASE = 14.4; // i forhold til tabellens top
const DAY_LABEL_BASE = 41.6;
const DAY_VALUE_BASE = 44.8;
// Blokken er 132 pt høj (bjælke + tabel); 5 blokke pr. side holder sig over sidefoden
const DAY_BLOCKS_PER_PAGE = 5;

// Kolonnebredder: Morgen | 1.-3. måling | Aften | 1.-3. måling
const DAY_COLUMNS: Array<[number, number]> = [
  [41.6, 136],
  [136, 189.6],
  [189.6, 243.2],
  [243.2, 296.8],
  [297.6, 392],
  [392, 445.6],
  [445.6, 499.2],
  [499.2, 552.8],
];
const DAY_HEADER_LABELS: Array<[number, string]> = [
  [45.6, "Morgen"],
  [142.4, "1. måling"],
  [196, "2. måling"],
  [249.6, "3. måling"],
  [301.6, "Aften"],
  [398.4, "1. måling"],
  [452, "2. måling"],
  [505.6, "3. måling"],
];
const DAY_LABEL_X: [number, number] = [45.6, 301.6];
const DAY_VALUE_X: [[number, number, number], [number, number, number]] = [
  [146.4, 200, 253.6],
  [402.4, 456, 509.6],
];
const DAY_ROWS: Array<{ label: string; key: ParameterKey }> = [
  { label: "Systolisk blodtryk", key: "systolic" },
  { label: "Diastolisk blodtryk", key: "diastolic" },
  { label: "Puls", key: "pulse" },
];
const MAX_PER_SLOT = 3;

// ---------------------------------------------------------------- datamodel

export interface DanishReportDay {
  dateKey: string; // YYYY-MM-DD (lokal tid)
  date: Date;
  morning: Reading[];
  evening: Reading[];
}

export interface DanishParameterSummary {
  avg: number | null;
  min: number | null;
  max: number | null;
  morning: number | null;
  evening: number | null;
}

export interface DanishReportSummary {
  systolic: DanishParameterSummary;
  diastolic: DanishParameterSummary;
  pulse: DanishParameterSummary;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Lokal kalenderdag som YYYY-MM-DD. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Morgen/aften ud fra tag; mangler tagget, bruges klokketiden (før 12 = morgen). */
function slotOf(r: Reading): Slot {
  if (r.timeOfDay === "morning" || r.timeOfDay === "evening") return r.timeOfDay;
  return new Date(r.createdAt).getHours() < 12 ? "morning" : "evening";
}

/**
 * Gruppér målinger pr. lokal dag i kronologisk rækkefølge og fordel dem på
 * morgen/aften. Hver session vises med op til 3 målinger ("1.-3. måling"),
 * ligesom i originalen.
 */
export function groupReadingsByDay(readings: Reading[]): DanishReportDay[] {
  const sorted = [...readings].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const byDay = new Map<string, Reading[]>();
  for (const r of sorted) {
    const key = dayKey(new Date(r.createdAt));
    const list = byDay.get(key);
    if (list) list.push(r);
    else byDay.set(key, [r]);
  }
  // Map.forEach bevarer indsættelsesrækkefølgen, så dagene kommer kronologisk
  const days: DanishReportDay[] = [];
  byDay.forEach((list: Reading[], key: string) => {
    days.push({
      dateKey: key,
      date: new Date(list[0].createdAt),
      morning: list.filter((r: Reading) => slotOf(r) === "morning").slice(0, MAX_PER_SLOT),
      evening: list.filter((r: Reading) => slotOf(r) === "evening").slice(0, MAX_PER_SLOT),
    });
  });
  return days;
}

/** Gennemsnit som i originalen: afrundet nedad (137,8 -> 137). */
function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.floor(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function parameterSummary(readings: Reading[], key: ParameterKey): DanishParameterSummary {
  const pick = (r: Reading) => r[key];
  const values = readings.map(pick);
  return {
    avg: mean(values),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    morning: mean(readings.filter((r) => slotOf(r) === "morning").map(pick)),
    evening: mean(readings.filter((r) => slotOf(r) === "evening").map(pick)),
  };
}

/**
 * Opsummering til side 1. Som i originalen udelades første måledag, så
 * "førstedagens" typisk forhøjede værdier ikke farver gennemsnittet.
 * Findes der kun én dag, bruges alle målinger (ellers ville siden være tom).
 */
export function computeDanishSummary(
  readings: Reading[],
  days: DanishReportDay[] = groupReadingsByDay(readings)
): DanishReportSummary {
  const firstDayKey = days.length > 1 ? days[0].dateKey : null;
  const included = firstDayKey
    ? readings.filter((r) => dayKey(new Date(r.createdAt)) !== firstDayKey)
    : readings;
  return {
    systolic: parameterSummary(included, "systolic"),
    diastolic: parameterSummary(included, "diastolic"),
    pulse: parameterSummary(included, "pulse"),
  };
}

// ---------------------------------------------------------------- tegning

function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: RGB): void {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(x, y, w, h, "F");
}

interface TextOptions {
  size: number;
  color: RGB;
  bold?: boolean;
  align?: "left" | "right";
}

function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  baseline: number,
  opts: TextOptions
): void {
  if (!text) return;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal");
  doc.setFontSize(opts.size);
  doc.setTextColor(opts.color[0], opts.color[1], opts.color[2]);
  doc.text(text, x, baseline, { align: opts.align ?? "left" });
}

/** Rækketoppe inkl. den nederste ramme: én pr. række + 1. */
function rowTops(top: number, height: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => top + height * i);
}

/** Mørkeblå sektionsbjælke med hvid titel ("OPSUMMERING", "Dag 1", ...). */
function drawSectionBar(doc: jsPDF, top: number, title: string): void {
  fillRect(doc, BAR_X, top, BAR_W, BAR_H, NAVY);
  drawText(doc, title, BAR_TEXT_X, top + BAR_TEXT_BASE, { size: SIZE_BODY, color: WHITE });
}

/** Tynn #DEE2E6-ramme om en indholdsblok (0,8 pt, tegnet som fire fyldte kanter). */
function drawBlockFrame(doc: jsPDF, top: number, height: number): void {
  const right = FRAME_X + FRAME_W - BORDER;
  fillRect(doc, FRAME_X, top, FRAME_W, BORDER, GRID);
  fillRect(doc, FRAME_X, top + height - BORDER, FRAME_W, BORDER, GRID);
  fillRect(doc, FRAME_X, top, BORDER, height, GRID);
  fillRect(doc, right, top, BORDER, height, GRID);
}

/**
 * Tabelgitter som i originalen: 0,8 pt rammer i #DEE2E6, hvor de lodrette
 * rammer løber fra tabeltoppen til underkanten af den nederste ramme, og de
 * vandrette rammer spænder til yderkanten (sidste kolonne + 0,8 pt).
 */
function drawTable(
  doc: jsPDF,
  columns: Array<[number, number]>,
  tops: number[],
  bandHeader: boolean
): void {
  const left = columns[0][0];
  const rightEdge = columns[columns.length - 1][1] + BORDER;
  const top = tops[0];
  const bottom = tops[tops.length - 1] + BORDER;

  if (bandHeader) {
    const h = tops[1] - tops[0];
    for (const [x0, x1] of columns) fillRect(doc, x0, top, x1 - x0, h, BAND);
  }
  for (const y of tops) fillRect(doc, left, y, rightEdge - left, BORDER, GRID);
  for (const [x0] of columns) fillRect(doc, x0, top, BORDER, bottom - top, GRID);
  fillRect(doc, columns[columns.length - 1][1], top, BORDER, bottom - top, GRID);
}

/** "14/09/2026 09:50" — samme format som originalen. */
function formatSentAt(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

/** "9/9/2026" — samme format som originalens startdato-felt. */
function formatShortDate(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatAverage(value: number | null, key: ParameterKey): string | null {
  return value === null ? null : `${value} ${UNIT[key]}`;
}

function formatVariation(p: DanishParameterSummary, key: ParameterKey): string | null {
  if (p.min === null || p.max === null) return null;
  return `${p.min}-${p.max} ${UNIT[key]}`;
}

function renderSummaryPage(doc: jsPDF, summary: DanishReportSummary, name: string): void {
  drawText(doc, "Hjemmeblodtryk", TITLE.x, TITLE.base, { size: SIZE_BODY, color: TEXT, bold: true });
  drawText(doc, name, PERSON.x, PERSON.base, { size: SIZE_BODY, color: TEXT });
  drawText(doc, `Sendt til behandler: ${formatSentAt(new Date())}`, SENT.right, SENT.base, {
    size: SIZE_BODY,
    color: TEXT,
    align: "right",
  });

  // --- OPSUMMERING ---
  drawBlockFrame(doc, SUMMARY_FRAME_TOP, SUMMARY_FRAME_H);
  drawSectionBar(doc, SUMMARY_BAR_TOP, "OPSUMMERING");
  drawTable(
    doc,
    ANALYSIS_COLUMNS,
    rowTops(ANALYSIS_TOP, ANALYSIS_ROW_H, ANALYSIS_ROWS.length + 2),
    true
  );
  const headerBase = ANALYSIS_TOP + TABLE_TEXT_BASE;
  drawText(doc, "Analysenavn", ANALYSIS_LABEL_X, headerBase, {
    size: SIZE_CELL,
    color: BLACK,
    bold: true,
  });
  drawText(doc, "Værdi", ANALYSIS_VALUE_RIGHT, headerBase, {
    size: SIZE_CELL,
    color: BLACK,
    bold: true,
    align: "right",
  });
  drawText(doc, "Analysekode", ANALYSIS_CODE_RIGHT, headerBase, {
    size: SIZE_CELL,
    color: BLACK,
    bold: true,
    align: "right",
  });
  ANALYSIS_ROWS.forEach((row, i) => {
    const base = ANALYSIS_TOP + ANALYSIS_ROW_H * (i + 1) + TABLE_TEXT_BASE;
    const value = summary[row.key].avg;
    drawText(doc, row.label, ANALYSIS_LABEL_X, base, { size: SIZE_CELL, color: TEXT });
    drawText(doc, value === null ? "-" : String(value), ANALYSIS_VALUE_RIGHT, base, {
      size: SIZE_CELL,
      color: TEXT,
      align: "right",
    });
    drawText(doc, row.code, ANALYSIS_CODE_RIGHT, base, { size: SIZE_CELL, color: TEXT, align: "right" });
  });

  // --- Hjemme-blodtryk: gennemsnit / variation / normal ---
  const rows: Array<[string, ParameterKey, string | null, string | null, string | null]> = [];
  for (const key of ["systolic", "diastolic", "pulse"] as ParameterKey[]) {
    const p = summary[key];
    const label = key === "pulse" ? "Puls:" : key === "systolic" ? "Systolisk blodtryk:" : "Diastolisk blodtryk:";
    rows.push([label, key, formatAverage(p.avg, key), formatVariation(p, key), TARGETS[key]]);
    rows.push(["- morgen:", key, formatAverage(p.morning, key), null, null]);
    rows.push(["- aften:", key, formatAverage(p.evening, key), null, null]);
  }
  drawTable(doc, AVERAGE_COLUMNS, rowTops(AVERAGE_TOP, AVERAGE_ROW_H, rows.length + 2), true);
  const avgHeaderBase = AVERAGE_TOP + TABLE_TEXT_BASE;
  drawText(doc, "Hjemme-blodtryk", AVERAGE_LABEL_X, avgHeaderBase, {
    size: SIZE_CELL,
    color: BLACK,
    bold: true,
  });
  ["Gennemsnit", "Variation", "Normal"].forEach((title, i) => {
    drawText(doc, title, AVERAGE_HEADER_RIGHT[i], avgHeaderBase, {
      size: SIZE_CELL,
      color: BLACK,
      bold: true,
      align: "right",
    });
  });
  rows.forEach(([label, , average, variation, normal], i) => {
    const base = AVERAGE_TOP + AVERAGE_ROW_H * (i + 1) + TABLE_TEXT_BASE;
    drawText(doc, label, AVERAGE_LABEL_X, base, { size: SIZE_CELL, color: TEXT });
    [average, variation, normal].forEach((value, col) => {
      if (value === null) return;
      drawText(doc, value, AVERAGE_VALUE_RIGHT[col], base, {
        size: SIZE_CELL,
        color: TEXT,
        align: "right",
      });
    });
  });
}

/** "Startdato"-feltet øverst på første dagsoversigt. */
function renderStartDate(doc: jsPDF, date: Date): void {
  drawText(doc, "Startdato", START_DATE_LABEL.x, START_DATE_LABEL.base, { size: SIZE_CELL, color: TEXT });
  const { x, y, w, h } = START_DATE_BOX;
  fillRect(doc, x, y, w, h, WHITE);
  fillRect(doc, x, y, w, BORDER, INPUT_BORDER);
  fillRect(doc, x, y + h - BORDER, w, BORDER, INPUT_BORDER);
  fillRect(doc, x, y, BORDER, h, INPUT_BORDER);
  fillRect(doc, x + w - BORDER, y, BORDER, h, INPUT_BORDER);
  drawText(doc, formatShortDate(date), START_DATE_TEXT.x, START_DATE_TEXT.base, {
    size: SIZE_BODY,
    color: BLACK,
  });
}

/** Én "Dag N"-blok: bjælke + skema med morgen/aften-målinger. */
function renderDayBlock(doc: jsPDF, day: DanishReportDay, dayNumber: number, barTop: number): void {
  drawBlockFrame(doc, barTop - BORDER, FRAME_H);
  drawSectionBar(doc, barTop, `Dag ${dayNumber}`);
  const top = barTop + DAY_TABLE_TOP_OFFSET;
  drawTable(doc, DAY_COLUMNS, rowTops(top, DAY_ROW_H, DAY_ROWS.length + 2), true);

  const headerBase = top + DAY_HEADER_BASE;
  for (const [x, label] of DAY_HEADER_LABELS) {
    drawText(doc, label, x, headerBase, { size: SIZE_CELL, color: TEXT, bold: true });
  }

  DAY_ROWS.forEach((row, rowIndex) => {
    const labelBase = top + DAY_LABEL_BASE + DAY_ROW_H * rowIndex;
    const valueBase = top + DAY_VALUE_BASE + DAY_ROW_H * rowIndex;
    (["morning", "evening"] as Slot[]).forEach((slot, slotIndex) => {
      drawText(doc, row.label, DAY_LABEL_X[slotIndex], labelBase, { size: SIZE_CELL, color: TEXT });
      const session = day[slot];
      for (let i = 0; i < MAX_PER_SLOT; i++) {
        const reading = session[i];
        if (!reading) continue;
        drawText(doc, String(reading[row.key]), DAY_VALUE_X[slotIndex][i], valueBase, {
          size: SIZE_VALUE,
          color: BLACK,
        });
      }
    });
  });
}

function renderDayPages(doc: jsPDF, days: DanishReportDay[]): void {
  const pageCount = Math.max(1, Math.ceil(days.length / DAY_BLOCKS_PER_PAGE));
  for (let page = 0; page < pageCount; page++) {
    doc.addPage();
    if (page === 0 && days.length > 0) renderStartDate(doc, days[0].date);
    const pageDays = days.slice(page * DAY_BLOCKS_PER_PAGE, (page + 1) * DAY_BLOCKS_PER_PAGE);
    pageDays.forEach((day, i) => {
      renderDayBlock(doc, day, page * DAY_BLOCKS_PER_PAGE + i + 1, DAY_BAR_TOP + i * DAY_BLOCK_PITCH);
    });
  }
}

function renderFooters(doc: jsPDF, name: string, totalPages: number): void {
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    fillRect(doc, FOOTER.x, FOOTER.y, FOOTER.w, FOOTER.h, BAND);
    drawText(doc, name, FOOTER.textLeft, FOOTER.base, { size: SIZE_FOOTER, color: BLACK });
    drawText(doc, `side ${page} af ${totalPages}`, FOOTER.textRight, FOOTER.base, {
      size: SIZE_FOOTER,
      color: BLACK,
      align: "right",
    });
  }
}

/**
 * Byg den danske lægeskema-PDF (A4, side 1 = opsummering, side 2+ = dage).
 * Returnerer dokumentet, så kalderen selv kan gemme det med et passende navn.
 */
export function createDanishReportPdf(readings: Reading[], personName?: string | null): jsPDF {
  // Præcis samme sidestørrelse som originalen (595 x 842 pt), ikke jsPDF's "a4"
  // (595,28 x 841,89), så geometrien kan sammenlignes 1:1.
  const doc = new jsPDF({ unit: "pt", format: [PAGE_W, PAGE_H] });
  const name = (personName ?? "").trim();
  const days = groupReadingsByDay(readings);
  const summary = computeDanishSummary(readings, days);
  const totalPages = 1 + Math.max(1, Math.ceil(days.length / DAY_BLOCKS_PER_PAGE));

  renderSummaryPage(doc, summary, name);
  renderDayPages(doc, days);
  renderFooters(doc, name, totalPages);
  return doc;
}
