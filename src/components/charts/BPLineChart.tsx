// Håndrullet SVG-linjediagram for blodtryk (#10) — ingen eksterne chart-biblioteker.
// Rener polyline + cirkler: ingen per-punkt React-state, så ~500+ målinger er OK.
"use client";

import { countKey } from "@/lib/i18n";
import { useI18n } from "@/lib/I18nProvider";
import { formatMedicationDate } from "@/lib/medicationDate";
import type { DailyAverage } from "@/types";

// Medicin-linjer under diagrammet: hvornår et præparat blev startet og stoppet
export interface MedicationLane {
  id: number;
  name: string;
  dose: string;
  startDate: string | null;
  endDate: string | null;
  active: boolean;
}

interface BPLineChartProps {
  data: DailyAverage[]; // daglige gennemsnit (allerede aggregeret fra stats-API'en)
  medications?: MedicationLane[]; // vises som vandrette linjer under x-aksen
  showSystolic: boolean;
  showDiastolic: boolean;
  showMap: boolean;
  showPulse: boolean;
}

// Farver deles med legenden på trends-siden
export const LINE_COLORS = {
  systolic: "#2563eb", // primary-600
  diastolic: "#0d9488", // teal-600
  map: "#f59e0b", // amber-500
  pulse: "#9333ea", // purple-600
  medication: "#db2777", // pink-600
} as const;

function getMapValue(sys: number, dia: number): number {
  return (sys + 2 * dia) / 3;
}

// Fast viewBox — skalerer responsivt via CSS (w-full h-auto)
const WIDTH = 360;
const HEIGHT = 220;
const PAD = { top: 12, right: 10, bottom: 24, left: 34 };
// Medicin-bånd under x-aksen: én række pr. præparat
const MED_GAP = 8;
const MED_ROW_H = 14;
const MED_PAD_BOTTOM = 3; // luft under nederste etiket, så descender ikke klippes

// Y-akse: "pæne" trin (multipla af 5) med luft i kanterne
function niceScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  const span = Math.max(20, max - min);
  const step = Math.max(5, Math.ceil(span / 4 / 5) * 5);
  const lo = Math.floor((min - span * 0.05) / step) * step;
  const hi = Math.ceil((max + span * 0.05) / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi; t += step) ticks.push(t);
  return { lo, hi, ticks };
}

