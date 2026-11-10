import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Receipt, RotateCcw, Star } from "lucide-react";
import type { Order } from "@/types";
import * as api from "@/services/api";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { RequireRole } from "@/components/layout/RequireRole";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { StatusChip } from "@/components/common/StatusChip";
import { RatingDialog } from "@/components/customer/RatingDialog";
import { Button } from "@/components/ui/button";
import { useSession } from "@/stores/session";
import { useCart } from "@/stores/cart";
import { formatDateTime, formatSYP } from "@/lib/format";
import { isActive } from "@/lib/orderStatus";

export const Route = createFileRoute("/orders/")({
  head: () => ({
    meta: [
      { title: "طلباتي – وصّلني" },
      { name: "description", content: "سجل طلباتك السابقة والحالية، أعد الطلب بضغطة واحدة." },
      { property: "og:title", content: "طلباتي – وصّلني" },
      { property: "og:description", content: "طلباتك في وصّلني." },
    ],
  }),
  component: () => (
    <RequireRole role="CUSTOMER">
      <OrdersPage />
    </RequireRole>
  ),
});

function OrdersPage() {
  const user = useSession((s) => s.user)!;
  const navigate = useNavigate();
  const cart = useCart();
  const orders = useQuery({ queryKey: ["orders", { customerId: user.id }], queryFn: () => api.getOrders({ customerId: user.id }) });
  const rests = useQuery({ queryKey: ["restaurants", { all: true }], queryFn: () => api.getRestaurants({ includeUnapproved: true }) });
  const ids = orders.data?.map((o) => o.id) ?? [];
  const reviews = useQuery({ queryKey: ["reviews", ids], queryFn: () => api.getReviews(ids), enabled: ids.length > 0 });
  const [rating, setRating] = useState<Order | null>(null);

  const reorder = async (o: Order) => {
    try {
      const menu = await api.getMenu(o.restaurantId);
      const restName = rests.data?.find((r) => r.id === o.restaurantId)?.name ?? "";
      cart.clear();
      let skipped = 0;
      o.items.forEach((it) => {
        const mi = menu.items.find((m) => m.id === it.menuItemId && m.isAvailable);
        if (!mi) return void skipped++;
        const options = it.selectedOptions
          .map((so) => {
            const op = mi.optionGroups.find((g) => g.id === so.groupId)?.options.find((x) => x.id === so.optionId);
            return op ? { groupId: so.groupId, optionId: op.id, name: op.name, priceDelta: op.priceDelta } : null;
          })
          .filter((x): x is NonNullable<typeof x> => !!x);
        cart.addLine(o.restaurantId, restName, { menuItemId: mi.id, name: mi.name, imageUrl: mi.imageUrl, basePrice: mi.price, options, quantity: it.quantity, notes: it.notes });
      });
      if (skipped) toast.warning(`${skipped} صنف غير متوفر حالياً ولم يُضف`);
      navigate({ to: "/cart" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <CustomerShell>
      <h1 className="mb-5 text-2xl">طلباتي</h1>
      {orders.isPending ? (
        <ListSkeleton />
      ) : orders.isError ? (
        <ErrorState message={(orders.error as Error).message} onRetry={() => orders.refetch()} />
      ) : !orders.data.length ? (
        <EmptyState icon={<Receipt className="h-8 w-8" />} title="لا توجد طلبات بعد" description="اطلب أول وجبة وستظهر هنا." action={<Button onClick={() => navigate({ to: "/" })}>اطلب الآن</Button>} />
      ) : (
        <ul className="space-y-3">
          {orders.data.map((o) => {
            const rest = rests.data?.find((r) => r.id === o.restaurantId);
            const rated = reviews.data?.some((r) => r.orderId === o.id);
            return (
              <li key={o.id} className="surface p-4">
                <Link to="/orders/$id" params={{ id: o.id }} className="flex items-start gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {rest?.imageUrl && <img src={rest.imageUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-brand-ink">{rest?.name ?? "…"}</p>
                      <StatusChip status={o.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{o.code} · {formatDateTime(o.createdAt)}</p>
                    <p className="text-sm text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.nameSnapshot}`).join("، ")}</p>
                  </div>
                  <div className="flex items-center gap-1 font-bold">{formatSYP(o.total)}<ChevronLeft className="h-4 w-4 text-muted-foreground" /></div>
                </Link>
                {!isActive(o.status) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button variant="outline" size="sm" onClick={() => reorder(o)}><RotateCcw /> إعادة الطلب</Button>
                    {o.status === "DELIVERED" && !rated && (
                      <Button variant="ghost" size="sm" onClick={() => setRating(o)}><Star /> قيّم الطلب</Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {rating && <RatingDialog order={rating} authorId={user.id} open={!!rating} onOpenChange={(o) => !o && setRating(null)} />}
    </CustomerShell>
  );
}
