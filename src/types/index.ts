export type Role = 'CUSTOMER' | 'RESTAURANT' | 'DRIVER' | 'ADMIN';
export type OrderStatus = 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED' | 'REJECTED';
export type AccountType = 'DRIVER' | 'RESTAURANT';
export type LedgerType =
  | 'CASH_COLLECTED'      // driver collected cash from customer; driver owes platform/restaurants
  | 'DELIVERY_EARNING'    // driver's share of the delivery fee; driver keeps it
  | 'RESTAURANT_PAYABLE'  // subtotal minus commission owed to the restaurant
  | 'PLATFORM_COMMISSION' // commission kept by the platform
  | 'SETTLEMENT';         // a confirmed cash settlement that reduces the balance
export type SettlementStatus = 'DRAFT' | 'CONFIRMED';

export interface User { id: string; role: Role; name: string; phone: string; email?: string; isActive: boolean; createdAt: string; }

export interface Zone { id: string; name: string; deliveryFee: number; isActive: boolean; }

export interface Address { id: string; userId: string; label: string; details?: string; lat: number; lng: number; zoneId: string; isDefault: boolean; }

export interface Restaurant {
  id: string; ownerId: string; name: string; description?: string; imageUrl?: string; category: string;
  lat: number; lng: number; zoneIds: string[]; commissionPercent: number;
  isApproved: boolean; isOpen: boolean; acceptingOrders: boolean;
  avgPrepMinutes: number; ratingAvg: number; ratingCount: number;
  workingHours: { day: 0|1|2|3|4|5|6; open: string; close: string }[]; // "HH:mm"
}

export interface MenuCategory { id: string; restaurantId: string; name: string; sortOrder: number; }
export interface MenuItemOption { id: string; name: string; priceDelta: number; }
export interface MenuItemOptionGroup { id: string; name: string; required: boolean; maxSelect: number; options: MenuItemOptionGroupOption[]; }
export type MenuItemOptionGroupOption = MenuItemOption;
export interface MenuItem {
  id: string; restaurantId: string; categoryId: string; name: string; description?: string; imageUrl?: string;
  price: number; isAvailable: boolean; optionGroups: MenuItemOptionGroup[];
}

export interface Driver { id: string; userId: string; vehicleType: 'MOTORBIKE' | 'BICYCLE' | 'CAR'; isApproved: boolean; isAvailable: boolean; ratingAvg: number; ratingCount: number; }
export interface DriverLocation { driverId: string; lat: number; lng: number; updatedAt: string; }

export interface OrderItem {
  id: string; orderId: string; menuItemId: string; nameSnapshot: string; unitPriceSnapshot: number; quantity: number;
  selectedOptions: { groupId: string; optionId: string; nameSnapshot: string; priceDeltaSnapshot: number }[];
  notes?: string; lineTotal: number;
}
export interface OrderStatusHistory { id: string; orderId: string; status: OrderStatus; changedByUserId?: string; reason?: string; createdAt: string; }
export interface Order {
  id: string; code: string; customerId: string; restaurantId: string; driverId?: string; zoneId: string;
  deliveryAddress: { label: string; details?: string; lat: number; lng: number };
  customerPhone: string; notes?: string; status: OrderStatus;
  subtotal: number; deliveryFee: number; total: number; // total = subtotal + deliveryFee, paid in cash on delivery
  cashCollected?: number; estimatedMinutes?: number;
  items: OrderItem[]; history: OrderStatusHistory[];
  createdAt: string; deliveredAt?: string;
}

export interface Review { id: string; orderId: string; authorId: string; targetType: 'RESTAURANT' | 'DRIVER'; targetId: string; stars: 1|2|3|4|5; comment?: string; createdAt: string; }

export interface LedgerEntry { id: string; accountType: AccountType; accountId: string; orderId?: string; settlementId?: string; type: LedgerType; amount: number; /* always positive; meaning comes from type */ createdAt: string; }
export interface Settlement { id: string; accountType: AccountType; accountId: string; periodStart: string; periodEnd: string; totalOwedToAccount: number; totalOwedByAccount: number; netAmount: number; /* positive = platform pays the account, negative = account pays the platform */ status: SettlementStatus; confirmedByUserId?: string; confirmedAt?: string; }

export interface Recommendation { menuItemId: string; restaurantId: string; reason: string; }
