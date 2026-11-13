/**
 * Single data-access entry point. Components and hooks import ONLY from here.
 * VITE_USE_MOCK=true (default) uses the in-browser mock; otherwise calls the REST backend at VITE_API_URL.
 */
import type { AccountType, Address, Driver, DriverApplication, MenuCategory, MenuItem, Restaurant, Review, User, Zone } from "@/types";
import * as mock from "./mockApi";
import type * as T from "./apiTypes";

export type * from "./apiTypes";
export { RESTAURANT_TYPES } from "./apiTypes";
export { ApiError } from "./mockApi";

const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? "true") !== "false";
const API_URL: string = import.meta.env.VITE_API_URL ?? "/api";

let authToken: string | null = null;
export const setAuthToken = (t: string | null) => (authToken = t);

async function http<R>(method: string, path: string, body?: unknown): Promise<R> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new mock.ApiError(err.message ?? "تعذّر الاتصال بالخادم");
  }
  return res.json() as Promise<R>;
}
const qs = (o: object) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && p.set(k, Array.isArray(v) ? v.join(",") : String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

// auth & users
export const login = (phone: string, password: string): Promise<T.AuthResponse> =>
  USE_MOCK ? mock.login(phone, password) : http("POST", "/auth/login", { phone, password });
export const register = (input: T.RegisterInput): Promise<T.AuthResponse> =>
  USE_MOCK ? mock.register(input) : http("POST", "/auth/register", input);
export const getUsers = (ids?: string[]): Promise<User[]> => (USE_MOCK ? mock.getUsers(ids) : http("GET", `/users${qs({ ids })}`));
export const getUser = (id: string): Promise<User> => (USE_MOCK ? mock.getUser(id) : http("GET", `/users/${id}`));
export const updateUser = (id: string, patch: Partial<Pick<User, "name" | "phone" | "email" | "isActive">>): Promise<User> =>
  USE_MOCK ? mock.updateUser(id, patch) : http("PATCH", `/users/${id}`, patch);

// partner sign-up
export const registerRestaurant = (input: T.RegisterRestaurantInput): Promise<T.AuthResponse> =>
  USE_MOCK ? mock.registerRestaurant(input) : http("POST", "/auth/register-restaurant", input);
export const submitDriverApplication = (input: T.DriverApplicationInput): Promise<DriverApplication> =>
  USE_MOCK ? mock.submitDriverApplication(input) : http("POST", "/driver-applications", input);
export const getDriverApplications = (): Promise<DriverApplication[]> =>
  USE_MOCK ? mock.getDriverApplications() : http("GET", "/driver-applications");
export const reviewDriverApplication = (id: string, input: { approve: boolean; reason?: string; adminId: string }): Promise<DriverApplication> =>
  USE_MOCK ? mock.reviewDriverApplication(id, input) : http("POST", `/driver-applications/${id}/review`, input);

// zones & addresses
export const getZones = (): Promise<Zone[]> => (USE_MOCK ? mock.getZones() : http("GET", "/zones"));
export const saveZone = (z: Omit<Zone, "id"> & { id?: string }): Promise<Zone> =>
  USE_MOCK ? mock.saveZone(z) : z.id ? http("PATCH", `/zones/${z.id}`, z) : http("POST", "/zones", z);
export const getAddresses = (userId: string): Promise<Address[]> =>
  USE_MOCK ? mock.getAddresses(userId) : http("GET", `/users/${userId}/addresses`);
export const saveAddress = (a: Omit<Address, "id"> & { id?: string }): Promise<Address> =>
  USE_MOCK ? mock.saveAddress(a) : a.id ? http("PATCH", `/addresses/${a.id}`, a) : http("POST", "/addresses", a);
export const deleteAddress = (id: string): Promise<boolean> => (USE_MOCK ? mock.deleteAddress(id) : http("DELETE", `/addresses/${id}`));

// restaurants & menu
export const getRestaurants = (q: T.RestaurantQuery = {}): Promise<Restaurant[]> =>
  USE_MOCK ? mock.getRestaurants(q) : http("GET", `/restaurants${qs(q)}`);
export const getRestaurant = (id: string): Promise<Restaurant> => (USE_MOCK ? mock.getRestaurant(id) : http("GET", `/restaurants/${id}`));
export const getRestaurantByOwner = (ownerId: string): Promise<Restaurant> =>
  USE_MOCK ? mock.getRestaurantByOwner(ownerId) : http("GET", `/restaurants/by-owner/${ownerId}`);
export const updateRestaurant = (id: string, patch: Partial<Restaurant>): Promise<Restaurant> =>
  USE_MOCK ? mock.updateRestaurant(id, patch) : http("PATCH", `/restaurants/${id}`, patch);
export const getRestaurantCategories = (): Promise<string[]> =>
  USE_MOCK ? mock.getCategoriesList() : http("GET", "/restaurants/categories");
export const getMenu = (restaurantId: string): Promise<T.Menu> =>
  USE_MOCK ? mock.getMenu(restaurantId) : http("GET", `/restaurants/${restaurantId}/menu`);
export const getMenuItems = (ids: string[]): Promise<MenuItem[]> =>
  USE_MOCK ? mock.getMenuItems(ids) : http("GET", `/menu-items${qs({ ids })}`);
export const saveMenuItem = (m: Omit<MenuItem, "id"> & { id?: string }): Promise<MenuItem> =>
  USE_MOCK ? mock.saveMenuItem(m) : m.id ? http("PATCH", `/menu-items/${m.id}`, m) : http("POST", "/menu-items", m);
export const deleteMenuItem = (id: string): Promise<boolean> => (USE_MOCK ? mock.deleteMenuItem(id) : http("DELETE", `/menu-items/${id}`));
export const saveCategory = (c: Omit<MenuCategory, "id"> & { id?: string }): Promise<MenuCategory> =>
  USE_MOCK ? mock.saveCategory(c) : c.id ? http("PATCH", `/menu-categories/${c.id}`, c) : http("POST", "/menu-categories", c);
export const deleteCategory = (id: string): Promise<boolean> =>
  USE_MOCK ? mock.deleteCategory(id) : http("DELETE", `/menu-categories/${id}`);

// orders
export const createOrder = (input: T.CreateOrderInput) => (USE_MOCK ? mock.createOrder(input) : http<import("@/types").Order>("POST", "/orders", input));
export const getOrders = (q: T.OrderQuery = {}) => (USE_MOCK ? mock.getOrders(q) : http<import("@/types").Order[]>("GET", `/orders${qs(q)}`));
export const getOrder = (id: string) => (USE_MOCK ? mock.getOrder(id) : http<import("@/types").Order>("GET", `/orders/${id}`));
export const updateOrderStatus = (id: string, input: T.UpdateStatusInput) =>
  USE_MOCK ? mock.updateOrderStatus(id, input) : http<import("@/types").Order>("PATCH", `/orders/${id}/status`, input);

// drivers
export const getDrivers = (): Promise<T.DriverWithUser[]> => (USE_MOCK ? mock.getDrivers() : http("GET", "/drivers"));
export const getDriver = (id: string): Promise<T.DriverWithUser> => (USE_MOCK ? mock.getDriver(id) : http("GET", `/drivers/${id}`));
export const getDriverByUser = (userId: string): Promise<Driver> =>
  USE_MOCK ? mock.getDriverByUser(userId) : http("GET", `/drivers/by-user/${userId}`);
export const updateDriver = (id: string, patch: Partial<Driver>): Promise<Driver> =>
  USE_MOCK ? mock.updateDriver(id, patch) : http("PATCH", `/drivers/${id}`, patch);
export const getDriverLocation = (driverId: string) =>
  USE_MOCK ? mock.getDriverLocation(driverId) : http<import("@/types").DriverLocation | null>("GET", `/drivers/${driverId}/location`);
export const getDriverOffers = (driverId: string) =>
  USE_MOCK ? mock.getDriverOffers(driverId) : http<import("@/types").Order[]>("GET", `/drivers/${driverId}/offers`);
export const acceptDelivery = (orderId: string, driverId: string) =>
  USE_MOCK ? mock.acceptDelivery(orderId, driverId) : http<import("@/types").Order>("POST", `/orders/${orderId}/assign`, { driverId });
export const getDriverEarnings = (driverId: string): Promise<T.DriverEarnings> =>
  USE_MOCK ? mock.getDriverEarnings(driverId) : http("GET", `/drivers/${driverId}/earnings`);

// reviews
export const createReview = (r: Omit<Review, "id" | "createdAt">): Promise<Review> =>
  USE_MOCK ? mock.createReview(r) : http("POST", "/reviews", r);
export const getReviews = (orderIds: string[]): Promise<Review[]> =>
  USE_MOCK ? mock.getReviews(orderIds) : http("GET", `/reviews${qs({ orderIds })}`);

// ledger & settlements
export const getAccountStatement = (accountType: AccountType, accountId: string): Promise<T.AccountStatement> =>
  USE_MOCK ? mock.getAccountStatement(accountType, accountId) : http("GET", `/accounts/${accountType}/${accountId}/statement`);
export const getSettlements = (f: { accountType?: AccountType; accountId?: string } = {}) =>
  USE_MOCK ? mock.getSettlements(f) : http<import("@/types").Settlement[]>("GET", `/settlements${qs(f)}`);
export const createSettlement = (input: { accountType: AccountType; accountId: string; periodStart: string; periodEnd: string }) =>
  USE_MOCK ? mock.createSettlement(input) : http<import("@/types").Settlement>("POST", "/settlements", input);
export const confirmSettlement = (id: string, userId: string) =>
  USE_MOCK ? mock.confirmSettlement(id, userId) : http<import("@/types").Settlement>("POST", `/settlements/${id}/confirm`, { userId });

// reports
export const getRestaurantReport = (restaurantId: string): Promise<T.RestaurantReport> =>
  USE_MOCK ? mock.getRestaurantReport(restaurantId) : http("GET", `/restaurants/${restaurantId}/report`);
export const getAdminStats = (): Promise<T.AdminStats> => (USE_MOCK ? mock.getAdminStats() : http("GET", "/admin/stats"));

// recommendations (customer id only — never personal data)
export const getRecommendations = (customerId: string) =>
  USE_MOCK ? mock.getRecommendations(customerId) : http<{ items: import("@/types").Recommendation[] }>("GET", `/recommendations/${customerId}`);
export const getMostOrdered = () =>
  USE_MOCK ? mock.getMostOrdered() : http<{ items: import("@/types").Recommendation[] }>("GET", "/recommendations/popular");
