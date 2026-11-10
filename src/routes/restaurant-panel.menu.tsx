import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { MenuItem, MenuItemOptionGroup, Restaurant } from "@/types";
import * as api from "@/services/api";
import { PageTitle } from "@/components/layout/PanelShell";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMyRestaurant } from "@/hooks/use-my-accounts";
import { DAY_NAMES, formatSYP } from "@/lib/format";

export const Route = createFileRoute("/restaurant-panel/menu")({
  component: MenuPage,
});

type Draft = Omit<MenuItem, "id"> & { id?: string };
const rid = () => crypto.randomUUID();

function MenuPage() {
  const rest = useMyRestaurant();
  if (rest.isPending) return <ListSkeleton />;
  if (rest.isError) return <ErrorState message={(rest.error as Error).message} onRetry={() => rest.refetch()} />;
  return (
    <div>
      <PageTitle title="إدارة القائمة" subtitle={rest.data.name} />
      <Tabs defaultValue="items" dir="rtl">
        <TabsList className="mb-4 h-12 rounded-xl">
          <TabsTrigger value="items" className="h-10 rounded-lg px-5">الأصناف</TabsTrigger>
          <TabsTrigger value="settings" className="h-10 rounded-lg px-5">الدوام والإعدادات</TabsTrigger>
        </TabsList>
        <TabsContent value="items"><Items restaurant={rest.data} /></TabsContent>
        <TabsContent value="settings"><Settings restaurant={rest.data} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Items({ restaurant }: { restaurant: Restaurant }) {
  const qc = useQueryClient();
  const menu = useQuery({ queryKey: ["menu", restaurant.id], queryFn: () => api.getMenu(restaurant.id) });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["menu", restaurant.id] });
  const saveItem = useMutation({ mutationFn: api.saveMenuItem, onSuccess: () => { refresh(); setDraft(null); toast.success("تم الحفظ"); }, onError: (e: Error) => toast.error(e.message) });
  const toggle = useMutation({ mutationFn: (m: MenuItem) => api.saveMenuItem({ ...m, isAvailable: !m.isAvailable }), onSuccess: refresh });
  const delItem = useMutation({ mutationFn: api.deleteMenuItem, onSuccess: () => { refresh(); toast.success("تم حذف الصنف"); } });
  const saveCat = useMutation({ mutationFn: api.saveCategory, onSuccess: () => { refresh(); setNewCat(""); } });
  const delCat = useMutation({ mutationFn: api.deleteCategory, onSuccess: refresh, onError: (e: Error) => toast.error(e.message) });

  if (menu.isPending) return <ListSkeleton />;
  if (menu.isError) return <ErrorState onRetry={() => menu.refetch()} />;
  const { categories, items } = menu.data;

  return (
    <div className="space-y-6">
      <form className="surface flex flex-wrap items-end gap-2 p-4" onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) saveCat.mutate({ restaurantId: restaurant.id, name: newCat.trim(), sortOrder: categories.length }); }}>
        <div className="flex-1 space-y-2"><Label htmlFor="new-cat">تصنيف جديد</Label><Input id="new-cat" className="h-11" value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="مثلاً: وجبات عائلية" /></div>
        <Button type="submit"><Plus /> إضافة تصنيف</Button>
      </form>
      {!categories.length && <EmptyState title="لا توجد تصنيفات" description="أضف تصنيفاً أولاً ثم أضف الأصناف داخله." />}
      {categories.map((c) => {
        const list = items.filter((m) => m.categoryId === c.id);
        return (
          <section key={c.id} className="surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg">{c.name} <span className="text-sm font-normal text-muted-foreground">({list.length})</span></h2>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setDraft({ restaurantId: restaurant.id, categoryId: c.id, name: "", description: "", imageUrl: restaurant.imageUrl, price: 10000, isAvailable: true, optionGroups: [] })}><Plus /> صنف</Button>
                {!list.length && <Button size="sm" variant="ghost" aria-label={`حذف تصنيف ${c.name}`} onClick={() => delCat.mutate(c.id)}><Trash2 /></Button>}
              </div>
            </div>
            <ul className="divide-y divide-border">
              {list.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                  <img src={m.imageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <div className="min-w-40 flex-1">
                    <p className="font-bold">{m.name}</p>
                    <p className="text-sm text-muted-foreground">{formatSYP(m.price)}{m.optionGroups.length ? ` · ${m.optionGroups.length} مجموعات خيارات` : ""}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={m.isAvailable} onCheckedChange={() => toggle.mutate(m)} aria-label={`توفر ${m.name}`} />{m.isAvailable ? "متوفر" : "غير متوفر"}</label>
                  <Button size="icon" variant="ghost" aria-label={`تعديل ${m.name}`} onClick={() => setDraft(m)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label={`حذف ${m.name}`} onClick={() => delItem.mutate(m.id)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {draft && <ItemEditor draft={draft} categories={categories} onClose={() => setDraft(null)} onSave={(d) => saveItem.mutate(d)} saving={saveItem.isPending} />}
    </div>
  );
}

function ItemEditor({ draft, categories, onClose, onSave, saving }: { draft: Draft; categories: { id: string; name: string }[]; onClose: () => void; onSave: (d: Draft) => void; saving: boolean }) {
  const [d, setD] = useState<Draft>(draft);
  const setGroup = (gi: number, patch: Partial<MenuItemOptionGroup>) => setD((x) => ({ ...x, optionGroups: x.optionGroups.map((g, i) => (i === gi ? { ...g, ...patch } : g)) }));
  const valid = d.name.trim().length >= 2 && Number.isInteger(d.price) && d.price > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-right"><DialogTitle>{d.id ? "تعديل صنف" : "صنف جديد"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="mi-name">الاسم</Label><Input id="mi-name" className="h-11" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="mi-price">السعر (ل.س)</Label><Input id="mi-price" type="number" step={500} min={0} className="h-11" value={d.price} onChange={(e) => setD({ ...d, price: Math.round(Number(e.target.value)) })} /></div>
          <div className="space-y-2">
            <Label>التصنيف</Label>
            <Select value={d.categoryId} onValueChange={(v) => setD({ ...d, categoryId: v })} dir="rtl">
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="mi-img">رابط الصورة</Label><Input id="mi-img" dir="ltr" className="h-11" value={d.imageUrl ?? ""} onChange={(e) => setD({ ...d, imageUrl: e.target.value })} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="mi-desc">الوصف</Label><Textarea id="mi-desc" value={d.description ?? ""} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={d.isAvailable} onCheckedChange={(v) => setD({ ...d, isAvailable: v })} /> متوفر</label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base">الخيارات والإضافات</h3>
            <Button size="sm" variant="outline" onClick={() => setD({ ...d, optionGroups: [...d.optionGroups, { id: rid(), name: "إضافات", required: false, maxSelect: 2, options: [{ id: rid(), name: "", priceDelta: 0 }] }] })}><Plus /> مجموعة</Button>
          </div>
          {d.optionGroups.map((g, gi) => (
            <div key={g.id} className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 space-y-1"><Label htmlFor={`g-${g.id}`}>اسم المجموعة</Label><Input id={`g-${g.id}`} className="h-10" value={g.name} onChange={(e) => setGroup(gi, { name: e.target.value })} /></div>
                <div className="w-24 space-y-1"><Label htmlFor={`gm-${g.id}`}>الحد الأقصى</Label><Input id={`gm-${g.id}`} type="number" min={1} className="h-10" value={g.maxSelect} onChange={(e) => setGroup(gi, { maxSelect: Math.max(1, Number(e.target.value)) })} /></div>
                <label className="flex h-10 items-center gap-2 text-sm"><Checkbox checked={g.required} onCheckedChange={(v) => setGroup(gi, { required: !!v })} /> مطلوب</label>
                <Button size="icon" variant="ghost" aria-label="حذف المجموعة" onClick={() => setD({ ...d, optionGroups: d.optionGroups.filter((_, i) => i !== gi) })}><Trash2 /></Button>
              </div>
              {g.options.map((o, oi) => (
                <div key={o.id} className="flex gap-2">
                  <Input aria-label="اسم الخيار" className="h-10 flex-1" placeholder="اسم الخيار" value={o.name} onChange={(e) => setGroup(gi, { options: g.options.map((x, i) => (i === oi ? { ...x, name: e.target.value } : x)) })} />
                  <Input aria-label="فرق السعر" type="number" step={500} className="h-10 w-32" value={o.priceDelta} onChange={(e) => setGroup(gi, { options: g.options.map((x, i) => (i === oi ? { ...x, priceDelta: Math.round(Number(e.target.value)) } : x)) })} />
                  <Button size="icon" variant="ghost" aria-label="حذف الخيار" onClick={() => setGroup(gi, { options: g.options.filter((_, i) => i !== oi) })}><Trash2 /></Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setGroup(gi, { options: [...g.options, { id: rid(), name: "", priceDelta: 0 }] })}><Plus /> خيار</Button>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button className="w-full" disabled={!valid || saving} onClick={() => onSave({ ...d, name: d.name.trim(), optionGroups: d.optionGroups.map((g) => ({ ...g, options: g.options.filter((o) => o.name.trim()) })).filter((g) => g.options.length) })}>حفظ الصنف</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Settings({ restaurant }: { restaurant: Restaurant }) {
  const qc = useQueryClient();
  const [hours, setHours] = useState(restaurant.workingHours);
  const [prep, setPrep] = useState(restaurant.avgPrepMinutes);
  const save = useMutation({
    mutationFn: (patch: Partial<Restaurant>) => api.updateRestaurant(restaurant.id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["myRestaurant"] }); toast.success("تم حفظ الإعدادات"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="surface space-y-4 p-5">
        <h2 className="text-lg">حالة المطعم</h2>
        <label className="flex min-h-11 items-center justify-between gap-3"><span className="font-semibold">المطعم مفتوح</span><Switch checked={restaurant.isOpen} onCheckedChange={(v) => save.mutate({ isOpen: v })} /></label>
        <label className="flex min-h-11 items-center justify-between gap-3"><span className="font-semibold">إيقاف الطلبات مؤقتاً</span><Switch checked={!restaurant.acceptingOrders} onCheckedChange={(v) => save.mutate({ acceptingOrders: !v })} /></label>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-2"><Label htmlFor="avgprep">متوسط وقت التحضير (دقيقة)</Label><Input id="avgprep" type="number" className="h-11" value={prep} onChange={(e) => setPrep(Number(e.target.value))} /></div>
          <Button variant="outline" onClick={() => save.mutate({ avgPrepMinutes: prep })}>حفظ</Button>
        </div>
      </section>
      <section className="surface space-y-3 p-5">
        <h2 className="text-lg">أوقات الدوام</h2>
        {hours.map((h, i) => (
          <div key={h.day} className="flex items-center gap-2">
            <span className="w-20 text-sm font-semibold">{DAY_NAMES[h.day]}</span>
            <Input aria-label={`فتح ${DAY_NAMES[h.day]}`} type="time" className="h-10" value={h.open} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))} />
            <span className="text-muted-foreground">—</span>
            <Input aria-label={`إغلاق ${DAY_NAMES[h.day]}`} type="time" className="h-10" value={h.close} onChange={(e) => setHours(hours.map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))} />
          </div>
        ))}
        <Button onClick={() => save.mutate({ workingHours: hours })}>حفظ الأوقات</Button>
      </section>
    </div>
  );
}
