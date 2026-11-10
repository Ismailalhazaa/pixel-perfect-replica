import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Coins, Receipt, Wallet } from "lucide-react";
import * as api from "@/services/api";
import { PageTitle, StatCard } from "@/components/layout/PanelShell";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { useMyRestaurant } from "@/hooks/use-my-accounts";
import { formatDate, formatSYP } from "@/lib/format";

export const Route = createFileRoute("/restaurant-panel/reports")({
  component: Reports,
});

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };

function Reports() {
  const rest = useMyRestaurant();
  const report = useQuery({ queryKey: ["restaurantReport", rest.data?.id], queryFn: () => api.getRestaurantReport(rest.data!.id), enabled: !!rest.data });
  if (rest.isPending || report.isPending) return <ListSkeleton rows={6} />;
  if (rest.isError || report.isError) return <ErrorState onRetry={() => { rest.refetch(); report.refetch(); }} />;
  const r = report.data;
  return (
    <div className="space-y-6">
      <PageTitle title="التقارير" subtitle={rest.data.name} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="مبيعات اليوم" value={formatSYP(r.today.total)} hint={`${r.today.count} طلب`} icon={Receipt} />
        <StatCard label="مبيعات الأسبوع" value={formatSYP(r.week.total)} hint={`${r.week.count} طلب`} icon={CalendarDays} />
        <StatCard label="مستحق لكم من المنصة" value={formatSYP(r.balance.owedToAccount)} hint="غير مسوّى بعد" icon={Wallet} />
        <StatCard label="عمولة المنصة (الإجمالي)" value={formatSYP(r.balance.totals.PLATFORM_COMMISSION ?? 0)} icon={Coins} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="mb-4 text-lg">المبيعات اليومية (آخر 7 أيام)</h2>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={r.daily.map((d) => ({ ...d, label: formatDate(d.date) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => formatSYP(v)} />
                <Bar dataKey="total" name="المبيعات" fill="var(--brand)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="surface p-5">
          <h2 className="mb-4 text-lg">ساعات الذروة</h2>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={r.peakHours.filter((h) => h.hour >= 8)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="hour" tick={axis} />
                <YAxis allowDecimals={false} tick={axis} />
                <Tooltip />
                <Bar dataKey="count" name="عدد الطلبات" fill="var(--mint)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="surface p-5">
        <h2 className="mb-3 text-lg">الأصناف الأكثر مبيعاً</h2>
        {!r.topItems.length ? <p className="text-sm text-muted-foreground">لا توجد مبيعات بعد.</p> : (
          <ol className="divide-y divide-border">
            {r.topItems.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3 py-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft font-bold text-brand">{i + 1}</span>
                <span className="flex-1 font-semibold">{t.name}</span>
                <span className="text-sm text-muted-foreground">{t.quantity} قطعة</span>
                <span className="w-32 text-left font-bold">{formatSYP(t.revenue)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
