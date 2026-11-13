import type {
  AccountType, Address, Driver, DriverLocation, LedgerEntry, MenuCategory, MenuItem, Order, OrderItem, OrderStatus,
  DriverApplication, Recommendation, Restaurant, Review, Role, Settlement, User, Zone,
} from "@/types";
import { canTransition } from "@/lib/orderStatus";
import { addDeliveredLedger } from "./seed";
import { delay, getDb, nowIso, saveDb, uid } from "./mockDb";
import { pushEvent } from "./realtime";
import type * as T from "./apiTypes";

export class ApiError extends Error {}
const fail = (msg: string): never => {
  throw new ApiError(msg);
};
const clone = <X>(x: X): X => JSON.parse(JSON.stringify(x));

async function run<X>(fn: () => X): Promise<X> {
  await delay();
  const out = fn();
  saveDb();
  return clone(out);
}

// ---------- auth & users ----------
export const login = (phone: string, password: string) =>
  run<T.AuthResponse>(() => {
    const db = getDb();
    const user = db.users.find((u) => u.phone === phone.trim());
    if (!user) {
      const app = db.driverApplications.find((a) => a.phone === phone.trim() && a.status !== "APPROVED");
      if (app?.status === "PENDING") fail("طلب انضمامك كسائق قيد المراجعة لدى الإدارة");
      if (app?.status === "REJECTED") fail(`تم رفض طلب انضمامك كسائق${app.rejectionReason ? `: ${app.rejectionReason}` : ""}`);
    }
    if (!user || db.passwords[user.id] !== password) fail("رقم الهاتف أو كلمة المرور غير صحيحة");
    if (!user!.isActive) fail("هذا الحساب موقوف، تواصل مع الإدارة");
    return { user: user!, token: `mock-${user!.id}` };
  });

export const register = (input: T.RegisterInput) =>
  run<T.AuthResponse>(() => {
    const db = getDb();
    if (db.users.some((u) => u.phone === input.phone)) fail("رقم الهاتف مسجّل مسبقاً");
    const user: User = { id: uid(), role: "CUSTOMER", name: input.name, phone: input.phone, email: input.email, isActive: true, createdAt: nowIso() };
    db.users.push(user);
    db.passwords[user.id] = input.password;
    return { user, token: `mock-${user.id}` };
  });

export const getUsers = (ids?: string[]) =>
  run(() => getDb().users.filter((u) => !ids || ids.includes(u.id)));

export const getUser = (id: string) => run(() => getDb().users.find((u) => u.id === id) ?? fail("المستخدم غير موجود"));

export const updateUser = (id: string, patch: Partial<Pick<User, "name" | "phone" | "email" | "isActive">>) =>
  run(() => {
    const u = getDb().users.find((x) => x.id === id) ?? fail("المستخدم غير موجود");
    Object.assign(u, patch);
    return u;
  });

// ---------- partner sign-up ----------
const phoneTaken = (phone: string) => {
  const db = getDb();
  return db.users.some((u) => u.phone === phone) || db.driverApplications.some((a) => a.phone === phone && a.status === "PENDING");
};

/** Creates a RESTAURANT account immediately; the restaurant stays hidden until an admin approves it. */
export const registerRestaurant = (input: T.RegisterRestaurantInput) =>
  run<T.AuthResponse>(() => {
    const db = getDb();
    if (phoneTaken(input.phone)) fail("رقم الهاتف مسجّل مسبقاً");
    if (!input.zoneIds.length) fail("اختر منطقة توصيل واحدة على الأقل");
    const user: User = { id: uid(), role: "RESTAURANT", name: input.ownerName, phone: input.phone, email: input.email, isActive: true, createdAt: nowIso() };
    db.users.push(user);
    db.passwords[user.id] = input.password;
    const days = [0, 1, 2, 3, 4, 5, 6] as const;
    db.restaurants.push({
      id: uid(), ownerId: user.id, name: input.restaurantName, description: input.description, category: input.category,
      lat: input.lat, lng: input.lng, zoneIds: input.zoneIds, commissionPercent: 12, isApproved: false, isOpen: true, acceptingOrders: true,
      avgPrepMinutes: input.avgPrepMinutes, ratingAvg: 0, ratingCount: 0, workingHours: days.map((day) => ({ day, open: "10:00", close: "23:00" })),
    });
    return { user, token: `mock-${user.id}` };
  });

