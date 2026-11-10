import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Banknote, Check, MapPin, Navigation, Phone, Store } from "lucide-react";
import * as api from "@/services/api";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { StatusChip } from "@/components/common/StatusChip";
import { LazyMap } from "@/components/map/LazyMap";
import type { MapMarker } from "@/components/map/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/stores/session";
import { useMyDriver } from "@/hooks/use-my-accounts";
import { formatSYP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useStreetRoute } from "@/lib/routing";

export const Route = createFileRoute("/driver/active")({
  component: ActiveDelivery,
});

function ActiveDelivery() {
  const user = useSession((s) => s.user)!;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const driver = useMyDriver();
  const d = driver.data;
  const active = useQuery({
    queryKey: ["orders", { driverId: d?.id, active: true }],
    queryFn: () => api.getOrders({ driverId: d!.id, statuses: ["ACCEPTED", "PREPARING", "READY", "ON_THE_WAY"] }),
    enabled: !!d,
  });
  const o = active.data?.[0];
  const rest = useQuery({ queryKey: ["restaurant", o?.restaurantId], queryFn: () => api.getRestaurant(o!.restaurantId), enabled: !!o });
  const loc = useQuery({ queryKey: ["driverLocation", d?.id], queryFn: () => api.getDriverLocation(d!.id), enabled: !!d });
  const [arrivedRest, setArrivedRest] = useState<string | null>(null);
  const [arrivedCust, setArrivedCust] = useState<string | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const [cash, setCash] = useState("");
  const [follow, setFollow] = useState(true);
  const goingToCustomer = active.data?.[0]?.status === "ON_THE_WAY";
  const target = goingToCustomer ? active.data?.[0]?.deliveryAddress : rest.data;
  const streetRoute = useStreetRoute(loc.data, target);

  const status = useMutation({
    mutationFn: (v: { status: "ON_THE_WAY" | "DELIVERED"; cashCollected?: number }) => api.updateOrderStatus(o!.id, { ...v, userId: user.id, role: "DRIVER" }),
    onSuccess: (res) => {
      qc.invalidateQueries();
      if (res.status === "DELIVERED") { toast.success("تم تسليم الطلب، أحسنت!"); setCashOpen(false); navigate({ to: "/driver" }); }
      else toast.success("انطلق! الزبون يتابعك على الخريطة");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (driver.isPending || active.isPending) return <ListSkeleton />;
  if (active.isError) return <ErrorState onRetry={() => active.refetch()} />;
  if (!o) return <EmptyState title="لا يوجد توصيل حالي" description="اقبل طلباً من شاشة الطلبات." action={<Button onClick={() => navigate({ to: "/driver" })}>عرض الطلبات</Button>} />;

  const markers: MapMarker[] = [];
  if (rest.data) markers.push({ kind: "restaurant", lat: rest.data.lat, lng: rest.data.lng, label: rest.data.name });
  if (loc.data) markers.push({ kind: "driver", lat: loc.data.lat, lng: loc.data.lng, label: "موقعي" });
  markers.push({ kind: "customer", lat: o.deliveryAddress.lat, lng: o.deliveryAddress.lng, label: o.deliveryAddress.label });

  const onWay = o.status === "ON_THE_WAY";
  const steps = [
    { label: "وصلت للمطعم", done: arrivedRest === o.id || onWay, enabled: true, action: () => setArrivedRest(o.id) },
    { label: o.status === "READY" || onWay ? "استلمت الطلب" : "بانتظار تجهيز الطلب", done: onWay, enabled: o.status === "READY", action: () => status.mutate({ status: "ON_THE_WAY" }) },
    { label: "وصلت للزبون", done: arrivedCust === o.id, enabled: onWay, action: () => setArrivedCust(o.id) },
    { label: "تم التسليم", done: false, enabled: onWay, action: () => { setCash(String(o.total)); setCashOpen(true); } },
  ];
  const cashNum = Number(cash);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl">توصيل {o.code}</h1>
        <StatusChip status={o.status} />
      </div>
      <div className="relative">
        <LazyMap className="h-72" markers={markers} line route={streetRoute.data} followKind={onWay && follow ? "driver" : undefined} zoom={onWay && follow ? 16 : 14} />
        {onWay && (
          <Button size="sm" variant={follow ? "mint" : "outline"} className="absolute bottom-3 left-3 z-[500]" onClick={() => setFollow((f) => !f)} aria-pressed={follow}>
            <Navigation /> {follow ? "تتبع المسار مفعّل" : "تتبع المسار"}
          </Button>
        )}
      </div>
      <div className="surface space-y-3 p-4">
        <div className="flex gap-3"><Store className="mt-0.5 h-5 w-5 text-brand" /><div><p className="text-xs text-muted-foreground">المطعم</p><p className="font-bold">{rest.data?.name ?? "…"}</p></div></div>
        <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 text-brand-ink" /><div className="flex-1"><p className="text-xs text-muted-foreground">الزبون</p><p className="font-bold">{o.deliveryAddress.label}</p>{o.deliveryAddress.details && <p className="text-sm text-muted-foreground">{o.deliveryAddress.details}</p>}</div>
          <Button asChild variant="outline" size="icon" aria-label="اتصال بالزبون"><a href={`tel:${o.customerPhone}`}><Phone /></a></Button>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-mint-soft p-3"><span className="font-semibold">المبلغ المطلوب تحصيله</span><span className="text-lg font-extrabold">{formatSYP(o.total)}</span></div>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={i}>
            <Button
              size="lg"
              variant={s.done ? "mint" : i === 3 ? "default" : "outline"}
              className={cn("h-14 w-full justify-start text-base", s.done && "pointer-events-none")}
              disabled={(!s.enabled && !s.done) || status.isPending}
              onClick={s.action}
              aria-pressed={s.done}
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-card/30 text-sm">{s.done ? <Check /> : i + 1}</span>
              {s.label}
            </Button>
          </li>
        ))}
      </ol>

      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2"><Banknote className="text-mint" /> تأكيد استلام المبلغ</DialogTitle>
            <DialogDescription>المبلغ المطلوب: {formatSYP(o.total)}. أدخل المبلغ الذي استلمته فعلياً.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cash">المبلغ المستلم (ل.س)</Label>
            <Input id="cash" type="number" inputMode="numeric" min={0} step={500} className="h-12 text-lg" value={cash} onChange={(e) => setCash(e.target.value)} />
            {cash !== "" && cashNum !== o.total && <p className="text-sm text-primary">المبلغ يختلف عن المطلوب بمقدار {formatSYP(Math.abs(cashNum - o.total))}</p>}
          </div>
          <DialogFooter>
            <Button variant="mint" size="lg" className="w-full" disabled={cash === "" || !Number.isFinite(cashNum) || cashNum < 0 || status.isPending} onClick={() => status.mutate({ status: "DELIVERED", cashCollected: Math.round(cashNum) })}>
              تأكيد التسليم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
