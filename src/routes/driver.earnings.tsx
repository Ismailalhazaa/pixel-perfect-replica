import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import * as api from "@/services/api";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { useMyDriver } from "@/hooks/use-my-accounts";
import { formatDateTime, formatSYP } from "@/lib/format";

export const Route = createFileRoute("/driver/earnings")({
  component: Earnings,
});

function Earnings() {
  const driver = useMyDriver();
  const e = useQuery({ queryKey: ["driverEarnings", driver.data?.id], queryFn: () => api.getDriverEarnings(driver.data!.id), enabled: !!driver.data });
  if (driver.isPending || e.isPending) return <ListSkeleton />;
  if (e.isError) return <ErrorState onRetry={() => e.refetch()} />;
  const r = e.data;
  const toHand = r.balance.owedByAccount - r.balance.owedToAccount;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">أرباحي</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="surface p-4"><p className="text-sm text-muted-foreground">اليوم</p><p className="text-xl font-extrabold text-brand-ink">{formatSYP(r.today.amount)}</p><p className="text-xs text-muted-foreground">{r.today.count} توصيلة</p></div>
        <div className="surface p-4"><p className="text-sm text-muted-foreground">هذا الأسبوع</p><p className="text-xl font-extrabold text-brand-ink">{formatSYP(r.week.amount)}</p><p className="text-xs text-muted-foreground">{r.week.count} توصيلة</p></div>
      </div>
      <section className="hero-glow rounded-3xl p-5 text-brand-ink-foreground">
        <p className="text-sm opacity-80">النقد الواجب تسليمه (بعد خصم أرباحك)</p>
        <p className="mt-1 text-3xl font-extrabold">{formatSYP(Math.max(0, toHand))}</p>
        <p className="mt-1 text-xs opacity-80">نقد محصّل غير مسوّى: {formatSYP(r.balance.owedByAccount)} · أرباح: {formatSYP(r.balance.owedToAccount)}</p>
        {r.cashByRestaurant.length > 0 && (
          <ul className="mt-4 space-y-1 border-t border-brand-ink-foreground/20 pt-3 text-sm">
            {r.cashByRestaurant.map((c) => <li key={c.restaurantId} className="flex justify-between"><span>{c.restaurantName}</span><span className="font-bold">{formatSYP(c.amount)}</span></li>)}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg">التوصيلات المكتملة</h2>
        {!r.deliveries.length ? <EmptyState icon={<Wallet className="h-8 w-8" />} title="لا توجد توصيلات بعد" /> : (
          <ul className="space-y-2">
            {r.deliveries.map((o) => (
              <li key={o.id} className="surface flex items-center justify-between p-3">
                <div><p className="font-bold">{o.code}</p><p className="text-xs text-muted-foreground">{o.deliveredAt && formatDateTime(o.deliveredAt)} · {o.deliveryAddress.label}</p></div>
                <div className="text-left"><p className="font-bold text-mint">+{formatSYP(o.deliveryFee)}</p><p className="text-xs text-muted-foreground">نقد: {formatSYP(o.cashCollected ?? o.total)}</p></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
