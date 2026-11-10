import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bike, Coins, Receipt, Timer } from "lucide-react";
import * as api from "@/services/api";
import { PageTitle, StatCard } from "@/components/layout/PanelShell";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { STATUS_LABELS } from "@/lib/orderStatus";
import { formatDate, formatSYP } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };

function Dashboard() {
  const stats = useQuery({ queryKey: ["adminStats"], queryFn: api.getAdminStats });
  if (stats.isPending) return <ListSkeleton rows={6} />;
  if (stats.isError) return <ErrorState onRetry={() => stats.refetch()} />;
  const s = stats.data;
  return (
    <div className="space-y-6">
      <PageTitle title="لوحة التحكم" subtitle="نظرة عامة على أداء المنصة اليوم" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="طلبات اليوم" value={s.ordersToday.toLocaleString("ar-SY")} icon={Receipt} />
        <StatCard label="إيراد المنصة اليوم" value={formatSYP(s.revenueToday)} hint={`قيمة الطلبات المسلّمة: ${formatSYP(s.gmvToday)}`} icon={Coins} />
        <StatCard label="السائقون النشطون" value={s.activeDrivers.toLocaleString("ar-SY")} icon={Bike} />
        <StatCard label="متوسط وقت التوصيل" value={`${s.avgDeliveryMinutes} دقيقة`} icon={Timer} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface p-5">
          <h2 className="mb-4 text-lg">الطلبات خلال 7 أيام</h2>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer>
              <AreaChart data={s.daily.map((d) => ({ ...d, label: formatDate(d.date) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={axis} />
                <YAxis allowDecimals={false} tick={axis} />
                <Tooltip />
                <Area type="monotone" dataKey="orders" name="الطلبات" stroke="var(--brand)" fill="var(--brand-soft)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="surface p-5">
          <h2 className="mb-4 text-lg">إيراد العمولات اليومي</h2>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer>
              <BarChart data={s.daily.map((d) => ({ ...d, label: formatDate(d.date) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => formatSYP(v)} />
                <Bar dataKey="revenue" name="الإيراد" fill="var(--mint)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="surface p-5">
        <h2 className="mb-3 text-lg">الطلبات حسب الحالة</h2>
        <div className="flex flex-wrap gap-3">
          {s.byStatus.map((b) => (
            <div key={b.status} className="rounded-xl bg-muted px-4 py-2"><span className="text-sm text-muted-foreground">{STATUS_LABELS[b.status]}</span> <span className="font-bold">{b.count}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}
