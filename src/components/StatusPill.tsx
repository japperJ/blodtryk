// Status-pill (#12) — delt komponent på tværs af appen (dashboard, ReadingCard, BatchTimeline).
// Genbruger farverne fra getBPStatus (bpClassification) og tilføjer et ikon pr. sværhedsgrad,
// så status kan skælnes uden farve (WCAG 1.4.1 — ikke kun farve).
"use client";
import {
  CheckCircle2,
  AlertTriangle,
  CircleAlert,
  OctagonAlert,
  Siren,
  type LucideIcon,
} from "lucide-react";
import type { BPStatus, Severity } from "@/lib/bpClassification";

// Ét ikon pr. sværhedsgrad — ikonet adskiller severities i grayscale
export const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  normal: CheckCircle2,
  elevated: AlertTriangle,
  stage1: CircleAlert,
  stage2: OctagonAlert,
  crisis: Siren,
};

interface StatusPillProps {
  status: BPStatus;
  size?: "sm" | "md";
}

export default function StatusPill({ status, size = "md" }: StatusPillProps) {
  const Icon = SEVERITY_ICON[status.severity];
  const sizing =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium whitespace-nowrap ${sizing} ${status.color}`}
      title={status.description}
    >
      <Icon
        className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"}
        aria-hidden
      />
      {status.label}
    </span>
  );
}
