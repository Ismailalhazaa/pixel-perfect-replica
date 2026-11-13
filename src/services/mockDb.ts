import { buildSeed, type DB } from "./seed";

export const DB_KEY = "waselni-db-v1";
let cache: DB | null = null;

/** In-memory DB persisted to localStorage. Browser-only at runtime. */
export function getDb(): DB {
  if (cache) return cache;
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      try {
        cache = JSON.parse(raw) as DB;
        cache.driverApplications ??= [];
        cache.applicationPasswords ??= {};
        return cache;
      } catch {
        /* fall through to reseed */
      }
    }
  }
  cache = buildSeed();
  saveDb();
  return cache;
}

export function saveDb() {
  if (cache && typeof window !== "undefined") window.localStorage.setItem(DB_KEY, JSON.stringify(cache));
}

/** Drop the in-memory copy so the next read picks up another tab's writes. */
export function invalidateDbCache() {
  cache = null;
}

export function resetDb() {
  cache = buildSeed();
  saveDb();
}

export const delay = (min = 300, max = 600) =>
  new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();
