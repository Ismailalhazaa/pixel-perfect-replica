import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, FilePlus2 } from "lucide-react";
import type { AccountType, LedgerType } from "@/types";
import * as api from "@/services/api";
import { PageTitle, StatCard } from "@/components/layout/PanelShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSession } from "@/stores/session";
import { downloadFile, formatDate, formatDateTime, formatSYP, toCSV } from "@/lib/format";

export const Route = createFileRoute("/admin/settlements")({
  component: Settlements,
});

const LEDGER_LABELS: Record<LedgerType, string> = {
  CASH_COLLECTED: "نقد محصّل من الزبون",
  DELIVERY_EARNING: "أجرة توصيل للسائق",
  RESTAURANT_PAYABLE: "مستحق للمطعم",
  PLATFORM_COMMISSION: "عمولة المنصة",
  SETTLEMENT: "تسوية مؤكدة",
};

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function Settlements() {
  const user = useSession((s) => s.user)!;
  const qc = useQueryClient();
  const [type, setType] = useState<AccountType>("DRIVER");
  const [accountId, setAccountId] = useState<string>("");
  const [from, setFrom] = useState(isoDay(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(isoDay(new Date()));

  const drivers = useQuery({ queryKey: ["drivers"], queryFn: api.getDrivers });
  const rests = useQuery({ queryKey: ["restaurants", { all: true }], queryFn: () => api.getRestaurants({ includeUnapproved: true }) });
  const accounts = type === "DRIVER" ? drivers.data?.map((d) => ({ id: d.id, name: d.user.name })) : rests.data?.map((r) => ({ id: r.id, name: r.name }));
  const selected = accountId || accounts?.[0]?.id || "";
  const accountName = accounts?.find((a) => a.id === selected)?.name ?? "";

  const statement = useQuery({ queryKey: ["statement", type, selected], queryFn: () => api.getAccountStatement(type, selected), enabled: !!selected });
  const settlements = useQuery({ queryKey: ["settlements", type, selected], queryFn: () => api.getSettlements({ accountType: type, accountId: selected }), enabled: !!selected });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["statement"] }); qc.invalidateQueries({ queryKey: ["settlements"] }); };
  const create = useMutation({
    mutationFn: () => api.createSettlement({ accountType: type, accountId: selected, periodStart: new Date(from).toISOString(), periodEnd: new Date(`${to}T23:59:59`).toISOString() }),
    onSuccess: () => { refresh(); toast.success("تم إنشاء مسودة التسوية"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirm = useMutation({
    mutationFn: (id: string) => api.confirmSettlement(id, user.id),
    onSuccess: () => { refresh(); toast.success("تم تأكيد التسوية"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCSV = () => {
    if (!statement.data) return;
    const rows: (string | number)[][] = [["التاريخ", "النوع", "رقم الطلب", "المبلغ (ل.س)", "مسوّى"]];
    statement.data.entries.forEach((e) => rows.push([formatDateTime(e.createdAt), LEDGER_LABELS[e.type], e.orderId ?? "", e.amount, e.settlementId ? "نعم" : "لا"]));
    rows.push([], ["المستحق للحساب", statement.data.balance.owedToAccount], ["المستحق على الحساب", statement.data.balance.owedByAccount], ["الصافي", statement.data.balance.net]);
    downloadFile(`statement-${type.toLowerCase()}-${isoDay(new Date())}.csv`, toCSV(rows));
  };

  const b = statement.data?.balance;

  return (
    <div className="space-y-6">
      <PageTitle title="التسويات المالية" subtitle="كشوف حساب السائقين والمطاعم" actions={<Button variant="outline" onClick={exportCSV} disabled={!statement.data}><Download /> تصدير CSV</Button>} />
      <div className="surface flex flex-wrap items-end gap-3 p-4">
        <Tabs value={type} onValueChange={(v) => { setType(v as AccountType); setAccountId(""); }} dir="rtl">
          <TabsList className="h-11 rounded-xl">
            <TabsTrigger value="DRIVER" className="h-9 rounded-lg px-4">السائقون</TabsTrigger>
            <TabsTrigger value="RESTAURANT" className="h-9 rounded-lg px-4">المطاعم</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="min-w-56 flex-1 space-y-1">
          <Label>الحساب</Label>
          <Select value={selected} onValueChange={setAccountId} dir="rtl">
            <SelectTrigger className="h-11"><SelectValue placeholder="اختر الحساب" /></SelectTrigger>
            <SelectContent>{accounts?.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {statement.isPending ? <ListSkeleton rows={3} /> : statement.isError ? <ErrorState onRetry={() => statement.refetch()} /> : b && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label={type === "DRIVER" ? "مستحق للسائق (أجور)" : "مستحق للمطعم"} value={formatSYP(b.owedToAccount)} />
            <StatCard label={type === "DRIVER" ? "نقد بذمة السائق" : "على المطعم"} value={formatSYP(b.owedByAccount)} />
            <StatCard label="الصافي" value={formatSYP(Math.abs(b.net))} hint={b.net >= 0 ? "المنصة تدفع للحساب" : "الحساب يدفع للمنصة"} />
          </div>

          <section className="surface space-y-3 p-5">
            <h2 className="text-lg">إنشاء تسوية لفترة</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1"><Label htmlFor="sf">من</Label><Input id="sf" type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div className="space-y-1"><Label htmlFor="st">إلى</Label><Input id="st" type="date" className="h-11" value={to} onChange={(e) => setTo(e.target.value)} /></div>
              <Button onClick={() => create.mutate()} disabled={create.isPending || !selected}><FilePlus2 /> إنشاء مسودة لـ {accountName}</Button>
            </div>
            {settlements.data && settlements.data.length > 0 && (
              <ul className="divide-y divide-border">
                {settlements.data.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="flex-1 text-sm">{formatDate(s.periodStart)} – {formatDate(s.periodEnd)}</span>
                    <span className="text-sm">له: {formatSYP(s.totalOwedToAccount)} · عليه: {formatSYP(s.totalOwedByAccount)}</span>
                    <span className="font-bold">{s.netAmount >= 0 ? "تدفع المنصة" : "يدفع الحساب"} {formatSYP(Math.abs(s.netAmount))}</span>
                    {s.status === "CONFIRMED" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-status-delivered px-3 py-1 text-xs font-bold text-status-delivered-foreground"><CheckCircle2 className="h-4 w-4" /> مؤكدة</span>
                    ) : (
                      <Button size="sm" variant="mint" onClick={() => confirm.mutate(s.id)} disabled={confirm.isPending}>تأكيد الاستلام/الدفع</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="surface overflow-x-auto p-2">
            <h2 className="p-3 text-lg">كشف الحساب</h2>
            {!statement.data.entries.length ? <EmptyState title="لا توجد حركات" /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statement.data.entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-sm">{formatDateTime(e.createdAt)}</TableCell>
                      <TableCell>{LEDGER_LABELS[e.type]}</TableCell>
                      <TableCell className="font-semibold">{formatSYP(e.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.type === "SETTLEMENT" ? "—" : e.settlementId ? "مسوّى" : "مفتوح"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
