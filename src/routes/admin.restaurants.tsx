import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/services/api";
import { PageTitle } from "@/components/layout/PanelShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Rating } from "@/components/common/Stars";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/admin/restaurants")({
  component: AdminRestaurants,
});

function AdminRestaurants() {
  const qc = useQueryClient();
  const rests = useQuery({ queryKey: ["restaurants", { all: true }], queryFn: () => api.getRestaurants({ includeUnapproved: true }) });
  const zones = useQuery({ queryKey: ["zones"], queryFn: api.getZones });
  const m = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) => api.updateRestaurant(id, { isApproved }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["restaurants"] }); toast.success(r.isApproved ? `تمت الموافقة على ${r.name}` : `تم إيقاف ${r.name}`); },
  });
  return (
    <div>
      <PageTitle title="المطاعم" subtitle="الموافقة على المطاعم أو إيقافها" />
      {rests.isPending ? <ListSkeleton /> : rests.isError ? <ErrorState onRetry={() => rests.refetch()} /> : !rests.data.length ? <EmptyState title="لا توجد مطاعم" /> : (
        <div className="surface overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">المطعم</TableHead>
                <TableHead className="text-right">التصنيف</TableHead>
                <TableHead className="text-right">المناطق</TableHead>
                <TableHead className="text-right">العمولة</TableHead>
                <TableHead className="text-right">التقييم</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rests.data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><div className="flex items-center gap-3"><img src={r.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="font-bold">{r.name}</span></div></TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell className="text-sm">{r.zoneIds.map((z) => zones.data?.find((x) => x.id === z)?.name).filter(Boolean).join("، ")}</TableCell>
                  <TableCell>{r.commissionPercent}%</TableCell>
                  <TableCell><Rating value={r.ratingAvg} count={r.ratingCount} /></TableCell>
                  <TableCell>
                    <span className={r.isApproved ? "rounded-full bg-status-delivered px-3 py-1 text-xs font-bold text-status-delivered-foreground" : "rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground"}>
                      {r.isApproved ? "معتمد" : "موقوف"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant={r.isApproved ? "outline" : "mint"} onClick={() => m.mutate({ id: r.id, isApproved: !r.isApproved })}>
                      {r.isApproved ? "إيقاف" : "موافقة"}
                    </Button>
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
