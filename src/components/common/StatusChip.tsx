import type { OrderStatus } from "@/types";
import { STATUS_CHIP, STATUS_LABELS } from "@/lib/orderStatus";
import { cn } from "@/lib/utils";

export function StatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold", STATUS_CHIP[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
