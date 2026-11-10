import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { MenuItem } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatSYP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartLineOption } from "@/stores/cart";

export function ItemDialog({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (args: { item: MenuItem; options: CartLineOption[]; quantity: number; notes?: string }) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!item) return;
    const init: Record<string, string[]> = {};
    item.optionGroups.forEach((g) => (init[g.id] = g.required ? [g.options[0].id] : []));
    setSelected(init);
    setQuantity(1);
    setNotes("");
  }, [item]);

  const options: CartLineOption[] = useMemo(() => {
    if (!item) return [];
    return item.optionGroups.flatMap((g) =>
      (selected[g.id] ?? []).map((oid) => {
        const o = g.options.find((x) => x.id === oid)!;
        return { groupId: g.id, optionId: o.id, name: o.name, priceDelta: o.priceDelta };
      }),
    );
  }, [item, selected]);

  if (!item) return null;
  const unit = item.price + options.reduce((a, o) => a + o.priceDelta, 0);
  const missing = item.optionGroups.some((g) => g.required && !(selected[g.id]?.length));

  const toggle = (gid: string, oid: string, max: number, single: boolean) =>
    setSelected((s) => {
      const cur = s[gid] ?? [];
      if (single) return { ...s, [gid]: [oid] };
      if (cur.includes(oid)) return { ...s, [gid]: cur.filter((x) => x !== oid) };
      if (cur.length >= max) return s;
      return { ...s, [gid]: [...cur, oid] };
    });

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl p-0 sm:max-w-lg" dir="rtl">
        {item.imageUrl && <img src={item.imageUrl} alt="" className="h-48 w-full object-cover" />}
        <div className="space-y-5 px-6 pb-2">
          <DialogHeader className="text-right">
            <DialogTitle className="text-2xl text-brand-ink">{item.name}</DialogTitle>
            {item.description && <DialogDescription>{item.description}</DialogDescription>}
          </DialogHeader>
          {item.optionGroups.map((g) => {
            const single = g.maxSelect === 1;
            return (
              <fieldset key={g.id}>
                <legend className="mb-2 flex w-full items-center justify-between font-bold text-brand-ink">
                  {g.name}
                  <span className="text-xs font-normal text-muted-foreground">{g.required ? "مطلوب" : `اختياري · حتى ${g.maxSelect}`}</span>
                </legend>
                <div className="space-y-2">
                  {g.options.map((o) => {
                    const on = selected[g.id]?.includes(o.id) ?? false;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        role={single ? "radio" : "checkbox"}
                        aria-checked={on}
                        onClick={() => toggle(g.id, o.id, g.maxSelect, single)}
                        className={cn(
                          "flex min-h-12 w-full items-center justify-between rounded-xl border-2 border-border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          on && "border-primary bg-brand-soft",
                        )}
                      >
                        <span className="font-semibold">{o.name}</span>
                        <span className="text-muted-foreground">{o.priceDelta ? `+ ${formatSYP(o.priceDelta)}` : "بدون إضافة"}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
          <div className="space-y-2">
            <Label htmlFor="item-notes">ملاحظات</Label>
            <Textarea id="item-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلاً: بدون بصل" />
          </div>
        </div>
        <DialogFooter className="sticky bottom-0 flex-row items-center gap-3 border-t border-border bg-card px-6 py-4">
          <div className="flex items-center gap-2" aria-label="الكمية">
            <Button type="button" variant="outline" size="icon" aria-label="إنقاص" onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus /></Button>
            <span className="w-8 text-center text-lg font-bold" aria-live="polite">{quantity}</span>
            <Button type="button" variant="outline" size="icon" aria-label="زيادة" onClick={() => setQuantity((q) => q + 1)}><Plus /></Button>
          </div>
          <Button className="flex-1" size="lg" disabled={missing} onClick={() => onAdd({ item, options, quantity, notes: notes.trim() || undefined })}>
            أضف للسلة · {formatSYP(unit * quantity)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
