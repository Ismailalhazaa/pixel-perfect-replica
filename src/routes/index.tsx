import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Search, Bike, Sparkles } from "lucide-react";
import * as api from "@/services/api";
import { useSession } from "@/stores/session";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { CardsSkeleton, EmptyState, ErrorState } from "@/components/common/states";
import { Rating } from "@/components/common/Stars";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatSYP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Restaurant } from "@/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "وصّلني – اطلب أكلك المفضل في دمشق" },
      { name: "description", content: "مطاعم ومحلات دمشق بين يديك: برجر، شاورما، بيتزا، حلويات وبقالة. تتبّع مباشر والدفع نقداً عند الاستلام." },
      { property: "og:title", content: "وصّلني – اطلب أكلك المفضل في دمشق" },
      { property: "og:description", content: "اطلب من مطاعم دمشق وتابع طلبك مباشرة على الخريطة." },
    ],
  }),
  component: Home,
});

function Home() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | undefined>();
  const cats = useQuery({ queryKey: ["restaurantCategories"], queryFn: api.getRestaurantCategories });
  const zones = useQuery({ queryKey: ["zones"], queryFn: api.getZones });
  const rests = useQuery({ queryKey: ["restaurants", { q, category }], queryFn: () => api.getRestaurants({ q: q.trim() || undefined, category }) });
  const minFee = zones.data?.length ? Math.min(...zones.data.filter((z) => z.isActive).map((z) => z.deliveryFee)) : undefined;

  return (
    <CustomerShell>
      <section className="hero-glow relative overflow-hidden rounded-3xl px-6 py-8 md:px-10 md:py-12">
        <p className="text-sm font-semibold text-brand">توصيل سريع في دمشق</p>
        <h1 className="mt-2 max-w-xl text-3xl leading-tight !text-brand-ink-foreground md:text-5xl">شو بدك تاكل اليوم؟</h1>
        <p className="mt-3 max-w-md text-brand-ink-foreground/80">اطلب من مطاعمك المفضلة وتابع السائق لحظة بلحظة. الدفع نقداً عند الاستلام.</p>
        <label className="relative mt-6 block max-w-xl">
          <span className="sr-only">ابحث عن مطعم أو صنف</span>
          <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مطعم أو صنف..." className="h-14 rounded-2xl border-0 bg-card pr-12 text-base shadow-card" />
        </label>
      </section>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="التصنيفات">
        <Chip active={!category} onClick={() => setCategory(undefined)}>الكل</Chip>
        {cats.isPending && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-11 w-20 shrink-0 rounded-full" />)}
        {cats.data?.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c === category ? undefined : c)}>{c}</Chip>
        ))}
      </div>

      <Recommendations />

      <section className="mt-8">
        <h2 className="mb-4 text-xl">المطاعم والمحلات</h2>
        {rests.isPending ? (
          <CardsSkeleton />
        ) : rests.isError ? (
          <ErrorState message={(rests.error as Error).message} onRetry={() => rests.refetch()} />
        ) : !rests.data.length ? (
          <EmptyState title="لا توجد نتائج" description="جرّب كلمة بحث أخرى أو تصنيفاً مختلفاً." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rests.data.map((r) => <RestaurantCard key={r.id} r={r} fee={minFee} />)}
          </div>
        )}
      </section>
    </CustomerShell>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "min-h-11 shrink-0 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-brand-ink bg-brand-ink text-brand-ink-foreground",
      )}
    >
      {children}
    </button>
  );
}

function RestaurantCard({ r, fee }: { r: Restaurant; fee?: number }) {
  const open = r.isOpen && r.acceptingOrders;
  return (
    <Link to="/restaurant/$id" params={{ id: r.id }} className="surface group block overflow-hidden transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative h-40 overflow-hidden">
        <img src={r.imageUrl} alt="" loading="lazy" width={976} height={688} className={cn("h-full w-full object-cover transition-transform duration-500 group-hover:scale-105", !open && "grayscale")} />
        <span className={cn("absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold", open ? "bg-mint text-mint-foreground" : "bg-card text-muted-foreground")}>
          {open ? "مفتوح" : "مغلق"}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg">{r.name}</h3>
          <Rating value={r.ratingAvg} count={r.ratingCount} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{r.category}</p>
        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {r.avgPrepMinutes + 15}–{r.avgPrepMinutes + 25} د</span>
          {fee !== undefined && <span className="inline-flex items-center gap-1"><Bike className="h-4 w-4" /> من {formatSYP(fee)}</span>}
        </div>
      </div>
    </Link>
  );
}

function Recommendations() {
  const user = useSession((s) => s.user);
  const hydrated = useSession((s) => s.hydrated);
  const customerId = user?.role === "CUSTOMER" ? user.id : null;
  const recs = useQuery({
    queryKey: ["recommendations", customerId],
    enabled: hydrated,
    queryFn: async () => {
      if (customerId) {
        try {
          const r = await api.getRecommendations(customerId);
          if (r.items.length) return { title: "مقترح لك", items: r.items };
        } catch {
          /* silent fallback */
        }
      }
      const pop = await api.getMostOrdered();
      return { title: "الأكثر طلباً", items: pop.items };
    },
  });
  const ids = recs.data?.items.map((i) => i.menuItemId) ?? [];
  const items = useQuery({ queryKey: ["menuItems", ids], queryFn: () => api.getMenuItems(ids), enabled: ids.length > 0 });

  if (recs.isError || (recs.data && !recs.data.items.length)) return null;
  const loading = recs.isPending || items.isPending;
  return (
    <section className="mt-8" aria-busy={loading}>
      <h2 className="mb-4 flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-brand" /> {recs.data?.title ?? "مقترح لك"}</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {loading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-56 w-56 shrink-0 rounded-2xl" />)
          : recs.data!.items.map((rec) => {
              const m = items.data?.find((x) => x.id === rec.menuItemId);
              if (!m) return null;
              return (
                <Link key={rec.menuItemId} to="/restaurant/$id" params={{ id: rec.restaurantId }} className="surface w-56 shrink-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <img src={m.imageUrl} alt="" loading="lazy" width={976} height={688} className="h-28 w-full object-cover" />
                  <div className="p-3">
                    <p className="font-bold text-brand-ink">{m.name}</p>
                    <p className="text-sm font-semibold text-primary">{formatSYP(m.price)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{rec.reason}</p>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
