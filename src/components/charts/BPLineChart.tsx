// Håndrullet SVG-linjediagram for blodtryk (#10) — ingen eksterne chart-biblioteker.
// Rener polyline + cirkler: ingen per-punkt React-state, så ~500+ målinger er OK.
"use client";

import { countKey } from "@/lib/i18n";
import { useI18n } from "@/lib/I18nProvider";
import type { DailyAverage } from "@/types";

// Målbånd (grøn zone) for personens aldersgruppe — se getTargetBand i app/trends/page.tsx
export interface TargetBand {
  sysMin: number;
  sysMax: number;
  diaMin: number;
  diaMax: number;
  mapMin?: number;
  mapMax?: number;
}

interface BPLineChartProps {
  data: DailyAverage[]; // daglige gennemsnit (allerede aggregeret fra stats-API'en)
  band: TargetBand;
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
  band: "#22c55e", // green-500
} as const;

function getMapValue(sys: number, dia: number): number {
  return (sys + 2 * dia) / 3;
}

// Fast viewBox — skalerer responsivt via CSS (w-full h-auto)
const WIDTH = 360;
const HEIGHT = 220;
const PAD = { top: 12, right: 10, bottom: 24, left: 34 };

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
  band,
  showSystolic,
  showDiastolic,
  showMap,
  showPulse,
}: BPLineChartProps) {
  const { t } = useI18n();
  if (data.length === 0) return null;

  const values: number[] = [];
  if (showSystolic) values.push(band.sysMin, band.sysMax);
  if (showDiastolic) values.push(band.diaMin, band.diaMax);
  if (showMap && band.mapMin != null && band.mapMax != null) {
    values.push(band.mapMin, band.mapMax);
  }
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
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
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

      <rect
        x={PAD.left}
        y={yAt(band.sysMax)}
        width={innerW}
        height={Math.max(1, yAt(band.sysMin) - yAt(band.sysMax))}
        fill={LINE_COLORS.band}
        opacity="0.10"
      >
        <title>{t("chart.bandSys", { min: band.sysMin, max: band.sysMax })}</title>
      </rect>
      <rect
        x={PAD.left}
        y={yAt(band.diaMax)}
        width={innerW}
        height={Math.max(1, yAt(band.diaMin) - yAt(band.diaMax))}
        fill={LINE_COLORS.band}
        opacity="0.06"
      >
        <title>{t("chart.bandDia", { min: band.diaMin, max: band.diaMax })}</title>
      </rect>
      {showMap && band.mapMin != null && band.mapMax != null && (
        <rect
          x={PAD.left}
          y={yAt(band.mapMax)}
          width={innerW}
          height={Math.max(1, yAt(band.mapMin) - yAt(band.mapMax))}
          fill={LINE_COLORS.band}
          opacity="0.12"
        >
          <title>{t("chart.bandMap", { min: band.mapMin, max: band.mapMax })}</title>
        </rect>
      )}

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
    </svg>
  );
}
