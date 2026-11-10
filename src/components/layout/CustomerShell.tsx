import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Home, LogIn, Receipt, ShoppingBag, User as UserIcon } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { useSession } from "@/stores/session";
import { cartCount, useCart } from "@/stores/cart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navCls = "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl px-3 text-xs font-semibold text-muted-foreground transition-colors hover:text-primary";
const activeCls = { className: cn(navCls, "text-primary") };

export function CustomerShell({ children, hideBottomNav }: { children: ReactNode; hideBottomNav?: boolean }) {
  const user = useSession((s) => s.user);
  const hydrated = useSession((s) => s.hydrated);
  const lines = useCart((s) => s.lines);
  const count = cartCount(lines);
  const navigate = useNavigate();
  const isCustomer = user?.role === "CUSTOMER";

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" aria-label="الرئيسية">
            <Logo className="h-9" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="التنقل الرئيسي">
            <Link to="/" className={navCls} activeProps={activeCls} activeOptions={{ exact: true }}>الرئيسية</Link>
            {isCustomer && <Link to="/orders" className={navCls} activeProps={activeCls}>طلباتي</Link>}
            {isCustomer && <Link to="/profile" className={navCls} activeProps={activeCls}>حسابي</Link>}
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="relative" aria-label={`السلة (${count})`} onClick={() => navigate({ to: "/cart" })}>
              <ShoppingBag />
              {count > 0 && (
                <span className="absolute -top-1 -left-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-primary-foreground">{count}</span>
              )}
            </Button>
            {hydrated && !user && (
              <Button onClick={() => navigate({ to: "/login", search: { role: undefined } })}>
                <LogIn /> دخول
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      {!hideBottomNav && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden" aria-label="التنقل السفلي">
          <div className="mx-auto grid max-w-md grid-cols-4 py-1.5">
            <Link to="/" className={navCls} activeProps={activeCls} activeOptions={{ exact: true }}><Home className="h-5 w-5" />الرئيسية</Link>
            <Link to="/cart" className={navCls} activeProps={activeCls}><ShoppingBag className="h-5 w-5" />السلة</Link>
            <Link to="/orders" className={navCls} activeProps={activeCls}><Receipt className="h-5 w-5" />طلباتي</Link>
            <Link to="/profile" className={navCls} activeProps={activeCls}><UserIcon className="h-5 w-5" />حسابي</Link>
          </div>
        </nav>
      )}
    </div>
  );
}
