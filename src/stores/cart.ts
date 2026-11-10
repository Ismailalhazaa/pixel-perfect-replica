import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartLineOption { groupId: string; optionId: string; name: string; priceDelta: number }
export interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  imageUrl?: string;
  basePrice: number;
  options: CartLineOption[];
  quantity: number;
  notes?: string;
}

export const lineUnitPrice = (l: CartLine) => l.basePrice + l.options.reduce((a, o) => a + o.priceDelta, 0);
export const lineTotal = (l: CartLine) => lineUnitPrice(l) * l.quantity;

interface CartState {
  restaurantId: string | null;
  restaurantName: string | null;
  lines: CartLine[];
  notes: string;
  zoneId: string | null;
  /** Returns false when the cart belongs to another restaurant. */
  addLine: (restaurantId: string, restaurantName: string, line: Omit<CartLine, "key">) => boolean;
  setQuantity: (key: string, q: number) => void;
  setLineNotes: (key: string, notes: string) => void;
  setNotes: (n: string) => void;
  setZone: (z: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      restaurantName: null,
      lines: [],
      notes: "",
      zoneId: null,
      addLine: (restaurantId, restaurantName, line) => {
        const s = get();
        if (s.restaurantId && s.restaurantId !== restaurantId && s.lines.length) return false;
        const key = `${line.menuItemId}|${line.options.map((o) => o.optionId).sort().join(",")}|${line.notes ?? ""}`;
        const existing = s.lines.find((l) => l.key === key);
        const lines = existing
          ? s.lines.map((l) => (l.key === key ? { ...l, quantity: l.quantity + line.quantity } : l))
          : [...s.lines, { ...line, key }];
        set({ restaurantId, restaurantName, lines });
        return true;
      },
      setQuantity: (key, q) =>
        set((s) => {
          const lines = q <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, quantity: q } : l));
          return lines.length ? { lines } : { lines, restaurantId: null, restaurantName: null };
        }),
      setLineNotes: (key, notes) => set((s) => ({ lines: s.lines.map((l) => (l.key === key ? { ...l, notes } : l)) })),
      setNotes: (notes) => set({ notes }),
      setZone: (zoneId) => set({ zoneId }),
      clear: () => set({ restaurantId: null, restaurantName: null, lines: [], notes: "" }),
    }),
    { name: "waselni-cart", skipHydration: true },
  ),
);

export const cartSubtotal = (lines: CartLine[]) => lines.reduce((a, l) => a + lineTotal(l), 0);
export const cartCount = (lines: CartLine[]) => lines.reduce((a, l) => a + l.quantity, 0);