// Dansk kort dato: "20/8"
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export default function BPLineChart({
  data,
  medications,
  showSystolic,
  showDiastolic,
  showMap,
  showPulse,
}: BPLineChartProps) {
  const { t } = useI18n();
  if (data.length === 0) return null;

  const meds = medications ?? [];
  const medAreaTop = HEIGHT + MED_GAP;
  const totalHeight =
    HEIGHT + (meds.length > 0 ? MED_GAP + meds.length * MED_ROW_H + MED_PAD_BOTTOM : 0);

  const values: number[] = [];
  for (const p of data) {
    if (showSystolic) values.push(p.sysAvg);
    if (showDiastolic) values.push(p.diaAvg);
    if (showMap) values.push(getMapValue(p.sysAvg, p.diaAvg));
    if (showPulse) values.push(p.pulseAvg);
  }
  if (values.length === 0) values.push(0, 100);

  const { lo, hi, ticks } = niceScale(Math.min(...values), Math.max(...values));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;

  const xAt = (i: number): number =>
    PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number): number => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const toPoints = (get: (p: DailyAverage) => number): string =>
    data.map((p, i) => `${xAt(i)},${yAt(get(p))}`).join(" ");

  // Medicin-datoer mappes til x-positioner via de faktiske datopunkter, så huller
  // i målingerne ikke forskubber "startede/stoppet"-markeringerne.
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

  const labelIndexes = new Set<number>();
  if (data.length <= 8) {
    for (let i = 0; i < data.length; i++) labelIndexes.add(i);
  } else {
    labelIndexes.add(0);
    labelIndexes.add(data.length - 1);
    if (data.length > 2) labelIndexes.add(Math.floor((data.length - 1) / 2));
    const step = Math.max(1, Math.ceil(data.length / 6));
    for (let i = step; i < data.length - 1; i += step) labelIndexes.add(i);
    if (data.length > 8) {
      labelIndexes.add(Math.floor((data.length - 1) / 4));
      labelIndexes.add(Math.floor((3 * (data.length - 1)) / 4));
    }
  }

  const showDots = data.length <= 62;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${totalHeight}`}
      className="w-full h-auto text-gray-200 dark:text-gray-700"
      role="img"
      aria-label={t("chart.lineAria")}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={yAt(t)}
            y2={yAt(t)}
            stroke="currentColor"
            strokeWidth="1"
          />
          <text x={PAD.left - 4} y={yAt(t) + 3} textAnchor="end" fontSize="9" fill="#9ca3af">
            {t}
          </text>
        </g>
      ))}

      {showDiastolic && (
        <polyline
          points={toPoints((p) => p.diaAvg)}
          fill="none"
          stroke={LINE_COLORS.diastolic}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {showSystolic && (
        <polyline
          points={toPoints((p) => p.sysAvg)}
          fill="none"
          stroke={LINE_COLORS.systolic}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {showMap && (
        <polyline
          points={toPoints((p) => getMapValue(p.sysAvg, p.diaAvg))}
          fill="none"
          stroke={LINE_COLORS.map}
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {showPulse && (
        <polyline
          points={toPoints((p) => p.pulseAvg)}
          fill="none"
          stroke={LINE_COLORS.pulse}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {showDots &&
        data.map((p, i) => (
          <g key={p.date}>
            {showDiastolic && (
              <circle cx={xAt(i)} cy={yAt(p.diaAvg)} r="2.5" fill={LINE_COLORS.diastolic}>
                <title>
                  {t("chart.dot", {
                    date: shortDate(p.date),
                    field: t("field.diastolic"),
                    value: p.diaAvg,
                    readings: t(countKey("chart.reading", p.count), { count: p.count }),
                  })}
                </title>
              </circle>
            )}
            {showSystolic && (
              <circle cx={xAt(i)} cy={yAt(p.sysAvg)} r="2.5" fill={LINE_COLORS.systolic}>
                <title>
                  {t("chart.dot", {
                    date: shortDate(p.date),
                    field: t("field.systolic"),
                    value: p.sysAvg,
                    readings: t(countKey("chart.reading", p.count), { count: p.count }),
                  })}
                </title>
              </circle>
            )}
            {showMap && (
              <circle cx={xAt(i)} cy={yAt(getMapValue(p.sysAvg, p.diaAvg))} r="2.2" fill={LINE_COLORS.map}>
                <title>
                  {t("chart.dotPlain", {
                    date: shortDate(p.date),
                    field: t("field.map"),
                    value: Math.round(getMapValue(p.sysAvg, p.diaAvg)),
                  })}
                </title>
              </circle>
            )}
            {showPulse && (
              <circle cx={xAt(i)} cy={yAt(p.pulseAvg)} r="2" fill={LINE_COLORS.pulse}>
                <title>
                  {t("chart.dotPlain", {
                    date: shortDate(p.date),
                    field: t("field.pulse"),
                    value: p.pulseAvg,
                  })}
                </title>
              </circle>
            )}
          </g>
        ))}

      {Array.from(labelIndexes).map((i) => (
        <text
          key={`x-${i}`}
          x={xAt(i)}
          y={HEIGHT - 6}
          textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          fontSize="9"
          fill="#9ca3af"
        >
          {shortDate(data[i].date)}
        </text>
      ))}

      {/* Medicin: vandret linje pr. præparat fra startdato til slutdato */}
      {meds.map((med, i) => {
        const rowTop = medAreaTop + i * MED_ROW_H;
        const lineY = rowTop + 4;
        const x1 = xAtFraction(med.startDate ? dateFraction(med.startDate) : 0);
        const x2 = Math.max(
          xAtFraction(med.endDate ? dateFraction(med.endDate) : 1),
          x1 + 3
        );
        const label = `${med.name} ${med.dose}`.trim();
        const title = t("chart.medLine", {
          name: med.name,
          dose: med.dose,
          start: formatMedicationDate(med.startDate) ?? t("meds.dateUnknown"),
          end: formatMedicationDate(med.endDate) ?? t("meds.ongoing"),
        });
        // Hold etiketten inden for rammen: vend den mod højre kant når der ikke er plads
        const anchorEnd = x1 + 4 + label.length * 3.9 > WIDTH - PAD.right;

        return (
          <g key={med.id} opacity={med.active ? 1 : 0.5}>
            <line
              x1={x1}
              x2={x2}
              y1={lineY}
              y2={lineY}
              stroke={LINE_COLORS.medication}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={med.active ? undefined : "3 2"}
            >
              <title>{title}</title>
            </line>
            {med.endDate ? (
              <line
                x1={x2}
                x2={x2}
                y1={lineY - 4}
                y2={lineY + 4}
                stroke={LINE_COLORS.medication}
                strokeWidth="1.5"
                opacity="0.8"
              />
            ) : (
              <polygon
                points={`${x2},${lineY - 3} ${x2 + 4},${lineY} ${x2},${lineY + 3}`}
                fill={LINE_COLORS.medication}
              />
            )}
            <text
              x={anchorEnd ? x2 - 2 : x1 + 2}
              y={rowTop + MED_ROW_H - 2}
              textAnchor={anchorEnd ? "end" : "start"}
              fontSize="7.5"
              fill="#9ca3af"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
