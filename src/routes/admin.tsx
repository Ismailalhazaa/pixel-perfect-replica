import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Bike, ClipboardList, LayoutDashboard, Map, Scale, Store } from "lucide-react";
import { RequireRole } from "@/components/layout/RequireRole";
import { PanelShell, type PanelNavItem } from "@/components/layout/PanelShell";

const NAV: PanelNavItem[] = [
  { to: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "الطلبات", icon: ClipboardList },
  { to: "/admin/restaurants", label: "المطاعم", icon: Store },
  { to: "/admin/drivers", label: "السائقون", icon: Bike },
  { to: "/admin/settlements", label: "التسويات", icon: Scale },
  { to: "/admin/zones", label: "مناطق التوصيل", icon: Map },
];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "لوحة الإدارة – وصّلني" },
      { name: "description", content: "إدارة المطاعم والسائقين والطلبات والتسويات المالية." },
      { property: "og:title", content: "لوحة الإدارة – وصّلني" },
      { property: "og:description", content: "إدارة منصة وصّلني." },
    ],
  }),
  component: () => (
    <RequireRole role="ADMIN">
      <PanelShell title="الإدارة" nav={NAV}>
        <Outlet />
      </PanelShell>
    </RequireRole>
  ),
});
