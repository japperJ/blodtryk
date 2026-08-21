// Fælles tom-state (#12): ikon + overskrift + evt. besked + CTA-knap.
// Bruges på /readings, /persons, /trends og "vælg person"-skærmene.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** CTA — typisk en Link eller button */
  action?: ReactNode;
  /** Mindre variant til brug inde i kort (fx dashboard-hero) */
  compact?: boolean;
}

export default function EmptyState({ icon: Icon, title, description, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`text-center ${compact ? "py-6" : "py-12 px-4"}`}>
      <div
        className={`mx-auto mb-4 flex items-center justify-center rounded-full bg-gray-100 ${
          compact ? "h-14 w-14" : "h-16 w-16"
        }`}
      >
        <Icon className={`${compact ? "h-7 w-7" : "h-8 w-8"} text-gray-400`} aria-hidden />
      </div>
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
