import type {
  AccountType, Address, Driver, DriverLocation, LedgerEntry, MenuCategory, MenuItem, Order, OrderItem, OrderStatus,
  DriverApplication, Recommendation, Restaurant, Review, Role, Settlement, User, Zone,
} from "@/types";
import { canTransition } from "@/lib/orderStatus";
import { dayKey, hourOf, lastDayKeys, localClock } from "@/lib/time";
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

// ---------- current user (derived from the token, like the real backend) ----------
let currentToken: string | null = null;
export const setMockToken = (t: string | null) => (currentToken = t);

export function getCurrentUser(): User {
  const id = currentToken?.startsWith("mock-") ? currentToken.slice(5) : null;
  const u = id ? getDb().users.find((x) => x.id === id) : undefined;
  if (!u) fail("يجب تسجيل الدخول أولاً");
  if (!u!.isActive) fail("هذا الحساب موقوف، تواصل مع الإدارة");
  return u!;
}
function requireRole(...roles: Role[]): User {
  const u = getCurrentUser();
  if (!roles.includes(u.role)) fail("ليس لديك صلاحية لهذا الإجراء");
  return u;
}
const requireAdmin = () => requireRole("ADMIN");
function myRestaurant(u: User) {
  return getDb().restaurants.find((r) => r.ownerId === u.id) ?? fail("لا يوجد مطعم مرتبط بهذا الحساب");
}
function myDriver(u: User) {
  return getDb().drivers.find((d) => d.userId === u.id) ?? fail("لا يوجد ملف سائق لهذا الحساب");
}
/** Admin, or the owner of the restaurant. */
function requireRestaurantAccess(restaurantId: string) {
  const u = requireRole("ADMIN", "RESTAURANT");
  if (u.role === "RESTAURANT" && myRestaurant(u).id !== restaurantId) fail("لا يمكنك تعديل مطعم آخر");
  return u;
}
const DRIVER_ACTIVE: OrderStatus[] = ["ACCEPTED", "PREPARING", "READY", "ON_THE_WAY"];

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
    const me = getCurrentUser();
    if (me.role !== "ADMIN" && (me.id !== id || patch.isActive !== undefined)) fail("ليس لديك صلاحية لهذا الإجراء");
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
  run(() => requireAdmin() && [...getDb().driverApplications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

export const reviewDriverApplication = (id: string, input: T.ReviewApplicationInput) =>
  run<DriverApplication>(() => {
    const admin = requireAdmin();
    const db = getDb();
    const app = db.driverApplications.find((a) => a.id === id) ?? fail("الطلب غير موجود");
    if (app.status !== "PENDING") fail("تمت مراجعة هذا الطلب مسبقاً");
    Object.assign(app, { reviewedByUserId: admin.id, reviewedAt: nowIso() });
    if (!input.approve) {
      if (!input.reason?.trim()) fail("اكتب سبب الرفض");
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
    requireAdmin();
    if (!Number.isInteger(z.deliveryFee) || z.deliveryFee < 0) fail("أجرة التوصيل يجب أن تكون عدداً صحيحاً");
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
    const u = requireRestaurantAccess(id);
    const r = getDb().restaurants.find((x) => x.id === id) ?? fail("المطعم غير موجود");
    const p = { ...patch };
    if (u.role !== "ADMIN") {
      if (p.isApproved !== undefined || p.commissionPercent !== undefined) fail("الموافقة والعمولة من صلاحيات الإدارة فقط");
      delete p.ownerId; delete p.ratingAvg; delete p.ratingCount;
    }
    if (p.commissionPercent !== undefined && (p.commissionPercent < 0 || p.commissionPercent > 100)) fail("نسبة العمولة غير صالحة");
    if (p.minOrderAmount !== undefined && (!Number.isInteger(p.minOrderAmount) || p.minOrderAmount < 0)) fail("الحد الأدنى للطلب يجب أن يكون عدداً صحيحاً");
    Object.assign(r, p, { id });
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
    requireRestaurantAccess(m.restaurantId);
    const db = getDb();
    if (!Number.isInteger(m.price) || m.price <= 0) fail("السعر يجب أن يكون عدداً صحيحاً موجباً");
    const ex = m.id ? db.menuItems.find((x) => x.id === m.id) : undefined;
    if (ex) return Object.assign(ex, m);
    const nm: MenuItem = { ...m, id: uid() };
    db.menuItems.push(nm);
    return nm;
  });
export const deleteMenuItem = (id: string) =>
  run(() => {
    const db = getDb();
    const mi = db.menuItems.find((m) => m.id === id) ?? fail("الصنف غير موجود");
    requireRestaurantAccess(mi.restaurantId);
    db.menuItems = db.menuItems.filter((m) => m.id !== id);
    return true;
  });
export const saveCategory = (c: Omit<MenuCategory, "id"> & { id?: string }) =>
  run(() => {
    requireRestaurantAccess(c.restaurantId);
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
    const cat = db.categories.find((c) => c.id === id) ?? fail("التصنيف غير موجود");
    requireRestaurantAccess(cat.restaurantId);
    if (db.menuItems.some((m) => m.categoryId === id)) fail("لا يمكن حذف تصنيف يحتوي على أصناف");
    db.categories = db.categories.filter((c) => c.id !== id);
    return true;
  });

// ---------- orders ----------
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
/** Open now per workingHours in the app timezone. Supports ranges crossing midnight. */
export function isWithinWorkingHours(rest: Restaurant, at: string | number | Date = Date.now()): boolean {
  const { day, minutes } = localClock(at);
  const inRange = (d: number, mins: number, allowOvernightTail: boolean) =>
    rest.workingHours.some((h) => {
      if (h.day !== d) return false;
      const o = toMin(h.open), c = toMin(h.close);
      if (c > o) return !allowOvernightTail && mins >= o && mins <= c;
      // overnight range: today from open to midnight, tomorrow from midnight to close
      return allowOvernightTail ? mins <= c : mins >= o;
    });
  return inRange(day, minutes, false) || inRange((day + 6) % 7, minutes, true);
}

export const createOrder = (input: T.CreateOrderInput) =>
  run(() => {
    const me = requireRole("CUSTOMER");
    const db = getDb();
    const rest = db.restaurants.find((r) => r.id === input.restaurantId) ?? fail("المطعم غير موجود");
    if (!rest.isApproved) fail("هذا المطعم غير معتمد بعد");
    if (!rest.isOpen) fail("المطعم مغلق حالياً");
    if (!rest.acceptingOrders) fail("المطعم أوقف استقبال الطلبات مؤقتاً");
    if (!isWithinWorkingHours(rest)) fail("المطعم خارج أوقات الدوام الآن");
    const zone = db.zones.find((z) => z.id === input.zoneId) ?? fail("منطقة التوصيل غير موجودة");
    if (!zone.isActive) fail("منطقة التوصيل غير مفعّلة حالياً");
    if (!rest.zoneIds.includes(zone.id)) fail("المطعم لا يوصل إلى هذه المنطقة");
    if (!input.items.length) fail("السلة فارغة");
    const orderId = uid();
    const items: OrderItem[] = input.items.map((line) => {
      const mi = db.menuItems.find((m) => m.id === line.menuItemId && m.restaurantId === rest.id) ?? fail("صنف غير موجود في قائمة هذا المطعم");
      if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 50) fail(`الكمية للصنف "${mi.name}" يجب أن تكون عدداً صحيحاً بين 1 و 50`);
      if (!mi.isAvailable) fail(`الصنف "${mi.name}" غير متوفر حالياً`);
      const seen = new Set<string>();
      const selectedOptions = line.selectedOptions.map(({ groupId, optionId }) => {
        const g = mi.optionGroups.find((x) => x.id === groupId) ?? fail(`خيار لا ينتمي إلى الصنف "${mi.name}"`);
        const o = g.options.find((x) => x.id === optionId) ?? fail(`خيار لا ينتمي إلى الصنف "${mi.name}"`);
        const k = `${groupId}:${optionId}`;
        if (seen.has(k)) fail(`خيار مكرر في الصنف "${mi.name}"`);
        seen.add(k);
        return { groupId, optionId, nameSnapshot: o.name, priceDeltaSnapshot: o.priceDelta };
      });
      mi.optionGroups.forEach((g) => {
        const n = selectedOptions.filter((x) => x.groupId === g.id).length;
        if (g.required && n === 0) fail(`اختر "${g.name}" للصنف "${mi.name}"`);
        if (n > g.maxSelect) fail(`يمكنك اختيار ${g.maxSelect} كحد أقصى من "${g.name}"`);
      });
      const unit = mi.price + selectedOptions.reduce((a, b) => a + b.priceDeltaSnapshot, 0);
      return {
        id: uid(), orderId, menuItemId: mi.id, nameSnapshot: mi.name, unitPriceSnapshot: mi.price,
        quantity: line.quantity, selectedOptions, notes: line.notes, lineTotal: unit * line.quantity,
      };
    });
    const subtotal = items.reduce((a, b) => a + b.lineTotal, 0);
    const min = rest.minOrderAmount ?? 0;
    if (subtotal < min) fail(`الحد الأدنى للطلب من هذا المطعم ${min.toLocaleString("ar-SY")} ل.س`);
    const createdAt = nowIso();
    db.orderSeq += 1;
    const order: Order = {
      id: orderId, code: `WS-${db.orderSeq}`, customerId: me.id, restaurantId: rest.id, zoneId: zone.id,
      deliveryAddress: input.deliveryAddress, customerPhone: input.customerPhone, notes: input.notes, status: "NEW",
      subtotal, deliveryFee: zone.deliveryFee, total: subtotal + zone.deliveryFee,
      estimatedMinutes: rest.avgPrepMinutes + 15, items,
      history: [{ id: uid(), orderId, status: "NEW", changedByUserId: me.id, createdAt }],
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

/** Throws unless the current user may act on this order in their role. */
function assertOrderOwnership(me: User, o: Order) {
  if (me.role === "CUSTOMER" && o.customerId !== me.id) fail("لا يمكنك تعديل طلب لا يخصك");
  if (me.role === "RESTAURANT" && myRestaurant(me).id !== o.restaurantId) fail("هذا الطلب ليس لمطعمك");
  if (me.role === "DRIVER" && o.driverId !== myDriver(me).id) fail("هذا الطلب غير مسند إليك");
}

function freeDriver(driverId?: string) {
  const d = driverId ? getDb().drivers.find((x) => x.id === driverId) : undefined;
  if (d && d.isApproved) d.isAvailable = true;
}

export const updateOrderStatus = (orderId: string, input: T.UpdateStatusInput) =>
  run(() => {
    const me = getCurrentUser();
    const db = getDb();
    const o = db.orders.find((x) => x.id === orderId) ?? fail("الطلب غير موجود");
    assertOrderOwnership(me, o);
    if (!canTransition(me.role, o.status, input.status)) fail("لا يمكن تغيير حالة الطلب بهذا الشكل");
    if (input.status === "ON_THE_WAY" && !o.driverId) fail("لم يتم تعيين سائق للطلب بعد");
    if (input.status === "DELIVERED") {
      const cash = input.cashCollected;
      if (cash === undefined || !Number.isInteger(cash) || cash < 0) fail("أدخل المبلغ المستلم كعدد صحيح");
      if (cash! > o.total) fail("المبلغ المستلم لا يمكن أن يتجاوز إجمالي الطلب");
      if (cash! < o.total) {
        if (!input.shortageReason?.trim()) fail("اكتب سبب نقص المبلغ المستلم");
        o.cashShortage = o.total - cash!;
        o.cashShortageReason = input.shortageReason!.trim();
      }
      o.cashCollected = cash;
      o.deliveredAt = nowIso();
    }
    if (input.status === "CANCELLED" || input.status === "REJECTED") o.cancelledReason = input.reason;
    if (input.estimatedMinutes) o.estimatedMinutes = input.estimatedMinutes;
    o.status = input.status;
    o.history.push({ id: uid(), orderId, status: input.status, changedByUserId: me.id, reason: input.reason, createdAt: nowIso() });
    if (input.status === "DELIVERED") addDeliveredLedger(db, o);
    if (input.status === "DELIVERED" || input.status === "CANCELLED" || input.status === "REJECTED") freeDriver(o.driverId);
    pushEvent("order:updated", clone(o));
    return o;
  });

/** Driver records arrival at the restaurant or the customer. */
export const markArrived = (orderId: string, at: "RESTAURANT" | "CUSTOMER") =>
  run(() => {
    const me = requireRole("DRIVER");
    const o = getDb().orders.find((x) => x.id === orderId) ?? fail("الطلب غير موجود");
    assertOrderOwnership(me, o);
    if (at === "RESTAURANT") o.arrivedAtRestaurantAt ??= nowIso();
    else {
      if (o.status !== "ON_THE_WAY") fail("استلم الطلب من المطعم أولاً");
      o.arrivedAtCustomerAt ??= nowIso();
    }
    pushEvent("order:updated", clone(o));
    return o;
  });

/** Driver gives up before pickup: order goes back to dispatch, excluding this driver. */
export const abandonDelivery = (orderId: string, reason: string) =>
  run(() => {
    const me = requireRole("DRIVER");
    const d = myDriver(me);
    const o = getDb().orders.find((x) => x.id === orderId) ?? fail("الطلب غير موجود");
    if (o.driverId !== d.id) fail("هذا الطلب غير مسند إليك");
    if (!["ACCEPTED", "PREPARING", "READY"].includes(o.status)) fail("لا يمكن التخلي عن الطلب بعد استلامه");
    if (!reason?.trim()) fail("اكتب سبب تعذّر إكمال الطلب");
    o.driverId = undefined;
    o.arrivedAtRestaurantAt = undefined;
    o.excludedDriverIds = Array.from(new Set([...(o.excludedDriverIds ?? []), d.id]));
    o.history.push({ id: uid(), orderId, status: o.status, changedByUserId: me.id, reason: `تعذّر إكمال الطلب: ${reason.trim()}`, createdAt: nowIso() });
    freeDriver(d.id);
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
    const me = requireRole("ADMIN", "DRIVER");
    const d = getDb().drivers.find((x) => x.id === id) ?? fail("السائق غير موجود");
    const p = { ...patch };
    if (me.role === "DRIVER") {
      if (d.userId !== me.id) fail("لا يمكنك تعديل سائق آخر");
      if (p.isApproved !== undefined) fail("الموافقة من صلاحيات الإدارة فقط");
      delete p.ratingAvg; delete p.ratingCount; delete p.userId;
    }
    if (p.isAvailable && !(p.isApproved ?? d.isApproved)) fail("حسابك بانتظار موافقة الإدارة");
    if (p.isAvailable && getDb().orders.some((o) => o.driverId === id && DRIVER_ACTIVE.includes(o.status))) fail("لديك توصيل جارٍ");
    Object.assign(d, p, { id });
    return d;
  });
export const getDriverLocation = (driverId: string) =>
  run<DriverLocation | null>(() => getDb().driverLocations.find((l) => l.driverId === driverId) ?? null);

export const getDriverOffers = (driverId: string) =>
  run(() => {
    const db = getDb();
    const d = db.drivers.find((x) => x.id === driverId);
    if (!d?.isAvailable || !d.isApproved) return [];
    if (db.orders.some((o) => o.driverId === driverId && DRIVER_ACTIVE.includes(o.status))) return [];
    return db.orders
      .filter((o) => !o.driverId && ["ACCEPTED", "PREPARING", "READY"].includes(o.status) && !(o.excludedDriverIds ?? []).includes(driverId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  });

/** Check + assign in one synchronous step (the backend does this as one atomic UPDATE). */
export const acceptDelivery = (orderId: string) =>
  run(() => {
    const me = requireRole("DRIVER");
    const db = getDb();
    const d = myDriver(me);
    const o = db.orders.find((x) => x.id === orderId) ?? fail("الطلب غير موجود");
    if (!["ACCEPTED", "PREPARING", "READY"].includes(o.status)) fail("هذا الطلب غير متاح للتوصيل");
    if (o.driverId) fail("تم إسناد الطلب لسائق آخر");
    if ((o.excludedDriverIds ?? []).includes(d.id)) fail("لا يمكنك قبول طلب تخلّيت عنه سابقاً");
    if (!d.isApproved) fail("حسابك بانتظار موافقة الإدارة");
    if (!d.isAvailable) fail("فعّل حالة التوفر أولاً");
    if (db.orders.some((x) => x.driverId === d.id && DRIVER_ACTIVE.includes(x.status))) fail("لديك توصيل جارٍ بالفعل");
    o.driverId = d.id;
    d.isAvailable = false;
    const rest = db.restaurants.find((r) => r.id === o.restaurantId)!;
    const loc = db.driverLocations.find((l) => l.driverId === d.id);
    if (loc) Object.assign(loc, { lat: rest.lat + 0.004, lng: rest.lng - 0.003, updatedAt: nowIso() });
    pushEvent("order:updated", clone(o));
    return o;
  });

// ---------- routing ----------
const toRad = (x: number) => (x * Math.PI) / 180;
export function haversineKm(a: T.LatLng, b: T.LatLng) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
export const ASSUMED_SPEED_KMH = 20;
export function straightRoute(from: T.LatLng, to: T.LatLng): T.RouteResult {
  const distanceKm = Math.round(haversineKm(from, to) * 1.3 * 10) / 10; // road factor
  return { points: [[from.lat, from.lng], [to.lat, to.lng]], distanceKm, durationMin: Math.max(1, Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60)), street: false };
}
export const getRoute = async (from: T.LatLng, to: T.LatLng) => {
  await delay(50, 150);
  return straightRoute(from, to);
};

// ---------- reviews ----------
export const createReview = (r: T.ReviewInput) =>
  run(() => {
    const me = requireRole("CUSTOMER");
    const db = getDb();
    const o = db.orders.find((x) => x.id === r.orderId) ?? fail("الطلب غير موجود");
    if (o.customerId !== me.id) fail("لا يمكنك تقييم طلب لا يخصك");
    if (o.status !== "DELIVERED") fail("يمكن التقييم بعد تسليم الطلب فقط");
    if (!Number.isInteger(r.stars) || r.stars < 1 || r.stars > 5) fail("التقييم يجب أن يكون من 1 إلى 5 نجوم");
    const validTarget = r.targetType === "RESTAURANT" ? r.targetId === o.restaurantId : !!o.driverId && r.targetId === o.driverId;
    if (!validTarget) fail("جهة التقييم لا تخص هذا الطلب");
    if (db.reviews.some((x) => x.orderId === r.orderId && x.targetType === r.targetType && x.targetId === r.targetId)) fail("تم تقييم هذا الطلب مسبقاً");
    const nr: Review = { orderId: r.orderId, targetType: r.targetType, targetId: r.targetId, comment: r.comment, stars: r.stars as Review["stars"], authorId: me.id, id: uid(), createdAt: nowIso() };
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
export function balanceOf(entries: LedgerEntry[], accountType: AccountType): T.AccountBalance {
  const sum = (t: LedgerEntry["type"]) => entries.filter((e) => e.type === t).reduce((a, b) => a + b.amount, 0);
  const settlementsNet = entries.filter((e) => e.type === "SETTLEMENT").reduce((a, b) => a + (b.direction === "ACCOUNT_PAYS" ? -b.amount : b.amount), 0);
  const unsettled = entries.filter((e) => !e.settlementId && e.type !== "SETTLEMENT");
  const uSum = (t: LedgerEntry["type"]) => unsettled.filter((e) => e.type === t).reduce((a, b) => a + b.amount, 0);
  if (accountType === "DRIVER") {
    const owedBy = uSum("CASH_COLLECTED") + uSum("CASH_SHORTAGE");
    const owedTo = uSum("DELIVERY_EARNING");
    return { owedToAccount: owedTo, owedByAccount: owedBy, net: owedTo - owedBy, totals: { CASH_COLLECTED: sum("CASH_COLLECTED"), CASH_SHORTAGE: sum("CASH_SHORTAGE"), DELIVERY_EARNING: sum("DELIVERY_EARNING"), SETTLEMENT: settlementsNet } };
  }
  const owedTo = uSum("RESTAURANT_PAYABLE");
  return { owedToAccount: owedTo, owedByAccount: 0, net: owedTo, totals: { RESTAURANT_PAYABLE: sum("RESTAURANT_PAYABLE"), PLATFORM_COMMISSION: sum("PLATFORM_COMMISSION"), SETTLEMENT: settlementsNet } };
}

export const getAccountStatement = (accountType: AccountType, accountId: string) =>
  run<T.AccountStatement>(() => {
    const me = getCurrentUser();
    if (me.role !== "ADMIN") {
      const own = accountType === "DRIVER" ? me.role === "DRIVER" && myDriver(me).id === accountId : me.role === "RESTAURANT" && myRestaurant(me).id === accountId;
      if (!own) fail("ليس لديك صلاحية لعرض هذا الكشف");
    }
    const entries = getDb().ledger.filter((e) => e.accountType === accountType && e.accountId === accountId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { entries, balance: balanceOf(entries, accountType) };
  });

export const getSettlements = (f: { accountType?: AccountType; accountId?: string } = {}) =>
  run(() =>
    getDb().settlements.filter((s) => (!f.accountType || s.accountType === f.accountType) && (!f.accountId || s.accountId === f.accountId)).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
  );

export const createSettlement = (input: { accountType: AccountType; accountId: string; periodStart: string; periodEnd: string }) =>
  run(() => {
    requireAdmin();
    const db = getDb();
    if (input.periodStart > input.periodEnd) fail("بداية الفترة بعد نهايتها");
    const mine = db.settlements.filter((s) => s.accountType === input.accountType && s.accountId === input.accountId);
    if (mine.some((s) => s.status === "DRAFT")) fail("يوجد مسودة تسوية لهذا الحساب، أكّدها أو احذفها أولاً");
    if (mine.some((s) => s.status === "CONFIRMED" && s.periodStart <= input.periodEnd && input.periodStart <= s.periodEnd)) fail("توجد تسوية مؤكدة تتداخل مع هذه الفترة");
    const entries = db.ledger.filter(
      (e) => e.accountType === input.accountType && e.accountId === input.accountId && !e.settlementId && e.type !== "SETTLEMENT" && e.createdAt >= input.periodStart && e.createdAt <= input.periodEnd,
    );
    if (!entries.length) fail("لا توجد حركات غير مسوّاة في هذه الفترة");
    const b = balanceOf(entries, input.accountType);
    const s: Settlement = { id: uid(), ...input, entryIds: entries.map((e) => e.id), totalOwedToAccount: b.owedToAccount, totalOwedByAccount: b.owedByAccount, netAmount: b.net, status: "DRAFT" };
    db.settlements.push(s);
    return s;
  });

export const confirmSettlement = (id: string) =>
  run(() => {
    const admin = requireAdmin();
    const db = getDb();
    const s = db.settlements.find((x) => x.id === id) ?? fail("التسوية غير موجودة");
    if (s.status === "CONFIRMED") fail("التسوية مؤكدة مسبقاً");
    const ids = new Set(s.entryIds ?? []);
    const entries = db.ledger.filter((e) => ids.has(e.id));
    if (entries.some((e) => e.settlementId)) fail("بعض حركات هذه التسوية مسوّاة مسبقاً");
    s.status = "CONFIRMED";
    s.confirmedByUserId = admin.id;
    s.confirmedAt = nowIso();
    entries.forEach((e) => (e.settlementId = s.id));
    db.ledger.push({
      id: uid(), accountType: s.accountType, accountId: s.accountId, settlementId: s.id, type: "SETTLEMENT",
      amount: Math.abs(s.netAmount), direction: s.netAmount >= 0 ? "PLATFORM_PAYS" : "ACCOUNT_PAYS", createdAt: s.confirmedAt,
    });
    return s;
  });

export const deleteSettlement = (id: string) =>
  run(() => {
    requireAdmin();
    const db = getDb();
    const s = db.settlements.find((x) => x.id === id) ?? fail("التسوية غير موجودة");
    if (s.status !== "DRAFT") fail("لا يمكن حذف تسوية مؤكدة");
    db.settlements = db.settlements.filter((x) => x.id !== id);
    return true;
  });

// ---------- reports ----------
const lastDays = (n: number) => lastDayKeys(n);

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
    orders.forEach((o) => hours[hourOf(o.createdAt)].count++);
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
    const weekDays = new Set(lastDays(7));
    const entries = db.ledger.filter((e) => e.accountType === "DRIVER" && e.accountId === driverId);
    const earnOf = (pred: (o: Order) => boolean) => delivered.filter(pred).reduce((a, b) => a + b.deliveryFee, 0);
    const unsettledOrderIds = new Set(entries.filter((e) => !e.settlementId && e.type === "CASH_COLLECTED").map((e) => e.orderId));
    const handOver = delivered.filter((o) => unsettledOrderIds.has(o.id));
    const restNames = new Map(db.restaurants.map((r) => [r.id, r.name]));
    const byRest = new Map<string, number>();
    handOver.forEach((o) => byRest.set(o.restaurantId, (byRest.get(o.restaurantId) ?? 0) + o.subtotal));
    return {
      today: { amount: earnOf((o) => (!!o.deliveredAt && dayKey(o.deliveredAt) === todayK)), count: delivered.filter((o) => (!!o.deliveredAt && dayKey(o.deliveredAt) === todayK)).length },
      week: { amount: earnOf((o) => !!o.deliveredAt && weekDays.has(dayKey(o.deliveredAt))), count: delivered.filter((o) => !!o.deliveredAt && weekDays.has(dayKey(o.deliveredAt))).length },
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
