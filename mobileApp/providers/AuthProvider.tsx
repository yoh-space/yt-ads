import type { ReactNode } from "react";
import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@convex/api";
import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth.store";
import { toProfile } from "@/lib/profile";

/**
 * Bridges the reactive Better Auth session + Convex profile query into the
 * in-memory auth store. Nothing is persisted here.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const profile = useQuery(api.users.getCurrentProfile);

  const user = session.data?.user;

  useEffect(() => {
    useAuthStore.getState().setUser(
      user ? { id: user.id, name: user.name, email: user.email, image: user.image } : null
    );
  }, [user]);

  useEffect(() => {
    useAuthStore.getState().setProfile(profile ? toProfile(profile) : null);
  }, [profile]);

  useEffect(() => {
    useAuthStore.getState().setHydrated(!isLoading && !isAuthenticated ? true : !isLoading && profile !== undefined);
  }, [isLoading, isAuthenticated, profile]);

  return <>{children}</>;
}