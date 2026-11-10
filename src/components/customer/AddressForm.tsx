import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "@/types";
import * as api from "@/services/api";
import { LazyMap } from "@/components/map/LazyMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DAMASCUS_CENTER } from "@/lib/geo";

export type AddressDraft = Omit<Address, "id" | "userId" | "isDefault">;

/** Pick a location by dragging the pin (or tapping the map) and give it a label. */
export function AddressForm({ initial, onSubmit, submitting, submitLabel = "حفظ العنوان" }: {
  initial?: Partial<AddressDraft>;
  onSubmit: (a: AddressDraft) => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const zones = useQuery({ queryKey: ["zones"], queryFn: api.getZones });
  const [pos, setPos] = useState({ lat: initial?.lat ?? DAMASCUS_CENTER.lat, lng: initial?.lng ?? DAMASCUS_CENTER.lng });
  const [label, setLabel] = useState(initial?.label ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [zoneId, setZoneId] = useState(initial?.zoneId ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm text-muted-foreground">اسحب الدبوس أو اضغط على الخريطة لتحديد موقعك بدقة.</p>
        <LazyMap className="h-64" markers={[{ kind: "customer", ...pos, label: "موقع التوصيل" }]} center={pos} draggableKind="customer" onPick={(lat, lng) => setPos({ lat, lng })} fit={false} zoom={14} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="addr-label">اسم العنوان</Label>
          <Input id="addr-label" className="h-11" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثلاً: البيت - المالكي" />
        </div>
        <div className="space-y-2">
          <Label>المنطقة</Label>
          <Select value={zoneId || undefined} onValueChange={setZoneId} dir="rtl">
            <SelectTrigger className="h-11"><SelectValue placeholder="اختر المنطقة" /></SelectTrigger>
            <SelectContent>
              {zones.data?.filter((z) => z.isActive).map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="addr-details">تفاصيل إضافية</Label>
        <Input id="addr-details" className="h-11" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="الشارع، البناء، الطابق" />
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button
        type="button"
        disabled={submitting}
        onClick={() => {
          if (label.trim().length < 2) return setError("أدخل اسماً للعنوان");
          if (!zoneId) return setError("اختر منطقة التوصيل");
          setError(null);
          onSubmit({ label: label.trim(), details: details.trim() || undefined, lat: pos.lat, lng: pos.lng, zoneId });
        }}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
