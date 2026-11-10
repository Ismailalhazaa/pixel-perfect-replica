import type { AccountType, Driver, LedgerEntry, MenuCategory, MenuItem, Order, OrderStatus, Role, User } from "@/types";

export interface AuthResponse { user: User; token: string }
export interface RegisterInput { name: string; phone: string; email?: string; password: string }
export interface RestaurantQuery { q?: string; category?: string; includeUnapproved?: boolean }
export interface Menu { categories: MenuCategory[]; items: MenuItem[] }
export interface OrderQuery { customerId?: string; restaurantId?: string; driverId?: string; statuses?: OrderStatus[]; from?: string; to?: string }

export interface CreateOrderInput {
  customerId: string;
  restaurantId: string;
  zoneId: string;
  deliveryAddress: Order["deliveryAddress"];
  customerPhone: string;
  notes?: string;
  items: { menuItemId: string; quantity: number; selectedOptions: { groupId: string; optionId: string }[]; notes?: string }[];
}

export interface UpdateStatusInput {
  status: OrderStatus;
  userId: string;
  role: Role;
  reason?: string;
  estimatedMinutes?: number;
  cashCollected?: number;
}

export interface DriverWithUser extends Driver { user: User }

export interface AccountBalance {
  owedToAccount: number;
  owedByAccount: number;
  net: number; // positive = platform pays the account
  totals: Partial<Record<LedgerEntry["type"], number>>;
}
export interface AccountStatement { entries: LedgerEntry[]; balance: AccountBalance }

export interface RestaurantReport {
  today: { total: number; count: number };
  week: { total: number; count: number };
  daily: { date: string; total: number; count: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  peakHours: { hour: number; count: number }[];
  balance: AccountBalance;
}

export interface DriverEarnings {
  today: { amount: number; count: number };
  week: { amount: number; count: number };
  deliveries: Order[];
  balance: AccountBalance;
  cashByRestaurant: { restaurantId: string; restaurantName: string; amount: number }[];
}

export interface AdminStats {
  ordersToday: number;
  revenueToday: number;
  gmvToday: number;
  activeDrivers: number;
  avgDeliveryMinutes: number;
  daily: { date: string; orders: number; revenue: number }[];
  byStatus: { status: OrderStatus; count: number }[];
}

export type { AccountType };
