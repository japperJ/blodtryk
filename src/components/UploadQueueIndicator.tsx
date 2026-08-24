"use client";

// Upload-kø-status (#50): flydende pille over navbar der viser hvor mange
// billeder der venter på scanning — mens brugeren færdes i andre menus.
// Tryk på pillen fører tilbage til Scan-siden hvor jobbet genoptages.
// Skjules på /scan selv — BatchProgress viser allerede fuldt detailniveau.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Images, Loader2 } from "lucide-react";
import { useUploadQueue } from "@/hooks/useUploadQueue";
import { useI18n } from "@/lib/I18nProvider";

export default function UploadQueueIndicator() {
  const pathname = usePathname();
  const { t } = useI18n();
  const queue = useUploadQueue();

  const remaining = queue ? queue.pending + queue.scanning : 0;
  const visible = queue !== null && queue.total > 0 && remaining > 0;

  if (!visible || pathname === "/scan") return null;

  const done = queue.saved + queue.failed;

  const parts: string[] = [];
  if (done > 0) parts.push(t("queue.scannedProgress", { done, total: queue.total }));
  parts.push(
    queue.pending === 1 ? t("queue.waitingOne") : t("queue.waitingMany", { count: queue.pending })
  );

  return (
    <div className="fixed bottom-[4.75rem] left-0 right-0 z-40 px-4 pointer-events-none">
      <div className="max-w-lg mx-auto flex justify-center">
        <Link
          href="/scan"
          role="status"
          aria-live="polite"
          aria-label={parts.join(" · ")}
          title={t("queue.openScan")}
          className="pointer-events-auto inline-flex items-center gap-2 max-w-full rounded-full border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-800 shadow-lg pl-3 pr-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200
                     hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all"
        >
          {queue.scanning > 0 ? (
            <Loader2
              className="w-4 h-4 shrink-0 animate-spin text-primary-600 dark:text-primary-400"
              aria-hidden
            />
          ) : (
            <Images
              className="w-4 h-4 shrink-0 text-primary-600 dark:text-primary-400"
              aria-hidden
            />
          )}
          <span className="truncate">{parts.join(" · ")}</span>
        </Link>
      </div>
    </div>
  );
}
