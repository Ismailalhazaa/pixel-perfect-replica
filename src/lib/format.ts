export const formatSYP = (n: number) => `${Math.round(n).toLocaleString("ar-SY")} ل.س`;

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" });

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ar-SY", { dateStyle: "medium" });

/** Haversine distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function toCSV(rows: (string | number)[][]) {
  return "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function downloadFile(name: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
