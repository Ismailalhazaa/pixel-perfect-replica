import { Link, useNavigate, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { useSession } from "@/stores/session";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PanelNavItem { to: NonNullable<LinkProps["to"]>; label: string; icon: LucideIcon; exact?: boolean }

/** Desktop-first shell (sidebar) used by restaurant and admin panels. */
export function PanelShell({ title, nav, children }: { title: string; nav: PanelNavItem[]; children: ReactNode }) {
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const navigate = useNavigate();
  const linkCls = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground";
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hero-glow hidden flex-col gap-6 p-5 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Logo variant="dark" className="h-10 self-start" />
        <p className="text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">{title}</p>
        <nav className="flex flex-col gap-1" aria-label={title}>
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={linkCls} activeOptions={{ exact: n.exact }} activeProps={{ className: cn(linkCls, "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary") }}>
              <n.icon className="h-5 w-5" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-sidebar-accent p-3">
          <p className="text-sm font-bold">{user?.name}</p>
          <p className="text-xs text-sidebar-foreground/70" dir="ltr">{user?.phone}</p>
          <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-sidebar-foreground hover:bg-sidebar-border" onClick={() => { logout(); navigate({ to: "/login", search: { role: undefined } }); }}>
            <LogOut /> تسجيل الخروج
          </Button>
        </div>
      </aside>
      {/* mobile top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo className="h-8" />
          <Button variant="ghost" size="icon" aria-label="تسجيل الخروج" onClick={() => { logout(); navigate({ to: "/login", search: { role: undefined } }); }}>
            <LogOut />
          </Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label={title}>
          {nav.map((n) => (
            <Link key={n.to} to={n.to} activeOptions={{ exact: n.exact }} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground" activeProps={{ className: "bg-brand-ink text-brand-ink-foreground" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="min-w-0 p-4 lg:p-8">{children}</main>
    </div>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="surface flex items-start justify-between gap-3 p-5">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-extrabold text-brand-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></div>}
    </div>
  );
}
