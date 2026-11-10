import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, MapPin, Navigation, Store, X } from "lucide-react";
import type { Order } from "@/types";
import * as api from "@/services/api";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useMyDriver, playChime } from "@/hooks/use-my-accounts";
import { distanceKm, formatSYP } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/driver/")({
  component: DriverHome,
});

const OFFER_SECONDS = 30;

function DriverHome() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const driver = useMyDriver();
  const d = driver.data;
  const active = useQuery({
    queryKey: ["orders", { driverId: d?.id, active: true }],
    queryFn: () => api.getOrders({ driverId: d!.id, statuses: ["ACCEPTED", "PREPARING", "READY", "ON_THE_WAY"] }),
    enabled: !!d,
  });
  const offers = useQuery({ queryKey: ["driverOffers", d?.id, d?.isAvailable], queryFn: () => api.getDriverOffers(d!.id), enabled: !!d?.isAvailable, refetchInterval: 5000 });
  const rests = useQuery({ queryKey: ["restaurants", { all: true }], queryFn: () => api.getRestaurants({ includeUnapproved: true }) });
  const [skipped, setSkipped] = useState<string[]>([]);
  const offer = useMemo(() => offers.data?.find((o) => !skipped.includes(o.id)), [offers.data, skipped]);

  const toggle = useMutation({
    mutationFn: (v: boolean) => api.updateDriver(d!.id, { isAvailable: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myDriver"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const accept = useMutation({
    mutationFn: (o: Order) => api.acceptDelivery(o.id, d!.id),
    onSuccess: () => { qc.invalidateQueries(); toast.success("تم قبول الطلب"); navigate({ to: "/driver/active" }); },
    onError: (e: Error) => { toast.error(e.message); offers.refetch(); },
  });

  if (driver.isPending) return <ListSkeleton />;
  if (driver.isError || !d) return <ErrorState message={(driver.error as Error)?.message} onRetry={() => driver.refetch()} />;

  const current = active.data?.[0];

  return (
    <div className="space-y-5">
      <section className={cn("rounded-3xl p-5 transition-colors", d.isAvailable ? "hero-glow text-brand-ink-foreground" : "surface")}>
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className={cn("text-2xl font-extrabold", d.isAvailable ? "text-brand-ink-foreground" : "text-brand-ink")}>{d.isAvailable ? "متاح" : "غير متاح"}</p>
            <p className={cn("text-sm", d.isAvailable ? "text-brand-ink-foreground/80" : "text-muted-foreground")}>
              {!d.isApproved ? "حسابك بانتظار موافقة الإدارة" : d.isAvailable ? "ستصلك الطلبات القريبة هنا" : "فعّل التوفر لاستقبال الطلبات"}
            </p>
          </div>
          <Switch className="scale-125" checked={d.isAvailable} disabled={!d.isApproved || !!current || toggle.isPending} onCheckedChange={(v) => toggle.mutate(v)} aria-label="حالة التوفر" />
        </label>
      </section>

      {current && (
        <button type="button" onClick={() => navigate({ to: "/driver/active" })} className="surface flex w-full items-center gap-3 p-4 text-right">
          <Navigation className="h-6 w-6 text-primary" />
          <div className="flex-1"><p className="font-bold">لديك توصيل جارٍ: {current.code}</p><p className="text-sm text-muted-foreground">اضغط لفتح شاشة التوصيل</p></div>
        </button>
      )}

      {!current && d.isAvailable && (
        offers.isPending ? <ListSkeleton rows={1} /> : offers.isError ? <ErrorState onRetry={() => offers.refetch()} /> : offer ? (
          <OfferCard
            key={offer.id}
            order={offer}
            restaurant={rests.data?.find((r) => r.id === offer.restaurantId)}
            onAccept={() => accept.mutate(offer)}
            onReject={() => setSkipped((s) => [...s, offer.id])}
            busy={accept.isPending}
          />
        ) : (
          <EmptyState title="لا توجد طلبات حالياً" description="ابقَ متاحاً، سنعرض عليك أول طلب قريب." />
        )
      )}
    </div>
  );
}

function OfferCard({ order, restaurant, onAccept, onReject, busy }: { order: Order; restaurant?: { name: string; lat: number; lng: number }; onAccept: () => void; onReject: () => void; busy: boolean }) {
  const [left, setLeft] = useState(OFFER_SECONDS);
  useEffect(() => { playChime(); }, []);
  useEffect(() => {
    if (left <= 0) { onReject(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onReject]);
  const km = restaurant ? distanceKm(restaurant, order.deliveryAddress) : 0;
  return (
    <article className="surface space-y-4 border-2 border-brand p-5" aria-live="assertive">
      <div className="flex items-center justify-between">
        <p className="text-lg font-extrabold text-brand-ink">طلب توصيل جديد</p>
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-lg font-extrabold text-primary-foreground" aria-label={`${left} ثانية متبقية`}>{left}</span>
      </div>
      <Progress value={(left / OFFER_SECONDS) * 100} aria-hidden />
      <div className="space-y-3">
        <div className="flex gap-3"><Store className="mt-0.5 h-5 w-5 text-brand" /><div><p className="text-xs text-muted-foreground">الاستلام من</p><p className="font-bold">{restaurant?.name ?? "…"}</p></div></div>
        <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 text-brand-ink" /><div><p className="text-xs text-muted-foreground">التسليم إلى</p><p className="font-bold">{order.deliveryAddress.label}</p></div></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted p-2"><p className="text-xs text-muted-foreground">المسافة</p><p className="font-bold">{km.toFixed(1)} كم</p></div>
        <div className="rounded-xl bg-muted p-2"><p className="text-xs text-muted-foreground">أجرة التوصيل</p><p className="font-bold">{formatSYP(order.deliveryFee)}</p></div>
        <div className="rounded-xl bg-muted p-2"><p className="text-xs text-muted-foreground">تحصيل نقدي</p><p className="font-bold">{formatSYP(order.total)}</p></div>
      </div>
      <div className="flex gap-2">
        <Button size="lg" variant="mint" className="flex-1" onClick={onAccept} disabled={busy}><Check /> قبول</Button>
        <Button size="lg" variant="outline" onClick={onReject}><X /> رفض</Button>
      </div>
    </article>
  );
}