/** Driver sign-up only files a request; no account exists until an admin approves it. */
export const submitDriverApplication = (input: T.DriverApplicationInput) =>
  run<DriverApplication>(() => {
    const db = getDb();
    if (phoneTaken(input.phone)) fail("رقم الهاتف مسجّل مسبقاً أو لديه طلب قيد المراجعة");
    const { password, ...rest } = input;
    const app: DriverApplication = { ...rest, id: uid(), status: "PENDING", createdAt: nowIso() };
    db.driverApplications.push(app);
    db.applicationPasswords[app.id] = password;
    pushEvent("db:changed", {});
    return app;
  });

export const getDriverApplications = () =>
  run(() => [...getDb().driverApplications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

export const reviewDriverApplication = (id: string, input: { approve: boolean; reason?: string; adminId: string }) =>
  run<DriverApplication>(() => {
    const db = getDb();
    const app = db.driverApplications.find((a) => a.id === id) ?? fail("الطلب غير موجود");
    if (app.status !== "PENDING") fail("تمت مراجعة هذا الطلب مسبقاً");
    Object.assign(app, { reviewedByUserId: input.adminId, reviewedAt: nowIso() });
    if (!input.approve) {
      app.status = "REJECTED";
      app.rejectionReason = input.reason?.trim() || undefined;
    } else {
      if (db.users.some((u) => u.phone === app.phone)) fail("رقم الهاتف مستخدم بحساب آخر");
      const user: User = { id: uid(), role: "DRIVER", name: app.name, phone: app.phone, email: app.email, isActive: true, createdAt: nowIso() };
      db.users.push(user);
      db.passwords[user.id] = db.applicationPasswords[app.id];
      db.drivers.push({ id: uid(), userId: user.id, vehicleType: app.vehicleType, isApproved: true, isAvailable: false, ratingAvg: 0, ratingCount: 0 });
      app.status = "APPROVED";
      app.userId = user.id;
    }
    delete db.applicationPasswords[app.id];
    pushEvent("db:changed", {});
    return app;
  });

// ---------- zones ----------
export const getZones = () => run(() => getDb().zones);
export const saveZone = (z: Omit<Zone, "id"> & { id?: string }) =>
  run(() => {
    const db = getDb();
    const ex = z.id ? db.zones.find((x) => x.id === z.id) : undefined;
    if (ex) return Object.assign(ex, z);
    const nz: Zone = { ...z, id: uid() };
    db.zones.push(nz);
    return nz;
  });

// ---------- addresses ----------
export const getAddresses = (userId: string) => run(() => getDb().addresses.filter((a) => a.userId === userId));
export const saveAddress = (a: Omit<Address, "id"> & { id?: string }) =>
  run(() => {
    const db = getDb();
    if (a.isDefault) db.addresses.filter((x) => x.userId === a.userId).forEach((x) => (x.isDefault = false));
    const ex = a.id ? db.addresses.find((x) => x.id === a.id) : undefined;
    if (ex) return Object.assign(ex, a);
    const na: Address = { ...a, id: uid() };
    db.addresses.push(na);
    return na;
  });
export const deleteAddress = (id: string) =>
  run(() => {
    const db = getDb();
    db.addresses = db.addresses.filter((a) => a.id !== id);
    return true;
  });

// ---------- restaurants & menu ----------
export const getRestaurants = (p: T.RestaurantQuery = {}) =>
  run(() =>
    getDb().restaurants.filter(
      (r) =>
        (p.includeUnapproved || r.isApproved) &&
        (!p.category || r.category === p.category) &&
        (!p.q || r.name.includes(p.q) || r.category.includes(p.q) || (r.description ?? "").includes(p.q)),
    ),
  );
export const getRestaurant = (id: string) => run(() => getDb().restaurants.find((r) => r.id === id) ?? fail("المطعم غير موجود"));
export const getRestaurantByOwner = (ownerId: string) =>
  run(() => getDb().restaurants.find((r) => r.ownerId === ownerId) ?? fail("لا يوجد مطعم مرتبط بهذا الحساب"));
export const updateRestaurant = (id: string, patch: Partial<Restaurant>) =>
  run(() => {
    const r = getDb().restaurants.find((x) => x.id === id) ?? fail("المطعم غير موجود");
    Object.assign(r, patch, { id });
    return r;
  });
export const getCategoriesList = () => run(() => Array.from(new Set(getDb().restaurants.map((r) => r.category))));

export const getMenu = (restaurantId: string) =>
  run<T.Menu>(() => {
    const db = getDb();
    return {
      categories: db.categories.filter((c) => c.restaurantId === restaurantId).sort((a, b) => a.sortOrder - b.sortOrder),
      items: db.menuItems.filter((m) => m.restaurantId === restaurantId),
    };
  });
export const saveMenuItem = (m: Omit<MenuItem, "id"> & { id?: string }) =>
  run(() => {
    const db = getDb();
    const ex = m.id ? db.menuItems.find((x) => x.id === m.id) : undefined;
    if (ex) return Object.assign(ex, m);
    const nm: MenuItem = { ...m, id: uid() };
    db.menuItems.push(nm);
    return nm;
  });
export const deleteMenuItem = (id: string) =>
  run(() => {
    const db = getDb();
    db.menuItems = db.menuItems.filter((m) => m.id !== id);
    return true;
  });
export const saveCategory = (c: Omit<MenuCategory, "id"> & { id?: string }) =>
  run(() => {
    const db = getDb();
    const ex = c.id ? db.categories.find((x) => x.id === c.id) : undefined;
    if (ex) return Object.assign(ex, c);
    const nc: MenuCategory = { ...c, id: uid() };
    db.categories.push(nc);
    return nc;
  });
export const deleteCategory = (id: string) =>
  run(() => {
    const db = getDb();
    if (db.menuItems.some((m) => m.categoryId === id)) fail("لا يمكن حذف تصنيف يحتوي على أصناف");
    db.categories = db.categories.filter((c) => c.id !== id);
    return true;
  });

// ---------- orders ----------
export const createOrder = (input: T.CreateOrderInput) =>
  run(() => {
    const db = getDb();
    const rest = db.restaurants.find((r) => r.id === input.restaurantId) ?? fail("المطعم غير موجود");
    if (!rest.isOpen || !rest.acceptingOrders) fail("المطعم لا يستقبل طلبات حالياً");
    const zone = db.zones.find((z) => z.id === input.zoneId && z.isActive) ?? fail("منطقة التوصيل غير متاحة");
    if (!input.items.length) fail("السلة فارغة");
    const orderId = uid();
    const items: OrderItem[] = input.items.map((line) => {
      const mi = db.menuItems.find((m) => m.id === line.menuItemId && m.restaurantId === rest.id) ?? fail("صنف غير موجود");
      if (!mi.isAvailable) fail(`الصنف "${mi.name}" غير متوفر حالياً`);
      const selectedOptions = line.selectedOptions.map(({ groupId, optionId }) => {
        const g = mi.optionGroups.find((x) => x.id === groupId) ?? fail("خيار غير صالح");
        const o = g.options.find((x) => x.id === optionId) ?? fail("خيار غير صالح");
        return { groupId, optionId, nameSnapshot: o.name, priceDeltaSnapshot: o.priceDelta };
      });
      const unit = mi.price + selectedOptions.reduce((a, b) => a + b.priceDeltaSnapshot, 0);
      return {
        id: uid(), orderId, menuItemId: mi.id, nameSnapshot: mi.name, unitPriceSnapshot: mi.price,
        quantity: line.quantity, selectedOptions, notes: line.notes, lineTotal: unit * line.quantity,
      };
    });
    const subtotal = items.reduce((a, b) => a + b.lineTotal, 0);
    const createdAt = nowIso();
    db.orderSeq += 1;
    const order: Order = {
      id: orderId, code: `WS-${db.orderSeq}`, customerId: input.customerId, restaurantId: rest.id, zoneId: zone.id,
      deliveryAddress: input.deliveryAddress, customerPhone: input.customerPhone, notes: input.notes, status: "NEW",
      subtotal, deliveryFee: zone.deliveryFee, total: subtotal + zone.deliveryFee,
      estimatedMinutes: rest.avgPrepMinutes + 15, items,
      history: [{ id: uid(), orderId, status: "NEW", changedByUserId: input.customerId, createdAt }],
      createdAt,
    };
    db.orders.unshift(order);
    pushEvent("order:created", clone(order));
    return order;
  });

export const getOrders = (f: T.OrderQuery = {}) =>
  run(() =>
    getDb()
      .orders.filter(
        (o) =>
          (!f.customerId || o.customerId === f.customerId) &&
          (!f.restaurantId || o.restaurantId === f.restaurantId) &&
          (!f.driverId || o.driverId === f.driverId) &&
          (!f.statuses || f.statuses.includes(o.status)) &&
          (!f.from || o.createdAt >= f.from) &&
          (!f.to || o.createdAt <= f.to),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

export const getOrder = (id: string) => run(() => getDb().orders.find((o) => o.id === id) ?? fail("الطلب غير موجود"));

export const updateOrderStatus = (orderId: string, input: T.UpdateStatusInput) =>
  run(() => {
    const db = getDb();
    const o = db.orders.find((x) => x.id === orderId) ?? fail("الطلب غير موجود");
    if (!canTransition(input.role, o.status, input.status)) fail("لا يمكن تغيير حالة الطلب بهذا الشكل");
    if (input.status === "ON_THE_WAY" && !o.driverId) fail("لم يتم تعيين سائق للطلب بعد");
    if (input.status === "DELIVERED") {
      if (input.cashCollected === undefined || input.cashCollected < 0) fail("أدخل المبلغ المستلم");
      o.cashCollected = Math.round(input.cashCollected!);
      o.deliveredAt = nowIso();
    }
    if (input.estimatedMinutes) o.estimatedMinutes = input.estimatedMinutes;
    o.status = input.status;
    o.history.push({ id: uid(), orderId, status: input.status, changedByUserId: input.userId, reason: input.reason, createdAt: nowIso() });
    if (input.status === "DELIVERED") {
      addDeliveredLedger(db, o);
      const d = db.drivers.find((x) => x.id === o.driverId);
      if (d) d.isAvailable = true;
    }
    pushEvent("order:updated", clone(o));
    return o;
  });

// ---------- drivers ----------
export const getDrivers = () =>
  run<T.DriverWithUser[]>(() => {
    const db = getDb();
    return db.drivers.map((d) => ({ ...d, user: db.users.find((u) => u.id === d.userId)! }));
  });
export const getDriver = (id: string) =>
  run<T.DriverWithUser>(() => {
    const db = getDb();
    const d = db.drivers.find((x) => x.id === id) ?? fail("السائق غير موجود");
    return { ...d, user: db.users.find((u) => u.id === d.userId)! };
  });
export const getDriverByUser = (userId: string) =>
  run(() => getDb().drivers.find((d) => d.userId === userId) ?? fail("لا يوجد ملف سائق لهذا الحساب"));
export const updateDriver = (id: string, patch: Partial<Driver>) =>
  run(() => {
    const d = getDb().drivers.find((x) => x.id === id) ?? fail("السائق غير موجود");
    if (patch.isAvailable && !d.isApproved) fail("حسابك بانتظار موافقة الإدارة");
    Object.assign(d, patch, { id });
    return d;
  });
export const getDriverLocation = (driverId: string) =>
  run<DriverLocation | null>(() => getDb().driverLocations.find((l) => l.driverId === driverId) ?? null);

export const getDriverOffers = (driverId: string) =>
  run(() => {
    const db = getDb();
    const d = db.drivers.find((x) => x.id === driverId);
    if (!d?.isAvailable || !d.isApproved) return [];
    if (db.orders.some((o) => o.driverId === driverId && ["ACCEPTED", "PREPARING", "READY", "ON_THE_WAY"].includes(o.status))) return [];
    return db.orders
      .filter((o) => !o.driverId && ["ACCEPTED", "PREPARING", "READY"].includes(o.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

export const acceptDelivery = (orderId: string, driverId: string) =>
  run(() => {
    const db = getDb();
    const o = db.orders.find((x) => x.id === orderId) ?? fail("الطلب غير موجود");
    if (o.driverId) fail("تم إسناد الطلب لسائق آخر");
    o.driverId = driverId;
    const d = db.drivers.find((x) => x.id === driverId);
    if (d) d.isAvailable = false;
    const rest = db.restaurants.find((r) => r.id === o.restaurantId)!;
    const loc = db.driverLocations.find((l) => l.driverId === driverId);
    if (loc) Object.assign(loc, { lat: rest.lat + 0.004, lng: rest.lng - 0.003, updatedAt: nowIso() });
    pushEvent("order:updated", clone(o));
    return o;
  });

// ---------- reviews ----------
export const createReview = (r: Omit<Review, "id" | "createdAt">) =>
  run(() => {
    const db = getDb();
    if (db.reviews.some((x) => x.orderId === r.orderId && x.targetType === r.targetType)) fail("تم تقييم هذا الطلب مسبقاً");
    const nr: Review = { ...r, id: uid(), createdAt: nowIso() };
    db.reviews.push(nr);
    const target = r.targetType === "RESTAURANT" ? db.restaurants.find((x) => x.id === r.targetId) : db.drivers.find((x) => x.id === r.targetId);
    if (target) {
      target.ratingAvg = Math.round(((target.ratingAvg * target.ratingCount + r.stars) / (target.ratingCount + 1)) * 10) / 10;
      target.ratingCount += 1;
    }
    return nr;
  });
export const getReviews = (orderIds: string[]) => run(() => getDb().reviews.filter((r) => orderIds.includes(r.orderId)));

// ---------- ledger & settlements ----------
function balanceOf(entries: LedgerEntry[], accountType: AccountType): T.AccountBalance {
  const sum = (t: LedgerEntry["type"]) => entries.filter((e) => e.type === t).reduce((a, b) => a + b.amount, 0);
  const settlementsNet = entries.filter((e) => e.type === "SETTLEMENT").reduce((a, b) => a + b.amount, 0);
  if (accountType === "DRIVER") {
    const cash = sum("CASH_COLLECTED");
    const earn = sum("DELIVERY_EARNING");
    const unsettled = entries.filter((e) => !e.settlementId && e.type !== "SETTLEMENT");
    const owedBy = unsettled.filter((e) => e.type === "CASH_COLLECTED").reduce((a, b) => a + b.amount, 0);
    const owedTo = unsettled.filter((e) => e.type === "DELIVERY_EARNING").reduce((a, b) => a + b.amount, 0);
    return { owedToAccount: owedTo, owedByAccount: owedBy, net: owedTo - owedBy, totals: { CASH_COLLECTED: cash, DELIVERY_EARNING: earn, SETTLEMENT: settlementsNet } };
  }
  const unsettled = entries.filter((e) => !e.settlementId && e.type === "RESTAURANT_PAYABLE");
  const owedTo = unsettled.reduce((a, b) => a + b.amount, 0);
  return { owedToAccount: owedTo, owedByAccount: 0, net: owedTo, totals: { RESTAURANT_PAYABLE: sum("RESTAURANT_PAYABLE"), PLATFORM_COMMISSION: sum("PLATFORM_COMMISSION"), SETTLEMENT: settlementsNet } };
}

export const getAccountStatement = (accountType: AccountType, accountId: string) =>
  run<T.AccountStatement>(() => {
    const entries = getDb().ledger.filter((e) => e.accountType === accountType && e.accountId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { entries, balance: balanceOf(entries, accountType) };
  });

export const getSettlements = (f: { accountType?: AccountType; accountId?: string } = {}) =>
  run(() =>
    getDb().settlements.filter((s) => (!f.accountType || s.accountType === f.accountType) && (!f.accountId || s.accountId === f.accountId)).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
  );

export const createSettlement = (input: { accountType: AccountType; accountId: string; periodStart: string; periodEnd: string }) =>
  run(() => {
    const db = getDb();
    const entries = db.ledger.filter(
      (e) => e.accountType === input.accountType && e.accountId === input.accountId && !e.settlementId && e.type !== "SETTLEMENT" && e.createdAt >= input.periodStart && e.createdAt <= input.periodEnd,
    );
    if (!entries.length) fail("لا توجد حركات غير مسوّاة في هذه الفترة");
    const b = balanceOf(entries, input.accountType);
    const s: Settlement = { id: uid(), ...input, totalOwedToAccount: b.owedToAccount, totalOwedByAccount: b.owedByAccount, netAmount: b.net, status: "DRAFT" };
    db.settlements.push(s);
    return s;
  });

export const confirmSettlement = (id: string, userId: string) =>
  run(() => {
    const db = getDb();
    const s = db.settlements.find((x) => x.id === id) ?? fail("التسوية غير موجودة");
    if (s.status === "CONFIRMED") fail("التسوية مؤكدة مسبقاً");
    s.status = "CONFIRMED";
    s.confirmedByUserId = userId;
    s.confirmedAt = nowIso();
    db.ledger
      .filter((e) => e.accountType === s.accountType && e.accountId === s.accountId && !e.settlementId && e.type !== "SETTLEMENT" && e.createdAt >= s.periodStart && e.createdAt <= s.periodEnd)
      .forEach((e) => (e.settlementId = s.id));
    db.ledger.push({ id: uid(), accountType: s.accountType, accountId: s.accountId, settlementId: s.id, type: "SETTLEMENT", amount: Math.abs(s.netAmount), createdAt: s.confirmedAt });
    return s;
  });

// ---------- reports ----------
const dayKey = (iso: string) => iso.slice(0, 10);
function lastDays(n: number) {
  return Array.from({ length: n }, (_, i) => dayKey(new Date(Date.now() - (n - 1 - i) * 86400000).toISOString()));
}

export const getRestaurantReport = (restaurantId: string) =>
  run<T.RestaurantReport>(() => {
    const db = getDb();
    const orders = db.orders.filter((o) => o.restaurantId === restaurantId && o.status === "DELIVERED");
    const days = lastDays(7);
    const daily = days.map((d) => {
      const os = orders.filter((o) => dayKey(o.createdAt) === d);
      return { date: d, total: os.reduce((a, b) => a + b.subtotal, 0), count: os.length };
    });
    const today = daily[daily.length - 1];
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    orders.forEach((o) => o.items.forEach((it) => {
      const cur = itemMap.get(it.menuItemId) ?? { name: it.nameSnapshot, quantity: 0, revenue: 0 };
      cur.quantity += it.quantity;
      cur.revenue += it.lineTotal;
      itemMap.set(it.menuItemId, cur);
    }));
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
    orders.forEach((o) => hours[new Date(o.createdAt).getHours()].count++);
    const entries = db.ledger.filter((e) => e.accountType === "RESTAURANT" && e.accountId === restaurantId);
    return {
      today: { total: today.total, count: today.count },
      week: { total: daily.reduce((a, b) => a + b.total, 0), count: daily.reduce((a, b) => a + b.count, 0) },
      daily,
      topItems: Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      peakHours: hours,
      balance: balanceOf(entries, "RESTAURANT"),
    };
  });

export const getDriverEarnings = (driverId: string) =>
  run<T.DriverEarnings>(() => {
    const db = getDb();
    const delivered = db.orders.filter((o) => o.driverId === driverId && o.status === "DELIVERED").sort((a, b) => (b.deliveredAt ?? "").localeCompare(a.deliveredAt ?? ""));
    const todayK = dayKey(nowIso());
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const entries = db.ledger.filter((e) => e.accountType === "DRIVER" && e.accountId === driverId);
    const earnOf = (pred: (o: Order) => boolean) => delivered.filter(pred).reduce((a, b) => a + b.deliveryFee, 0);
    const unsettledOrderIds = new Set(entries.filter((e) => !e.settlementId && e.type === "CASH_COLLECTED").map((e) => e.orderId));
    const handOver = delivered.filter((o) => unsettledOrderIds.has(o.id));
    const restNames = new Map(db.restaurants.map((r) => [r.id, r.name]));
    const byRest = new Map<string, number>();
    handOver.forEach((o) => byRest.set(o.restaurantId, (byRest.get(o.restaurantId) ?? 0) + o.subtotal));
    return {
      today: { amount: earnOf((o) => dayKey(o.deliveredAt ?? "") === todayK), count: delivered.filter((o) => dayKey(o.deliveredAt ?? "") === todayK).length },
      week: { amount: earnOf((o) => (o.deliveredAt ?? "") >= weekAgo), count: delivered.filter((o) => (o.deliveredAt ?? "") >= weekAgo).length },
      deliveries: delivered,
      balance: balanceOf(entries, "DRIVER"),
      cashByRestaurant: Array.from(byRest.entries()).map(([id, amount]) => ({ restaurantId: id, restaurantName: restNames.get(id) ?? "", amount })),
    };
  });

export const getAdminStats = () =>
  run<T.AdminStats>(() => {
    const db = getDb();
    const todayK = dayKey(nowIso());
    const todays = db.orders.filter((o) => dayKey(o.createdAt) === todayK);
    const delivered = db.orders.filter((o) => o.status === "DELIVERED" && o.deliveredAt);
    const avg = delivered.length
      ? Math.round(delivered.reduce((a, o) => a + (new Date(o.deliveredAt!).getTime() - new Date(o.createdAt).getTime()) / 60000, 0) / delivered.length)
      : 0;
    const days = lastDays(7);
    const statusCounts = new Map<OrderStatus, number>();
    db.orders.forEach((o) => statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1));
    return {
      ordersToday: todays.length,
      revenueToday: db.ledger.filter((e) => e.type === "PLATFORM_COMMISSION" && dayKey(e.createdAt) === todayK).reduce((a, b) => a + b.amount, 0),
      gmvToday: todays.filter((o) => o.status === "DELIVERED").reduce((a, b) => a + b.total, 0),
      activeDrivers: db.drivers.filter((d) => d.isApproved && (d.isAvailable || db.orders.some((o) => o.driverId === d.id && o.status === "ON_THE_WAY"))).length,
      avgDeliveryMinutes: avg,
      daily: days.map((d) => {
        const os = db.orders.filter((o) => dayKey(o.createdAt) === d);
        return {
          date: d, orders: os.length,
          revenue: db.ledger.filter((e) => e.type === "PLATFORM_COMMISSION" && dayKey(e.createdAt) === d).reduce((a, b) => a + b.amount, 0),
        };
      }),
      byStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count })),
    };
  });

// ---------- recommendations ----------
/** Only the customer id is used; no name, phone or address is read or returned. */
export const getRecommendations = (customerId: string) =>
  run<{ items: Recommendation[] }>(() => {
    const db = getDb();
    const past = db.orders.filter((o) => o.customerId === customerId && o.status === "DELIVERED");
    const avail = (m: MenuItem) => m.isAvailable && db.restaurants.find((r) => r.id === m.restaurantId)?.isApproved;
    const out: Recommendation[] = [];
    const seen = new Set<string>();
    const counts = new Map<string, number>();
    past.forEach((o) => o.items.forEach((i) => counts.set(i.menuItemId, (counts.get(i.menuItemId) ?? 0) + i.quantity)));
    // 1) re-order favourites
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([id]) => {
      const m = db.menuItems.find((x) => x.id === id);
      if (m && avail(m) && !seen.has(id)) {
        seen.add(id);
        out.push({ menuItemId: id, restaurantId: m.restaurantId, reason: `لأنك طلبت ${m.name} سابقاً` });
      }
    });
    // 2) same category, other restaurants
    const favCats = new Set(past.map((o) => db.restaurants.find((r) => r.id === o.restaurantId)?.category).filter(Boolean) as string[]);
    const orderedRests = new Set(past.map((o) => o.restaurantId));
    db.restaurants.filter((r) => favCats.has(r.category) && !orderedRests.has(r.id)).forEach((r) => {
      const m = db.menuItems.find((x) => x.restaurantId === r.id && avail(x) && !seen.has(x.id));
      if (m) {
        seen.add(m.id);
        out.push({ menuItemId: m.id, restaurantId: r.id, reason: `لأنك تحب ${r.category}، جرّب ${r.name}` });
      }
    });
    if (!out.length) fail("لا توجد بيانات كافية");
    return { items: out.slice(0, 6) };
  });

/** Fallback for recommendations: most ordered items across the platform. */
export const getMostOrdered = () =>
  run<{ items: Recommendation[] }>(() => {
    const db = getDb();
    const counts = new Map<string, number>();
    db.orders.forEach((o) => o.items.forEach((i) => counts.set(i.menuItemId, (counts.get(i.menuItemId) ?? 0) + i.quantity)));
    const items = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
      .map(([id]) => db.menuItems.find((m) => m.id === id))
      .filter((m): m is MenuItem => !!m && m.isAvailable)
      .slice(0, 6)
      .map((m) => ({ menuItemId: m.id, restaurantId: m.restaurantId, reason: "الأكثر طلباً" }));
    return { items };
  });

export const getMenuItems = (ids: string[]) => run(() => getDb().menuItems.filter((m) => ids.includes(m.id)));

export type { Role };
