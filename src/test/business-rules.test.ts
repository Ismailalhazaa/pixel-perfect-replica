import { beforeEach, describe, expect, it, vi } from "vitest";
import { canTransition } from "@/lib/orderStatus";
import { useCart } from "@/stores/cart";
import { buildSeed, addDeliveredLedger } from "@/services/seed";

describe("order status machine", () => {
  it("customer may cancel only while NEW", () => {
    expect(canTransition("CUSTOMER", "NEW", "CANCELLED")).toBe(true);
    expect(canTransition("CUSTOMER", "ACCEPTED", "CANCELLED")).toBe(false);
  });
  it("driver cannot deliver an order that is not on the way", () => {
    expect(canTransition("DRIVER", "READY", "DELIVERED")).toBe(false);
    expect(canTransition("DRIVER", "ON_THE_WAY", "DELIVERED")).toBe(true);
  });
});

describe("cart", () => {
  beforeEach(() => useCart.getState().clear());
  it("holds items from one restaurant only", () => {
    const line = { menuItemId: "m1", name: "x", basePrice: 1000, options: [], quantity: 1 };
    expect(useCart.getState().addLine("r1", "A", line)).toBe(true);
    expect(useCart.getState().addLine("r2", "B", line)).toBe(false);
    expect(useCart.getState().restaurantId).toBe("r1");
  });
});

describe("ledger on delivery", () => {
  it("creates the four entries using the restaurant commission", () => {
    vi.stubGlobal("crypto", { ...crypto, randomUUID: () => "id-" + Math.random() });
    const db = buildSeed();
    db.ledger = [];
    const o = db.orders.find((x) => x.status === "ON_THE_WAY")!;
    const rest = db.restaurants.find((r) => r.id === o.restaurantId)!;
    o.cashCollected = o.total;
    addDeliveredLedger(db, o);
    const by = (t: string) => db.ledger.find((e) => e.type === t)!.amount;
    const commission = Math.round((o.subtotal * rest.commissionPercent) / 100);
    expect(by("CASH_COLLECTED")).toBe(o.total);
    expect(by("DELIVERY_EARNING")).toBe(o.deliveryFee);
    expect(by("PLATFORM_COMMISSION")).toBe(commission);
    expect(by("RESTAURANT_PAYABLE")).toBe(o.subtotal - commission);
  });
  it("seeds 8 restaurants, 4 drivers, 20 orders and 2 zones", () => {
    const db = buildSeed();
    expect([db.restaurants.length, db.drivers.length, db.orders.length, db.zones.length]).toEqual([8, 4, 20, 2]);
  });
});
