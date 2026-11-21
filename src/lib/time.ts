/** All "day" logic uses the app timezone, never UTC or the device timezone. */
export const APP_TIMEZONE = "Asia/Damascus";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function parts(iso: string | number | Date) {
  const p: Record<string, string> = {};
  for (const x of partsFmt.formatToParts(new Date(iso))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, min: +p.minute, s: +p.second };
}

/** "YYYY-MM-DD" in the app timezone. */
export function dayKey(iso: string | number | Date): string {
  const { y, m, d } = parts(iso);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Offset (ms) of the app timezone from UTC at the given instant. */
function offsetMs(at: Date): number {
  const { y, m, d, h, min, s } = parts(at);
  return Date.UTC(y, m - 1, d, h, min, s) - Math.floor(at.getTime() / 1000) * 1000;
}

/** ISO instant of local midnight (app timezone) of the day containing `iso`. */
export function startOfDay(iso: string | number | Date): string {
  const [y, m, d] = dayKey(iso).split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - offsetMs(guess)).toISOString();
}

/** Local midnight for a "YYYY-MM-DD" key. */
export function startOfDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 12));
  return startOfDay(guess);
}

/** End of a "YYYY-MM-DD" day (last ms) in the app timezone. */
export function endOfDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1, 12));
  return new Date(new Date(startOfDay(next)).getTime() - 1).toISOString();
}

export function hourOf(iso: string | number | Date): number {
  return parts(iso).h;
}

/** Minutes since local midnight, and weekday 0=Sunday, in the app timezone. */
export function localClock(iso: string | number | Date): { day: number; minutes: number } {
  const p = parts(iso);
  const day = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return { day, minutes: p.h * 60 + p.min };
}

/** Day keys for the last n days, oldest first, ending today (app timezone). */
export function lastDayKeys(n: number, now: number = Date.now()): string[] {
  return Array.from({ length: n }, (_, i) => dayKey(now - (n - 1 - i) * 86400000));
}

const dtFmt = new Intl.DateTimeFormat("ar-SY", { timeZone: APP_TIMEZONE, dateStyle: "medium", timeStyle: "short" });
export function formatDateTime(iso: string | number | Date): string {
  return dtFmt.format(new Date(iso));
}
