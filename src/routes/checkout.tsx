import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Banknote, Loader2, MapPin, Plus } from "lucide-react";
import * as api from "@/services/api";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { RequireRole } from "@/components/layout/RequireRole";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { AddressForm } from "@/components/customer/AddressForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/stores/session";
import { cartSubtotal, useCart } from "@/stores/cart";
import { formatSYP } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "إتمام الطلب – وصّلني" },
      { name: "description", content: "اختر عنوان التوصيل وأكّد طلبك. الدفع نقداً عند الاستلام." },
      { property: "og:title", content: "إتمام الطلب – وصّلني" },
      { property: "og:description", content: "أكّد طلبك في وصّلني." },
    ],
  }),
  component: () => (
    <RequireRole role="CUSTOMER">
      <Checkout />
    </RequireRole>
  ),
});

function Checkout() {
  const user = useSession((s) => s.user)!;
  const cart = useCart();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const addresses = useQuery({ queryKey: ["addresses", user.id], queryFn: () => api.getAddresses(user.id) });
  const zones = useQuery({ queryKey: ["zones"], queryFn: api.getZones });
  const [addressId, setAddressId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [phone, setPhone] = useState(user.phone);
  const [notes, setNotes] = useState(cart.notes);

  useEffect(() => {
    if (addresses.data && !addressId) setAddressId((addresses.data.find((a) => a.isDefault) ?? addresses.data[0])?.id ?? null);
    if (addresses.data && !addresses.data.length) setAdding(true);
  }, [addresses.data, addressId]);

  const saveAddr = useMutation({
    mutationFn: api.saveAddress,
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["addresses", user.id] });
      setAddressId(a.id);
      setAdding(false);
      toast.success("تم حفظ العنوان");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const address = addresses.data?.find((a) => a.id === addressId);
  const zone = zones.data?.find((z) => z.id === address?.zoneId);
  const subtotal = cartSubtotal(cart.lines);

  const place = useMutation({
    mutationFn: () =>
      api.createOrder({
        customerId: user.id,
        restaurantId: cart.restaurantId!,
        zoneId: address!.zoneId,
        deliveryAddress: { label: address!.label, details: address!.details, lat: address!.lat, lng: address!.lng },
        customerPhone: phone,
        notes: notes.trim() || undefined,
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes, selectedOptions: l.options.map((o) => ({ groupId: o.groupId, optionId: o.optionId })) })),
      }),
    onSuccess: (o) => {
      cart.clear();
      toast.success(`تم إرسال طلبك ${o.code}`);
      navigate({ to: "/orders/$id", params: { id: o.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!cart.lines.length)
    return (
      <CustomerShell>
        <EmptyState title="لا يوجد شيء لإتمامه" description="سلتك فارغة." action={<Button onClick={() => navigate({ to: "/" })}>تصفح المطاعم</Button>} />
      </CustomerShell>
    );

  const phoneOk = /^09\d{8}$/.test(phone);

  return (
    <CustomerShell hideBottomNav>
      <h1 className="text-2xl">إتمام الطلب</h1>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg"><MapPin className="h-5 w-5 text-brand" /> عنوان التوصيل</h2>
            {addresses.isPending ? (
              <ListSkeleton rows={2} />
            ) : addresses.isError ? (
              <ErrorState onRetry={() => addresses.refetch()} />
            ) : (
              <div className="space-y-2" role="radiogroup" aria-label="العناوين المحفوظة">
                {addresses.data.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={a.id === addressId}
                    onClick={() => { setAddressId(a.id); setAdding(false); }}
                    className={cn("flex min-h-14 w-full flex-col items-start rounded-xl border-2 border-border px-4 py-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", a.id === addressId && !adding && "border-primary bg-brand-soft")}
                  >
                    <span className="font-bold">{a.label}</span>
                    {a.details && <span className="text-sm text-muted-foreground">{a.details}</span>}
                  </button>
                ))}
                {!adding ? (
                  <Button variant="outline" className="w-full" onClick={() => setAdding(true)}><Plus /> إضافة عنوان جديد</Button>
                ) : (
                  <div className="rounded-xl border border-border p-4">
                    <AddressForm submitting={saveAddr.isPending} onSubmit={(d) => saveAddr.mutate({ ...d, userId: user.id, isDefault: !addresses.data.length })} />
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="surface space-y-4 p-5">
            <div className="space-y-2">
              <Label htmlFor="co-phone">رقم الهاتف للتواصل</Label>
              <Input id="co-phone" dir="ltr" inputMode="tel" className="h-11 text-right" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!phoneOk} />
              {!phoneOk && <p className="text-sm text-destructive">أدخل رقم هاتف صحيح يبدأ بـ 09</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="co-notes">ملاحظات الطلب</Label>
              <Textarea id="co-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </section>

          <section className="surface flex items-center gap-3 p-5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-mint-soft text-mint"><Banknote /></div>
            <div>
              <p className="font-bold text-brand-ink">الدفع نقداً عند الاستلام</p>
              <p className="text-sm text-muted-foreground">جهّز المبلغ وادفعه للسائق عند وصول الطلب.</p>
            </div>
          </section>
        </div>

        <aside className="surface h-fit space-y-3 p-5">
          <h2 className="text-lg">ملخص الطلب</h2>
          <p className="text-sm text-muted-foreground">{cart.restaurantName} · {cart.lines.length} صنف</p>
          <dl className="space-y-2 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">المجموع الفرعي</dt><dd>{formatSYP(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">رسوم التوصيل {zone && `(${zone.name})`}</dt><dd>{zone ? formatSYP(zone.deliveryFee) : "—"}</dd></div>
            <div className="flex justify-between text-lg"><dt className="font-bold">الإجمالي</dt><dd className="font-extrabold text-brand-ink">{formatSYP(subtotal + (zone?.deliveryFee ?? 0))}</dd></div>
          </dl>
          <Button size="lg" className="w-full" disabled={!address || !phoneOk || place.isPending || adding} onClick={() => place.mutate()}>
            {place.isPending && <Loader2 className="animate-spin" />} تأكيد الطلب
          </Button>
        </aside>
      </div>
    </CustomerShell>
  );
}
