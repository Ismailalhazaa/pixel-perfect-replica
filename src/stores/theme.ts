import { create } from "zustand";

export type Theme = "light" | "dark";
const KEY = "waselni-theme";

interface ThemeState { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void; init: () => void }

const apply = (t: Theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", t === "dark");
};

export const useTheme = create<ThemeState>()((set, get) => ({
  theme: "light",
  setTheme: (theme) => {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  init: () => {
    let t: Theme = "light";
    try {
      const saved = localStorage.getItem(KEY);
      t = saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch { /* ignore */ }
    apply(t);
    set({ theme: t });
  },
}));

/** Inline pre-hydration script so the page never flashes the wrong theme. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;
