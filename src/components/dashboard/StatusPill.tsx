// Status-pill til dashboard (#17) — genbruger farverne fra getBPStatus (bpClassification).
import type { BPStatus } from "@/lib/bpClassification";

interface StatusPillProps {
  status: BPStatus;
  size?: "sm" | "md";
}

export default function StatusPill({ status, size = "md" }: StatusPillProps) {
  const sizing = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-block rounded-full font-medium whitespace-nowrap ${sizing} ${status.color}`}>
      {status.label}
    </span>
  );
}
