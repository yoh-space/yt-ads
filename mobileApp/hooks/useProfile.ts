import { useAuthStore } from "@/stores/auth.store";

/** Selector over the auth store — profile/role are hydrated reactively. */
export function useProfile() {
  const profile = useAuthStore((s) => s.profile);
  const role = useAuthStore((s) => s.role);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  return {
    profile,
    role,
    isAuthenticated,
    isHydrated,
    isLoading: !isHydrated,
    signOut: () => useAuthStore.getState().signOut(),
  };
}