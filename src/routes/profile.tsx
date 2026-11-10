import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, MapPin, Plus, Star, Trash2 } from "lucide-react";
import type { Address } from "@/types";
import * as api from "@/services/api";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { RequireRole } from "@/components/layout/RequireRole";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { AddressForm } from "@/components/customer/AddressForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/stores/session";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "حسابي – وصّلني" },
      { name: "description", content: "عدّل بياناتك وأدر عناوين التوصيل." },
      { property: "og:title", content: "حسابي – وصّلني" },
      { property: "og:description", content: "إدارة حسابك في وصّلني." },
    ],
  }),
  component: () => (
    <RequireRole role="CUSTOMER">
      <Profile />
    </RequireRole>
  ),
});

function Profile() {
  const { user, setUser, logout } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(user!.name);
  const [email, setEmail] = useState(user!.email ?? "");
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const addresses = useQuery({ queryKey: ["addresses", user!.id], queryFn: () => api.getAddresses(user!.id) });

  const saveUser = useMutation({
    mutationFn: () => api.updateUser(user!.id, { name: name.trim(), email: email.trim() || undefined }),
    onSuccess: (u) => { setUser(u); toast.success("تم حفظ بياناتك"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["addresses", user!.id] });
  const saveAddr = useMutation({ mutationFn: api.saveAddress, onSuccess: () => { refresh(); setEditing(null); toast.success("تم حفظ العنوان"); }, onError: (e: Error) => toast.error(e.message) });
  const delAddr = useMutation({ mutationFn: api.deleteAddress, onSuccess: () => { refresh(); toast.success("تم حذف العنوان"); } });

  return (
    <CustomerShell>
      <h1 className="mb-5 text-2xl">حسابي</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface space-y-4 p-5">
          <h2 className="text-lg">البيانات الشخصية</h2>
          <div className="space-y-2"><Label htmlFor="p-name">الاسم</Label><Input id="p-name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="p-phone">رقم الهاتف</Label><Input id="p-phone" className="h-11 text-right" dir="ltr" value={user!.phone} disabled /></div>
          <div className="space-y-2"><Label htmlFor="p-email">البريد الإلكتروني</Label><Input id="p-email" className="h-11 text-right" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveUser.mutate()} disabled={saveUser.isPending || name.trim().length < 3}>حفظ</Button>
            <Button variant="outline" onClick={() => { logout(); navigate({ to: "/" }); }}><LogOut /> تسجيل الخروج</Button>
          </div>
        </section>

        <section className="surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">عناويني</h2>
            <Button variant="outline" size="sm" onClick={() => setEditing("new")}><Plus /> عنوان جديد</Button>
          </div>
          {addresses.isPending ? <ListSkeleton rows={2} /> : addresses.isError ? <ErrorState onRetry={() => addresses.refetch()} /> : !addresses.data.length ? (
            <EmptyState icon={<MapPin className="h-8 w-8" />} title="لا توجد عناوين" description="أضف عنوانك الأول لتسريع الطلب." />
          ) : (
            <ul className="space-y-2">
              {addresses.data.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <MapPin className="h-5 w-5 shrink-0 text-brand" />
                  <button type="button" className="flex-1 text-right" onClick={() => setEditing(a)}>
                    <p className="font-bold">{a.label} {a.isDefault && <span className="mr-1 rounded-full bg-mint-soft px-2 py-0.5 text-xs text-mint-foreground">افتراضي</span>}</p>
                    {a.details && <p className="text-sm text-muted-foreground">{a.details}</p>}
                  </button>
                  {!a.isDefault && <Button variant="ghost" size="icon" aria-label="تعيين كافتراضي" onClick={() => saveAddr.mutate({ ...a, isDefault: true })}><Star /></Button>}
                  <Button variant="ghost" size="icon" aria-label="حذف العنوان" onClick={() => delAddr.mutate(a.id)}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent dir="rtl" className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-xl">
          <DialogHeader className="text-right"><DialogTitle>{editing === "new" ? "عنوان جديد" : "تعديل العنوان"}</DialogTitle></DialogHeader>
          {editing && (
            <AddressForm
              initial={editing === "new" ? undefined : editing}
              submitting={saveAddr.isPending}
              onSubmit={(d) =>
                saveAddr.mutate(editing === "new"
                  ? { ...d, userId: user!.id, isDefault: !addresses.data?.length }
                  : { ...editing, ...d })
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </CustomerShell>
  );
}
