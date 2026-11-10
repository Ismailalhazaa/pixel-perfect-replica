import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { Zone } from "@/types";
import * as api from "@/services/api";
import { PageTitle } from "@/components/layout/PanelShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/zones")({
  component: Zones,
});

function Zones() {
  const qc = useQueryClient();
  const zones = useQuery({ queryKey: ["zones"], queryFn: api.getZones });
  const [name, setName] = useState("");
  const [fee, setFee] = useState(5000);
  const save = useMutation({
    mutationFn: api.saveZone,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["zones"] }); toast.success("تم الحفظ"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="max-w-3xl">
      <PageTitle title="مناطق التوصيل" subtitle="رسوم التوصيل تُحسب حسب منطقة الزبون" />
      <form className="surface mb-4 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) return; save.mutate({ name: name.trim(), deliveryFee: Math.round(fee), isActive: true }); setName(""); }}>
        <div className="flex-1 space-y-1"><Label htmlFor="zn">اسم المنطقة</Label><Input id="zn" className="h-11" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: دمشق - المزة" /></div>
        <div className="w-40 space-y-1"><Label htmlFor="zf">رسوم التوصيل (ل.س)</Label><Input id="zf" type="number" step={500} className="h-11" value={fee} onChange={(e) => setFee(Number(e.target.value))} /></div>
        <Button type="submit"><Plus /> إضافة</Button>
      </form>
      {zones.isPending ? <ListSkeleton rows={2} /> : zones.isError ? <ErrorState onRetry={() => zones.refetch()} /> : !zones.data.length ? <EmptyState title="لا توجد مناطق" /> : (
        <ul className="space-y-3">{zones.data.map((z) => <ZoneRow key={z.id} zone={z} onSave={(p) => save.mutate({ ...z, ...p })} />)}</ul>
      )}
    </div>
  );
}

function ZoneRow({ zone, onSave }: { zone: Zone; onSave: (p: Partial<Zone>) => void }) {
  const [fee, setFee] = useState(zone.deliveryFee);
  return (
    <li className="surface flex flex-wrap items-center gap-3 p-4">
      <p className="flex-1 font-bold">{zone.name}</p>
      <Input aria-label={`رسوم ${zone.name}`} type="number" step={500} className="h-10 w-36" value={fee} onChange={(e) => setFee(Number(e.target.value))} />
      <Button size="sm" variant="outline" disabled={fee === zone.deliveryFee} onClick={() => onSave({ deliveryFee: Math.round(fee) })}>حفظ الرسوم</Button>
      <label className="flex items-center gap-2 text-sm"><Switch checked={zone.isActive} onCheckedChange={(v) => onSave({ isActive: v })} /> {zone.isActive ? "مفعّلة" : "معطّلة"}</label>
    </li>
  );
}
