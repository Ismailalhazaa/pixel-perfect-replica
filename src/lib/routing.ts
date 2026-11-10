import { useQuery } from "@tanstack/react-query";

type Pt = { lat: number; lng: number };

/** Street-level route via the public OSRM server (OpenStreetMap data). Returns [lat,lng][] or null. */
export async function fetchStreetRoute(from: Pt, to: Pt): Promise<[number, number][] | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const coords: [number, number][] | undefined = json?.routes?.[0]?.geometry?.coordinates;
  return coords?.length ? coords.map(([lng, lat]) => [lat, lng]) : null;
}

const r = (n: number) => Math.round(n * 1000) / 1000; // ~100 m — avoid refetching on every small move

export function useStreetRoute(from?: Pt | null, to?: Pt | null) {
  const key = from && to ? [r(from.lat), r(from.lng), r(to.lat), r(to.lng)] : null;
  return useQuery({
    queryKey: ["street-route", key],
    queryFn: () => fetchStreetRoute(from!, to!),
    enabled: !!key,
    staleTime: Infinity,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}
