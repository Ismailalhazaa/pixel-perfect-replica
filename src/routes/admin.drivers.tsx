import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Driver } from "@/types";
import * as api from "@/services/api";
import { PageTitle } from "@/components/layout/PanelShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Rating } from "@/components/common/Stars";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/admin/drivers")({
  component: AdminDrivers,
});

const VEHICLE: Record<Driver["vehicleType"], string> = { MOTORBIKE: "دراجة نارية", BICYCLE: "دراجة هوائية", CAR: "سيارة" };

function AdminDrivers() {
  const qc = useQueryClient();
  const drivers = useQuery({ queryKey: ["drivers"], queryFn: api.getDrivers });
  const m = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) => api.updateDriver(id, isApproved ? { isApproved } : { isApproved, isAvailable: false }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ["drivers"] }); toast.success(d.isApproved ? "تمت الموافقة على السائق" : "تم إيقاف السائق"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div>
      <PageTitle title="السائقون" subtitle="الموافقة على السائقين أو إيقافهم" />
      {drivers.isPending ? <ListSkeleton /> : drivers.isError ? <ErrorState onRetry={() => drivers.refetch()} /> : !drivers.data.length ? <EmptyState title="لا يوجد سائقون" /> : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">السائق</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">المركبة</TableHead>
                <TableHead className="text-right">التقييم</TableHead>
                <TableHead className="text-right">التوفر</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-bold">{d.user.name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{d.user.phone}</TableCell>
                  <TableCell>{VEHICLE[d.vehicleType]}</TableCell>
                  <TableCell><Rating value={d.ratingAvg} count={d.ratingCount} /></TableCell>
                  <TableCell>{d.isAvailable ? <span className="font-semibold text-mint">متاح</span> : <span className="text-muted-foreground">غير متاح</span>}</TableCell>
                  <TableCell>{d.isApproved ? "معتمد" : "بانتظار الموافقة / موقوف"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant={d.isApproved ? "outline" : "mint"} onClick={() => m.mutate({ id: d.id, isApproved: !d.isApproved })}>{d.isApproved ? "إيقاف" : "موافقة"}</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
