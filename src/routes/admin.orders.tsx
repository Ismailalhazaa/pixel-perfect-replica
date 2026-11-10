import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { OrderStatus } from "@/types";
import * as api from "@/services/api";
import { PageTitle } from "@/components/layout/PanelShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { StatusChip } from "@/components/common/StatusChip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS } from "@/lib/orderStatus";
import { formatDateTime, formatSYP } from "@/lib/format";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

const ALL = "ALL";

function AdminOrders() {
  const [status, setStatus] = useState<string>(ALL);
  const [restaurantId, setRestaurantId] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [q, setQ] = useState("");
  const rests = useQuery({ queryKey: ["restaurants", { all: true }], queryFn: () => api.getRestaurants({ includeUnapproved: true }) });
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: api.getDrivers });
  const orders = useQuery({
    queryKey: ["orders", { admin: true, status, restaurantId, from }],
    queryFn: () => api.getOrders({
      statuses: status === ALL ? undefined : [status as OrderStatus],
      restaurantId: restaurantId === ALL ? undefined : restaurantId,
      from: from ? new Date(from).toISOString() : undefined,
    }),
  });
  const list = orders.data?.filter((o) => !q || o.code.includes(q.trim().toUpperCase()) || o.customerPhone.includes(q.trim()));

  return (
    <div>
      <PageTitle title="كل الطلبات" />
      <div className="surface mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><Label htmlFor="oq">بحث بالرمز أو الهاتف</Label><Input id="oq" className="h-11" value={q} onChange={(e) => setQ(e.target.value)} placeholder="WS-1010" /></div>
        <div className="space-y-1">
          <Label>الحالة</Label>
          <Select value={status} onValueChange={setStatus} dir="rtl">
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل الحالات</SelectItem>
              {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>المطعم</Label>
          <Select value={restaurantId} onValueChange={setRestaurantId} dir="rtl">
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>كل المطاعم</SelectItem>
              {rests.data?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label htmlFor="ofrom">من تاريخ</Label><Input id="ofrom" type="date" className="h-11" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      </div>
      {orders.isPending ? <ListSkeleton /> : orders.isError ? <ErrorState onRetry={() => orders.refetch()} /> : !list?.length ? <EmptyState title="لا توجد طلبات مطابقة" /> : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الرمز</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">المطعم</TableHead>
                <TableHead className="text-right">السائق</TableHead>
                <TableHead className="text-right">العنوان</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-bold">{o.code}</TableCell>
                  <TableCell className="text-sm">{formatDateTime(o.createdAt)}</TableCell>
                  <TableCell>{rests.data?.find((r) => r.id === o.restaurantId)?.name}</TableCell>
                  <TableCell>{drivers.data?.find((d) => d.id === o.driverId)?.user.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{o.deliveryAddress.label}</TableCell>
                  <TableCell className="font-semibold">{formatSYP(o.total)}</TableCell>
                  <TableCell><StatusChip status={o.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
