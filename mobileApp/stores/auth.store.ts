import { create } from "zustand";
import type { Profile, Role } from "@shared-lib/operations-types";
import { api } from "@convex/api";
import { convex } from "@/lib/convex";
import { authClient } from "@/lib/auth-client";
import { toProfile } from "@/lib/profile";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};

type AuthState = {
  user: SessionUser | null;
  profile: Profile | null;
  role: Role | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setUser: (user: SessionUser | null) => void;
  setProfile: (profile: Profile | null) => void;
  setHydrated: (hydrated: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  role: null,
  isAuthenticated: false,
  isHydrated: false,

  setUser: (user) =>
    set({ user, isAuthenticated: Boolean(user) }),

  setProfile: (profile) =>
    set({ profile, role: profile?.role ?? null }),

  setHydrated: (isHydrated) => set({ isHydrated }),

  signIn: async (email, password) => {
    const result = await authClient.signIn.email({ email, password });
    if (result.error) {
      return { error: result.error.message ?? "Invalid email or password." };
    }
    const session = await authClient.getSession();
    const user = session?.data?.user;
    if (user) {
      set({ user: { id: user.id, name: user.name, email: user.email, image: user.image }, isAuthenticated: true });
    }
    const profile = await convex.query(api.users.getCurrentProfile).catch(() => null);
    set({ profile: profile ? toProfile(profile) : null, role: profile?.role ?? null });
    set({ isHydrated: true });
    return {};
  },

  signOut: async () => {
    await authClient.signOut().catch(() => {});
    set({ user: null, profile: null, role: null, isAuthenticated: false, isHydrated: true });
  },

  reset: () =>
    set({ user: null, profile: null, role: null, isAuthenticated: false, isHydrated: false }),
}));