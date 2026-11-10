import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import * as api from "@/services/api";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cartSubtotal, lineTotal, lineUnitPrice, useCart } from "@/stores/cart";
import { formatSYP } from "@/lib/format";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "السلة – وصّلني" },
      { name: "description", content: "راجع طلبك وعدّل الكميات قبل إتمام الطلب." },
      { property: "og:title", content: "السلة – وصّلني" },
      { property: "og:description", content: "راجع سلتك في وصّلني." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const zones = useQuery({ queryKey: ["zones"], queryFn: api.getZones });
  const rest = useQuery({ queryKey: ["restaurant", cart.restaurantId], queryFn: () => api.getRestaurant(cart.restaurantId!), enabled: !!cart.restaurantId });
  const available = zones.data?.filter((z) => z.isActive && (!rest.data || rest.data.zoneIds.includes(z.id))) ?? [];

  useEffect(() => {
    if (available.length && (!cart.zoneId || !available.some((z) => z.id === cart.zoneId))) cart.setZone(available[0].id);
  }, [available, cart]);

  const zone = available.find((z) => z.id === cart.zoneId);
  const subtotal = cartSubtotal(cart.lines);
  const fee = zone?.deliveryFee ?? 0;

  if (!cart.lines.length)
    return (
      <CustomerShell>
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8" />}
          title="سلتك فارغة"
          description="أضف أصنافاً من مطعمك المفضل لتبدأ الطلب."
          action={<Button onClick={() => navigate({ to: "/" })}>تصفح المطاعم</Button>}
        />
      </CustomerShell>
    );

  return (
    <CustomerShell>
      <h1 className="text-2xl">السلة</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        من <Link to="/restaurant/$id" params={{ id: cart.restaurantId! }} className="font-semibold text-primary hover:underline">{cart.restaurantName}</Link>
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-3">
          {cart.lines.map((l) => (
            <li key={l.key} className="surface flex gap-3 p-3">
              {l.imageUrl && <img src={l.imageUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />}
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-brand-ink">{l.name}</p>
                  <p className="font-bold text-primary">{formatSYP(lineTotal(l))}</p>
                </div>
                {l.options.length > 0 && <p className="text-xs text-muted-foreground">{l.options.map((o) => o.name).join("، ")}</p>}
                <p className="text-xs text-muted-foreground">{formatSYP(lineUnitPrice(l))} للقطعة</p>
                <Input aria-label={`ملاحظة على ${l.name}`} value={l.notes ?? ""} onChange={(e) => cart.setLineNotes(l.key, e.target.value)} placeholder="ملاحظة على الصنف" className="mt-1 h-10" />
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" size="icon" aria-label="إنقاص" onClick={() => cart.setQuantity(l.key, l.quantity - 1)}>
                    {l.quantity === 1 ? <Trash2 /> : <Minus />}
                  </Button>
                  <span className="w-8 text-center font-bold">{l.quantity}</span>
                  <Button variant="outline" size="icon" aria-label="زيادة" onClick={() => cart.setQuantity(l.key, l.quantity + 1)}><Plus /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="surface h-fit space-y-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="cart-notes">ملاحظات للطلب</Label>
            <Textarea id="cart-notes" value={cart.notes} onChange={(e) => cart.setNotes(e.target.value)} placeholder="مثلاً: الرجاء الاتصال عند الوصول" />
          </div>
          <div className="space-y-2">
            <Label>منطقة التوصيل</Label>
            {zones.isPending ? (
              <Skeleton className="h-11 w-full" />
            ) : (
              <Select value={cart.zoneId ?? undefined} onValueChange={cart.setZone} dir="rtl">
                <SelectTrigger className="h-11"><SelectValue placeholder="اختر المنطقة" /></SelectTrigger>
                <SelectContent>
                  {available.map((z) => <SelectItem key={z.id} value={z.id}>{z.name} · {formatSYP(z.deliveryFee)}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">المجموع الفرعي</dt><dd className="font-semibold">{formatSYP(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">رسوم التوصيل</dt><dd className="font-semibold">{formatSYP(fee)}</dd></div>
            <div className="flex justify-between text-lg"><dt className="font-bold">الإجمالي</dt><dd className="font-extrabold text-brand-ink">{formatSYP(subtotal + fee)}</dd></div>
          </dl>
          <Button size="lg" className="w-full" disabled={!zone} onClick={() => navigate({ to: "/checkout" })}>متابعة الطلب</Button>
          <Button variant="ghost" className="w-full text-destructive" onClick={cart.clear}><Trash2 /> إفراغ السلة</Button>
        </aside>
      </div>
    </CustomerShell>
  );
}
