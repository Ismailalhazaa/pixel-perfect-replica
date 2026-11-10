import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Bike, LogOut, Navigation, Wallet } from "lucide-react";
import { RequireRole } from "@/components/layout/RequireRole";
import { Logo } from "@/components/common/Logo";
import { Button } from "@/components/ui/button";
import { useSession } from "@/stores/session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [
      { title: "تطبيق السائق – وصّلني" },
      { name: "description", content: "استقبل طلبات التوصيل وتابع أرباحك." },
      { property: "og:title", content: "تطبيق السائق – وصّلني" },
      { property: "og:description", content: "واجهة السائقين في وصّلني." },
    ],
  }),
  component: () => (
    <RequireRole role="DRIVER">
      <DriverShell />
    </RequireRole>
  ),
});

const navCls = "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-semibold text-muted-foreground";

function DriverShell() {
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const navigate = useNavigate();
  return (
    <div className="mx-auto min-h-screen max-w-lg pb-24">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
        <Logo className="h-9" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{user?.name}</span>
          <Button variant="ghost" size="icon" aria-label="تسجيل الخروج" onClick={() => { logout(); navigate({ to: "/login", search: { role: undefined } }); }}><LogOut /></Button>
        </div>
      </header>
      <main className="p-4"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur" aria-label="تنقل السائق">
        <div className="mx-auto grid max-w-lg grid-cols-3 py-1.5">
          <Link to="/driver" activeOptions={{ exact: true }} className={navCls} activeProps={{ className: cn(navCls, "text-primary") }}><Bike className="h-5 w-5" />الطلبات</Link>
          <Link to="/driver/active" className={navCls} activeProps={{ className: cn(navCls, "text-primary") }}><Navigation className="h-5 w-5" />التوصيل الحالي</Link>
          <Link to="/driver/earnings" className={navCls} activeProps={{ className: cn(navCls, "text-primary") }}><Wallet className="h-5 w-5" />الأرباح</Link>
        </div>
      </nav>
    </div>
  );
}
