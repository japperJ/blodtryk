// Horisontal stablet søjle for klassificerings-fordeling (#10).
// Farver matcher sværhedsgradernes palet i lib/bpClassification.ts.
"use client";

import type { Severity } from "@/lib/bpClassification";

export interface ClassificationSegment {
  severity: Severity;
  label: string;
  count: number;
}

interface DistributionBarProps {
  segments: ClassificationSegment[];
}

// Søjle-/prikkfarver pr. sværhedsgrad (samme familie som bpClassification-badge-farver)
const SEVERITY_COLORS: Record<Severity, string> = {
  normal: "bg-green-500",
  elevated: "bg-yellow-400",
  stage1: "bg-orange-400",
  stage2: "bg-red-500",
  crisis: "bg-red-600",
};

export default function DistributionBar({ segments }: DistributionBarProps) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  return (
    <div>
      {/* Stablet søjle — brede segmenter får mindst 6px så små andele forbliver synlige */}
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        {segments.map((s) => (
          <div
            key={s.severity}
            className={`h-full ${SEVERITY_COLORS[s.severity]}`}
            style={{
              width: `${(s.count / total) * 100}%`,
              minWidth: s.count > 0 ? "6px" : undefined,
            }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>

      {/* Legende med antal */}
      <ul className="mt-3 space-y-1.5">
        {segments.map((s) => (
          <li key={s.severity} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${SEVERITY_COLORS[s.severity]}`}
              aria-hidden
            />
            <span className="text-gray-700 dark:text-gray-200">{s.label}</span>
            <span className="ml-auto font-medium text-gray-900 dark:text-gray-100">{s.count}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
              {Math.round((s.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{total} målinger klassificeret</p>
    </div>
  );
}
