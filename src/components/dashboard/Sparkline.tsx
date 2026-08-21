// Mini-sparkline til dashboard (#17) — håndrullet SVG, ingen eksterne chart-biblioteker.
// Én systolisk polyline (~120px bred), ingen akser — kun valgfri prik på sidste punkt.
import { LINE_COLORS } from "@/components/charts/BPLineChart";

interface SparklineProps {
  values: number[]; // daglige systolisk-gennemsnit (ældste → nyeste)
  width?: number;
  height?: number;
}

export default function Sparkline({ values, width = 120, height = 36 }: SparklineProps) {
  if (values.length === 0) return null;

  const PAD = 3; // luft så prik/streg ikke klippes i kanten
  const innerW = width - PAD * 2;
  const innerH = height - PAD * 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  // Flad kurve (alle værdier ens) centreres i stedet for at dividere med 0
  const span = max - min;

  const xAt = (i: number): number =>
    values.length === 1 ? PAD + innerW / 2 : PAD + (i / (values.length - 1)) * innerW;
  const yAt = (v: number): number =>
    span === 0 ? height / 2 : PAD + innerH - ((v - min) / span) * innerH;

  const points = values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(" ");
  const last = values.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto"
      style={{ width }}
      role="img"
      aria-label="Mini-graf over systolisk blodtryk de seneste dage"
    >
      <polyline
        points={points}
        fill="none"
        stroke={LINE_COLORS.systolic}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Fremhæv kun det seneste målepunkt */}
      <circle cx={xAt(last)} cy={yAt(values[last])} r="3" fill={LINE_COLORS.systolic} />
    </svg>
  );
}
