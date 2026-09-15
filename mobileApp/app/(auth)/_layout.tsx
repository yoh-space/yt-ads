import { Redirect, Stack } from "expo-router";
import { useProfile } from "@/hooks/useProfile";
import { homeTabForRole } from "@/shared/role-navigation";

export default function AuthLayout() {
  const { isAuthenticated, role, isHydrated } = useProfile();

  if (isHydrated && isAuthenticated && role) {
    return <Redirect href={homeTabForRole(role)} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
    </Stack>
  );
}