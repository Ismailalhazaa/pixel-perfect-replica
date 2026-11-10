import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { Role } from "@/types";
import { useSession } from "@/stores/session";
import { ListSkeleton } from "@/components/common/states";

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, hydrated } = useSession();
  if (!hydrated)
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ListSkeleton />
      </div>
    );
  if (!user || user.role !== role) return <Navigate to="/login" search={{ role }} replace />;
  return <>{children}</>;
}
