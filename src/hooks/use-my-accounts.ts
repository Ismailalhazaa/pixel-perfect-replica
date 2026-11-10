import { useQuery } from "@tanstack/react-query";
import * as api from "@/services/api";
import { useSession } from "@/stores/session";

export function useMyRestaurant() {
  const user = useSession((s) => s.user);
  return useQuery({ queryKey: ["myRestaurant", user?.id], queryFn: () => api.getRestaurantByOwner(user!.id), enabled: user?.role === "RESTAURANT" });
}

export function useMyDriver() {
  const user = useSession((s) => s.user);
  return useQuery({ queryKey: ["myDriver", user?.id], queryFn: () => api.getDriverByUser(user!.id), enabled: user?.role === "DRIVER" });
}

/** Short two-tone chime for new-order alerts (Web Audio, no asset needed). */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
  } catch {
    /* audio not available */
  }
}
