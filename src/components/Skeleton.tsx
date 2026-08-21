// Skeleton-loaders (#12) — grå, afrundede blokke med pulse-animation.
// Layoutsformerne matcher sidernes endelige indhold, så overgangen
// fra "indlæser" til data ikke springer i layoutet.
"use client";

/** Basis-blok: grå, afrundet, pulserende */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className}`} aria-hidden />;
}

/** /readings — ét kortskelet i samme form som ReadingCard */
export function ReadingCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border">
      <div className="flex justify-between items-start mb-3">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <Skeleton className="h-8 w-12 mx-auto" />
        <Skeleton className="h-8 w-12 mx-auto" />
        <Skeleton className="h-8 w-12 mx-auto" />
      </div>
      <div className="mt-3 pt-3 border-t flex justify-between items-center">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/** /persons — én rækkeskelet i samme form som personkortet */
export function PersonRowSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-3">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-4 w-10 shrink-0" />
    </div>
  );
}

/** /trends — nøgletal + diagramblok + bar-rækker */
export function TrendsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Nøgletal */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border grid grid-cols-3 gap-2 text-center">
        <Skeleton className="h-10 w-14 mx-auto" />
        <Skeleton className="h-10 w-14 mx-auto" />
        <Skeleton className="h-10 w-14 mx-auto" />
      </div>
      {/* Linjediagram */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <Skeleton className="h-4 w-36 mb-3" />
        <Skeleton className="h-48 w-full" />
        <div className="mt-3 flex gap-4">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      {/* Ugentlige gennemsnit */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-10 shrink-0" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-4 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dashboard — hero + tællere */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border">
        <div className="flex justify-between items-start mb-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-12 w-52 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <Skeleton className="h-7 w-16 mb-1.5" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border">
          <Skeleton className="h-7 w-16 mb-1.5" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}
