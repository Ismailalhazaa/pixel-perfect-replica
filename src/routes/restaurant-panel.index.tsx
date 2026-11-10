import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BellRing, Check, ChefHat, PackageCheck, X } from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import * as api from "@/services/api";
import { PageTitle } from "@/components/layout/PanelShell";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { StatusChip } from "@/components/common/StatusChip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/stores/session";
import { playChime, useMyRestaurant } from "@/hooks/use-my-accounts";
import { formatSYP, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/restaurant-panel/")({
  component: OrdersBoard,
});

const COLUMNS: { key: string; title: string; statuses: OrderStatus[] }[] = [
  { key: "new", title: "جديد", statuses: ["NEW"] },
  { key: "prep", title: "قيد التحضير", statuses: ["ACCEPTED", "PREPARING"] },
  { key: "ready", title: "جاهز", statuses: ["READY"] },
];

function OrdersBoard() {
  const user = useSession((s) => s.user)!;
  const qc = useQueryClient();
  const rest = useMyRestaurant();
  const rid = rest.data?.id;
  const orders = useQuery({
    queryKey: ["orders", { restaurantId: rid, board: true }],
    queryFn: () => api.getOrders({ restaurantId: rid, statuses: ["NEW", "ACCEPTED", "PREPARING", "READY"] }),
    enabled: !!rid,
  });
  const [accepting, setAccepting] = useState<Order | null>(null);
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [prep, setPrep] = useState(20);
  const [reason, setReason] = useState("");
  const [flash, setFlash] = useState(false);

  // new-order alert (sound + visual)
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!orders.data) return;
    const ids = orders.data.filter((o) => o.status === "NEW").map((o) => o.id);
    if (seen.current) {
      const fresh = ids.filter((i) => !seen.current!.has(i));
      if (fresh.length) {
        playChime();
        setFlash(true);
        toast.info("وصل طلب جديد!", { icon: <BellRing className="h-4 w-4" /> });
        setTimeout(() => setFlash(false), 2500);
      }
    }
    seen.current = new Set(ids);
  }, [orders.data]);

  const change = useMutation({
    mutationFn: async ({ o, steps, reason, estimatedMinutes }: { o: Order; steps: OrderStatus[]; reason?: string; estimatedMinutes?: number }) => {
      for (const status of steps) await api.updateOrderStatus(o.id, { status, userId: user.id, role: "RESTAURANT", reason, estimatedMinutes });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const pause = useMutation({
    mutationFn: (accepting: boolean) => api.updateRestaurant(rid!, { acceptingOrders: accepting }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["myRestaurant"] }); toast.success(r.acceptingOrders ? "تم استئناف استقبال الطلبات" : "تم إيقاف استقبال الطلبات مؤقتاً"); },
  });

  if (rest.isPending) return <ListSkeleton />;
  if (rest.isError) return <ErrorState message={(rest.error as Error).message} onRetry={() => rest.refetch()} />;

  return (
    <div>
      <PageTitle
        title={`طلبات ${rest.data.name}`}
        subtitle="الطلبات الحية تتحدث تلقائياً"
        actions={
          <label className="surface flex min-h-11 items-center gap-3 px-4 text-sm font-semibold">
            <Switch checked={rest.data.acceptingOrders} onCheckedChange={(v) => pause.mutate(v)} aria-label="استقبال الطلبات" />
            {rest.data.acceptingOrders ? "يستقبل الطلبات" : "الطلبات متوقفة"}
          </label>
        }
      />
      {orders.isPending ? <ListSkeleton /> : orders.isError ? <ErrorState onRetry={() => orders.refetch()} /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = orders.data.filter((o) => col.statuses.includes(o.status));
            return (
              <section key={col.key} className={cn("rounded-3xl bg-muted p-3 transition-shadow", col.key === "new" && flash && "ring-4 ring-brand")} aria-label={col.title}>
                <h2 className="mb-3 flex items-center justify-between px-2 text-lg">{col.title}<span className="rounded-full bg-card px-3 py-0.5 text-sm">{list.length}</span></h2>
                <div className="space-y-3">
                  {!list.length && <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لا توجد طلبات</p>}
                  {list.map((o) => (
                    <article key={o.id} className="surface space-y-3 p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-extrabold text-brand-ink">{o.code}</p>
                        <StatusChip status={o.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{formatTime(o.createdAt)} · {o.deliveryAddress.label}{o.driverId ? " · تم تعيين سائق" : ""}</p>
                      <ul className="space-y-1 text-sm">
                        {o.items.map((it) => (
                          <li key={it.id}>
                            <span className="font-bold">{it.quantity}×</span> {it.nameSnapshot}
                            {it.selectedOptions.length > 0 && <span className="text-muted-foreground"> ({it.selectedOptions.map((s) => s.nameSnapshot).join("، ")})</span>}
                            {it.notes && <span className="block text-xs text-primary">ملاحظة: {it.notes}</span>}
                          </li>
                        ))}
                      </ul>
                      {o.notes && <p className="rounded-lg bg-brand-soft p-2 text-xs">{o.notes}</p>}
                      <p className="text-sm font-bold">{formatSYP(o.subtotal)}</p>
                      {o.status === "NEW" && (
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={() => { setPrep(rest.data.avgPrepMinutes); setAccepting(o); }}><Check /> قبول</Button>
                          <Button variant="outline" onClick={() => { setReason(""); setRejecting(o); }}><X /> رفض</Button>
                        </div>
                      )}
                      {o.status === "ACCEPTED" && <Button variant="brand" className="w-full" onClick={() => change.mutate({ o, steps: ["PREPARING"] })}><ChefHat /> بدء التحضير</Button>}
                      {o.status === "PREPARING" && <Button variant="mint" className="w-full" onClick={() => change.mutate({ o, steps: ["READY"] })}><PackageCheck /> جاهز للاستلام</Button>}
                      {o.status === "READY" && <p className="text-center text-sm text-muted-foreground">{o.driverId ? "بانتظار استلام السائق" : "بانتظار تعيين سائق"}</p>}
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={!!accepting} onOpenChange={(v) => !v && setAccepting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right"><DialogTitle>قبول الطلب {accepting?.code}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="prep">وقت التحضير (بالدقائق)</Label>
            <Input id="prep" type="number" min={5} max={120} className="h-11" value={prep} onChange={(e) => setPrep(Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => { change.mutate({ o: accepting!, steps: ["ACCEPTED", "PREPARING"], estimatedMinutes: prep + 15 }); setAccepting(null); }}>قبول وبدء التحضير</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)}>
        <DialogContent dir="rtl">
          <DialogHeader className="text-right"><DialogTitle>رفض الطلب {rejecting?.code}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">سبب الرفض</Label>
            <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلاً: نفدت بعض المواد" />
          </div>
          <DialogFooter>
            <Button variant="destructive" className="w-full" disabled={reason.trim().length < 3} onClick={() => { change.mutate({ o: rejecting!, steps: ["REJECTED"], reason: reason.trim() }); setRejecting(null); }}>تأكيد الرفض</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
