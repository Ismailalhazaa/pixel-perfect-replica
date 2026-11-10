import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Clock, ShoppingBag } from "lucide-react";
import * as api from "@/services/api";
import type { MenuItem } from "@/types";
import { CustomerShell } from "@/components/layout/CustomerShell";
import { ErrorState, ListSkeleton } from "@/components/common/states";
import { Rating } from "@/components/common/Stars";
import { ItemDialog } from "@/components/customer/ItemDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cartCount, cartSubtotal, useCart, type CartLineOption } from "@/stores/cart";
import { formatSYP } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/restaurant/$id")({
  head: () => ({
    meta: [
      { title: "قائمة المطعم – وصّلني" },
      { name: "description", content: "تصفح قائمة الطعام واطلب مباشرة مع التوصيل والدفع عند الاستلام." },
      { property: "og:title", content: "قائمة المطعم – وصّلني" },
      { property: "og:description", content: "تصفح القائمة واطلب الآن." },
    ],
  }),
  component: RestaurantPage,
});

type Pending = { item: MenuItem; options: CartLineOption[]; quantity: number; notes?: string };

function RestaurantPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const rest = useQuery({ queryKey: ["restaurant", id], queryFn: () => api.getRestaurant(id) });
  const menu = useQuery({ queryKey: ["menu", id], queryFn: () => api.getMenu(id) });
  const [open, setOpen] = useState<MenuItem | null>(null);
  const [conflict, setConflict] = useState<Pending | null>(null);
  const cart = useCart();
  const count = cart.restaurantId === id ? cartCount(cart.lines) : 0;

  const add = (p: Pending) => {
    if (!rest.data) return;
    const ok = cart.addLine(id, rest.data.name, {
      menuItemId: p.item.id, name: p.item.name, imageUrl: p.item.imageUrl, basePrice: p.item.price,
      options: p.options, quantity: p.quantity, notes: p.notes,
    });
    if (!ok) return setConflict(p);
    setOpen(null);
    toast.success(`أُضيف ${p.item.name} إلى السلة`);
  };

  const canOrder = rest.data ? rest.data.isOpen && rest.data.acceptingOrders : false;

  return (
    <CustomerShell hideBottomNav={count > 0}>
      <Link to="/" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"><ArrowRight className="h-4 w-4" /> كل المطاعم</Link>
      {rest.isPending ? (
        <Skeleton className="h-56 w-full rounded-3xl" />
      ) : rest.isError ? (
        <ErrorState message={(rest.error as Error).message} onRetry={() => rest.refetch()} />
      ) : (
        <header className="relative overflow-hidden rounded-3xl">
          <img src={rest.data.imageUrl} alt="" width={976} height={688} className="h-56 w-full object-cover md:h-72" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-ink via-brand-ink/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-brand-ink-foreground">
            <h1 className="text-3xl !text-brand-ink-foreground">{rest.data.name}</h1>
            <p className="mt-1 text-sm opacity-90">{rest.data.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Rating value={rest.data.ratingAvg} count={rest.data.ratingCount} className="rounded-full bg-card px-3 py-1 text-foreground" />
              <span className="inline-flex items-center gap-1 rounded-full bg-card/20 px-3 py-1"><Clock className="h-4 w-4" /> {rest.data.avgPrepMinutes + 15} دقيقة تقريباً</span>
              {!canOrder && <span className="rounded-full bg-card px-3 py-1 font-bold text-destructive">لا يستقبل طلبات حالياً</span>}
            </div>
          </div>
        </header>
      )}

      <div className="mt-6">
        {menu.isPending ? (
          <ListSkeleton rows={6} />
        ) : menu.isError ? (
          <ErrorState message={(menu.error as Error).message} onRetry={() => menu.refetch()} />
        ) : (
          <>
            <nav className="sticky top-16 z-20 -mx-4 mb-4 flex gap-2 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur" aria-label="أقسام القائمة">
              {menu.data.categories.map((c) => (
                <a key={c.id} href={`#cat-${c.id}`} className="min-h-11 shrink-0 content-center rounded-full border border-border bg-card px-4 text-sm font-semibold">{c.name}</a>
              ))}
            </nav>
            {menu.data.categories.map((c) => (
              <section key={c.id} id={`cat-${c.id}`} className="mb-8 scroll-mt-32">
                <h2 className="mb-3 text-xl">{c.name}</h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {menu.data.items.filter((m) => m.categoryId === c.id).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!m.isAvailable || !canOrder}
                      onClick={() => setOpen(m)}
                      className={cn("surface flex items-stretch gap-3 overflow-hidden p-3 text-right transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60")}
                    >
                      <div className="flex flex-1 flex-col">
                        <span className="font-bold text-brand-ink">{m.name}</span>
                        <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{m.description}</span>
                        <span className="mt-auto pt-2 font-bold text-primary">{m.isAvailable ? formatSYP(m.price) : "غير متوفر"}</span>
                      </div>
                      <img src={m.imageUrl} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4">
          <Button size="lg" className="mx-auto flex h-14 w-full max-w-xl justify-between rounded-2xl text-base shadow-card" onClick={() => navigate({ to: "/cart" })}>
            <span className="inline-flex items-center gap-2"><ShoppingBag /> عرض السلة ({count})</span>
            <span>{formatSYP(cartSubtotal(cart.lines))}</span>
          </Button>
        </div>
      )}

      <ItemDialog item={open} onClose={() => setOpen(null)} onAdd={add} />

      <AlertDialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>سلتك تحتوي على طلب من مطعم آخر</AlertDialogTitle>
            <AlertDialogDescription>
              يمكن الطلب من مطعم واحد فقط في كل مرة. هل تريد إفراغ السلة من «{cart.restaurantName}» والبدء بطلب جديد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const p = conflict!;
                cart.clear();
                setConflict(null);
                add(p);
              }}
            >
              إفراغ السلة وإضافة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CustomerShell>
  );
}
