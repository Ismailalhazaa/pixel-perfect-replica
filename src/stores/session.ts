import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User } from "@/types";
import { setAuthToken } from "@/services/api";

interface SessionState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  setSession: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      hydrated: false,
      setSession: (user, token) => {
        setAuthToken(token);
        set({ user, token });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        setAuthToken(null);
        set({ user: null, token: null });
      },
    }),
    {
      name: "waselni-session",
      skipHydration: true,
      partialize: (s) => ({ user: s.user, token: s.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) setAuthToken(state.token);
        useSession.setState({ hydrated: true });
      },
    },
  ),
);

export const HOME_BY_ROLE: Record<Role, "/" | "/restaurant-panel" | "/driver" | "/admin"> = {
  CUSTOMER: "/",
  RESTAURANT: "/restaurant-panel",
  DRIVER: "/driver",
  ADMIN: "/admin",
};
