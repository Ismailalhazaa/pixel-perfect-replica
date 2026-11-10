/**
 * Realtime layer. Interface mirrors socket.io-client (`on`, `off`, `emit`) so a real
 * `io(url)` socket can replace the mock without touching callers.
 *
 * Server -> client events:
 *  - "order:created"   (Order)
 *  - "order:updated"   (Order)
 *  - "driver:location" (DriverLocation)
 *  - "db:changed"      (void)  mock only: another tab wrote data
 * Client -> server events:
 *  - "order:subscribe" ({ orderId })
 *  - "driver:location" ({ driverId, lat, lng })
 */
import type { DriverLocation } from "@/types";
import { DB_KEY, getDb, invalidateDbCache, nowIso, saveDb } from "./mockDb";

type Handler = (payload: any) => void;

export interface RealtimeSocket {
  on(event: string, handler: Handler): RealtimeSocket;
  off(event: string, handler?: Handler): RealtimeSocket;
  emit(event: string, payload?: unknown): RealtimeSocket;
}

class MockSocket implements RealtimeSocket {
  private handlers = new Map<string, Set<Handler>>();
  private ticker: ReturnType<typeof setInterval> | null = null;
  private storageBound = false;

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    this.start();
    return this;
  }

  off(event: string, handler?: Handler) {
    if (!handler) this.handlers.delete(event);
    else this.handlers.get(event)?.delete(handler);
    return this;
  }

  /** Client -> "server" events. */
  emit(event: string, payload?: any) {
    if (event === "driver:location" && payload) {
      const loc = upsertLocation(payload.driverId, payload.lat, payload.lng);
      this.dispatch("driver:location", loc);
    }
    return this;
  }

  /** "Server" -> client push, used by the mock API. */
  dispatch(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((h) => h(payload));
  }

  private start() {
    if (typeof window === "undefined") return;
    if (!this.storageBound) {
      this.storageBound = true;
      window.addEventListener("storage", (e) => {
        if (e.key === DB_KEY) {
          invalidateDbCache();
          this.dispatch("db:changed");
        }
      });
    }
    if (this.ticker) return;
    // Simulate drivers moving toward the customer every 3 seconds.
    this.ticker = setInterval(() => {
      const db = getDb();
      db.orders
        .filter((o) => o.status === "ON_THE_WAY" && o.driverId)
        .forEach((o) => {
          const loc = db.driverLocations.find((l) => l.driverId === o.driverId);
          if (!loc) return;
          const dLat = o.deliveryAddress.lat - loc.lat;
          const dLng = o.deliveryAddress.lng - loc.lng;
          if (Math.abs(dLat) + Math.abs(dLng) < 0.0004) return;
          const next = upsertLocation(o.driverId!, loc.lat + dLat * 0.12, loc.lng + dLng * 0.12);
          this.dispatch("driver:location", next);
        });
    }, 3000);
  }
}

function upsertLocation(driverId: string, lat: number, lng: number): DriverLocation {
  const db = getDb();
  let loc = db.driverLocations.find((l) => l.driverId === driverId);
  if (!loc) {
    loc = { driverId, lat, lng, updatedAt: nowIso() };
    db.driverLocations.push(loc);
  } else {
    loc.lat = lat;
    loc.lng = lng;
    loc.updatedAt = nowIso();
  }
  saveDb();
  return { ...loc };
}

const mockSocket = new MockSocket();

export const socket: RealtimeSocket = mockSocket;

/** Used by the mock API layer to push events. A real backend pushes these itself. */
export const pushEvent = (event: string, payload?: unknown) => mockSocket.dispatch(event, payload);
