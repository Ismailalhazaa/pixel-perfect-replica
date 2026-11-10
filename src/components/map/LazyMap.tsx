import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const MapView = lazy(() => import("./MapView"));

/** Leaflet is browser-only: lazy-load it after hydration. */
export function LazyMap({ className, ...props }: ComponentProps<typeof MapView> & { className?: string }) {
  const fallback = <Skeleton className="h-full w-full rounded-2xl" />;
  return (
    <div className={cn("relative isolate overflow-hidden rounded-2xl", className)}>
      <ClientOnly fallback={fallback}>
        <Suspense fallback={fallback}>
          <MapView {...props} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
