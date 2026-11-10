import type { OrderStatus, Role } from "@/types";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "جديد",
  ACCEPTED: "مقبول",
  PREPARING: "قيد التحضير",
  READY: "جاهز",
  ON_THE_WAY: "في الطريق",
  DELIVERED: "تم التسليم",
  CANCELLED: "ملغى",
  REJECTED: "مرفوض",
};

/** Happy-path order used by the customer tracking stepper. */
export const STATUS_FLOW: OrderStatus[] = ["NEW", "ACCEPTED", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"];

/** Tailwind classes backed by design tokens in styles.css. */
export const STATUS_CHIP: Record<OrderStatus, string> = {
  NEW: "bg-status-new text-status-new-foreground",
  ACCEPTED: "bg-status-new text-status-new-foreground",
  PREPARING: "bg-status-preparing text-status-preparing-foreground",
  READY: "bg-status-preparing text-status-preparing-foreground",
  ON_THE_WAY: "bg-primary text-primary-foreground",
  DELIVERED: "bg-status-delivered text-status-delivered-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  REJECTED: "bg-destructive/10 text-destructive",
};

/** Allowed transitions per role: from -> to[]. */
export const TRANSITIONS: Record<Role, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  CUSTOMER: { NEW: ["CANCELLED"] },
  RESTAURANT: {
    NEW: ["ACCEPTED", "REJECTED"],
    ACCEPTED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY"],
  },
  DRIVER: { READY: ["ON_THE_WAY"], ON_THE_WAY: ["DELIVERED"] },
  ADMIN: {
    NEW: ["ACCEPTED", "REJECTED", "CANCELLED"],
    ACCEPTED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["ON_THE_WAY", "CANCELLED"],
    ON_THE_WAY: ["DELIVERED"],
  },
};

export function canTransition(role: Role, from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[role][from]?.includes(to) ?? false;
}

export const ACTIVE_STATUSES: OrderStatus[] = ["NEW", "ACCEPTED", "PREPARING", "READY", "ON_THE_WAY"];
export const isActive = (s: OrderStatus) => ACTIVE_STATUSES.includes(s);
