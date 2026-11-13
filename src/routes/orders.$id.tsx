import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Check, Clock, Phone, Star, X } from "lucide-react";
import * as api from "@/services/api";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { RequireRole } from "@/components/layout/RequireRole";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { StatusChip } from "@/components/common/StatusChip";
import { useStreetRoute } from "@/lib/routing";
import { LazyMap } from "@/components/map/LazyMap";
import type { MapMarker } from "@/components/map/types";
import { RatingDialog } from "@/components/customer/RatingDialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSession } from "@/stores/session";
import { STATUS_FLOW, STATUS_LABELS } from "@/lib/orderStatus";
import { distanceKm, formatSYP, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({
    meta: [
      { title: "تتبع الطلب – وصّلني" },
      { name: "description", content: "تابع حالة طلبك وموقع السائق مباشرة على الخريطة." },
      { property: "og:title", content: "تتبع الطلب – وصّلني" },
      { property: "og:description", content: "تتبع مباشر لطلبك." },
    ],
  }),
  component: () => (
    <RequireRole role="CUSTOMER">
      <Tracking />
    </RequireRole>
  ),
});

function Tracking() {
  const { id } = Route.useParams();
  const user = useSession((s) => s.user)!;
  const order = useQuery({ queryKey: ["order", id], queryFn: () => api.getOrder(id) });
  const o = order.data;
  const rest = useQuery({ queryKey: ["restaurant", o?.restaurantId], queryFn: () => api.getRestaurant(o!.restaurantId), enabled: !!o });
  const driver = useQuery({ queryKey: ["driver", o?.driverId], queryFn: () => api.getDriver(o!.driverId!), enabled: !!o?.driverId });
  const loc = useQuery({ queryKey: ["driverLocation", o?.driverId], queryFn: () => api.getDriverLocation(o!.driverId!), enabled: !!o?.driverId && o.status === "ON_THE_WAY" });
  // Freeze the route origin when the trip starts so the path stays fixed while the driver moves.
  const onWay = o?.status === "ON_THE_WAY";
  const [routeFrom, setRouteFrom] = useState<{ key: string; lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (onWay && o && loc.data && routeFrom?.key !== o.id) {
      setRouteFrom({ key: o.id, lat: loc.data.lat, lng: loc.data.lng });
    }
  }, [onWay, o, loc.data, routeFrom?.key]);
  const streetRoute = useStreetRoute(onWay && routeFrom?.key === o?.id ? routeFrom : null, o?.deliveryAddress);
  const reviews = useQuery({ queryKey: ["reviews", [id]], queryFn: () => api.getReviews([id]), enabled: o?.status === "DELIVERED" });
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  const cancel = useMutation({
    mutationFn: () => api.updateOrderStatus(id, { status: "CANCELLED", userId: user.id, role: "CUSTOMER", reason: "ألغى الزبون الطلب" }),
    onSuccess: () => { toast.success("تم إلغاء الطلب"); order.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (order.isPending) return <CustomerShell><ListSkeleton rows={5} /></CustomerShell>;
  if (order.isError || !o) return <CustomerShell><ErrorState message={(order.error as Error)?.message} onRetry={() => order.refetch()} /></CustomerShell>;
  if (o.customerId !== user.id) return <CustomerShell><ErrorState message="هذا الطلب غير موجود في حسابك" /></CustomerShell>;

  const markers: MapMarker[] = [];
  if (rest.data) markers.push({ kind: "restaurant", lat: rest.data.lat, lng: rest.data.lng, label: rest.data.name });
  markers.push({ kind: "customer", lat: o.deliveryAddress.lat, lng: o.deliveryAddress.lng, label: o.deliveryAddress.label });
  if (loc.data) markers.push({ kind: "driver", lat: loc.data.lat, lng: loc.data.lng, label: driver.data?.user.name });

  const stepIdx = STATUS_FLOW.indexOf(o.status);
  const ended = o.status === "CANCELLED" || o.status === "REJECTED";
  const eta = loc.data ? Math.max(2, Math.round((distanceKm(loc.data, o.deliveryAddress) / 25) * 60) + 1) : o.estimatedMinutes;
  const rated = !!reviews.data?.length;
  const lastAt = (s: string) => o.history.filter((h) => h.status === s).at(-1)?.createdAt;

  return (
    <CustomerShell>
      <Link to="/orders" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"><ArrowRight className="h-4 w-4" /> طلباتي</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">طلب {o.code}</h1>
          <p className="text-sm text-muted-foreground">{rest.data?.name}</p>
        </div>
        <StatusChip status={o.status} className="text-sm" />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <LazyMap className="h-72 md:h-96" markers={markers} line={o.status === "ON_THE_WAY"} route={o.status === "ON_THE_WAY" ? streetRoute.data : null} />
          {o.status !== "DELIVERED" && !ended && (
            <div className="surface flex items-center gap-3 p-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand"><Clock /></div>
              <div>
                <p className="text-sm text-muted-foreground">الوقت المتوقع للوصول</p>
                <p className="text-xl font-extrabold text-brand-ink" aria-live="polite">{eta} دقيقة تقريباً</p>
              </div>
            </div>
          )}
          {driver.data && (
            <div className="surface flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">السائق</p>
                <p className="font-bold text-brand-ink">{driver.data.user.name}</p>
              </div>
              <Button asChild variant="mint"><a href={`tel:${driver.data.user.phone}`}><Phone /> <span dir="ltr">{driver.data.user.phone}</span></a></Button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className="surface p-5" aria-label="حالة الطلب">
            {ended ? (
              <div className="flex items-center gap-3 text-destructive">
                <X className="h-6 w-6" />
                <div>
                  <p className="font-bold">{STATUS_LABELS[o.status]}</p>
                  {o.history.at(-1)?.reason && <p className="text-sm text-muted-foreground">{o.history.at(-1)?.reason}</p>}
                </div>
              </div>
            ) : (
              <ol className="space-y-0">
                {STATUS_FLOW.map((s, i) => {
                  const done = i <= stepIdx;
                  const at = lastAt(s);
                  return (
                    <li key={s} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < STATUS_FLOW.length - 1 && <span className={cn("absolute right-[15px] top-8 h-[calc(100%-24px)] w-0.5", i < stepIdx ? "bg-mint" : "bg-border")} aria-hidden />}
                      <span className={cn("z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2", done ? "border-mint bg-mint text-mint-foreground" : "border-border bg-card", i === stepIdx && "ring-4 ring-mint/25")}>
                        {done ? <Check className="h-4 w-4" /> : <span className="text-xs text-muted-foreground">{i + 1}</span>}
                      </span>
                      <div className="pt-1">
                        <p className={cn("font-semibold", !done && "text-muted-foreground")}>{STATUS_LABELS[s]}</p>
                        {at && <p className="text-xs text-muted-foreground">{formatTime(at)}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {o.status === "NEW" && (
              <Button variant="outline" className="mt-4 w-full text-destructive" onClick={() => setConfirmCancel(true)} disabled={cancel.isPending}>إلغاء الطلب</Button>
            )}
            {o.status === "DELIVERED" && !rated && (
              <Button className="mt-4 w-full" onClick={() => setRateOpen(true)}><Star /> قيّم الطلب</Button>
            )}
          </section>

          <section className="surface p-5">
            <h2 className="mb-3 text-lg">تفاصيل الطلب</h2>
            <ul className="space-y-2 text-sm">
              {o.items.map((it) => (
                <li key={it.id} className="flex justify-between gap-2">
                  <span>
                    {it.quantity}× {it.nameSnapshot}
                    {it.selectedOptions.length > 0 && <span className="block text-xs text-muted-foreground">{it.selectedOptions.map((x) => x.nameSnapshot).join("، ")}</span>}
                  </span>
                  <span className="font-semibold">{formatSYP(it.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">رسوم التوصيل</dt><dd>{formatSYP(o.deliveryFee)}</dd></div>
              <div className="flex justify-between font-bold"><dt>الإجمالي (نقداً)</dt><dd>{formatSYP(o.total)}</dd></div>
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">التوصيل إلى: {o.deliveryAddress.label}</p>
          </section>
        </aside>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>إلغاء الطلب؟</AlertDialogTitle>
            <AlertDialogDescription>لا يمكن التراجع عن الإلغاء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>رجوع</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate()}>نعم، ألغِ الطلب</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {rateOpen && <RatingDialog order={o} authorId={user.id} open={rateOpen} onOpenChange={setRateOpen} />}
    </CustomerShell>
  );
}
