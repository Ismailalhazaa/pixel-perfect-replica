import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BarChart3, ClipboardList, UtensilsCrossed } from "lucide-react";
import { RequireRole } from "@/components/layout/RequireRole";
import { PanelShell, type PanelNavItem } from "@/components/layout/PanelShell";

const NAV: PanelNavItem[] = [
  { to: "/restaurant-panel", label: "الطلبات", icon: ClipboardList, exact: true },
  { to: "/restaurant-panel/menu", label: "القائمة", icon: UtensilsCrossed },
  { to: "/restaurant-panel/reports", label: "التقارير", icon: BarChart3 },
];

export const Route = createFileRoute("/restaurant-panel")({
  head: () => ({
    meta: [
      { title: "لوحة المطعم – وصّلني" },
      { name: "description", content: "استقبل الطلبات وأدر قائمتك وتابع مبيعاتك." },
      { property: "og:title", content: "لوحة المطعم – وصّلني" },
      { property: "og:description", content: "لوحة تحكم المطاعم في وصّلني." },
    ],
  }),
  component: () => (
    <RequireRole role="RESTAURANT">
      <PanelShell title="لوحة المطعم" nav={NAV}>
        <Outlet />
      </PanelShell>
    </RequireRole>
  ),
});
