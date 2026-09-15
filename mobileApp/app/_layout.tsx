import { Stack } from "expo-router";
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";
import "react-native-reanimated";
import { Text, View } from "react-native";

import { useTheme } from "@/hooks/use-theme";
import { convex, convexUrl } from "@/lib/convex";
import { authClient } from "@/lib/auth-client";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/theme-provider";

export const unstable_settings = {
  anchor: "(app)",
};

function ConvexUrlWarning() {
  const { theme } = useTheme();
  if (convexUrl) return null;
  return (
    <View style={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
      <Text style={{ color: theme.colors.warning, fontSize: theme.fontSizes.xs, fontWeight: theme.fontWeights.bold }}>
        Set EXPO_PUBLIC_CONVEX_URL to enable queries and mutations.
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ConvexBetterAuthProvider client={convex} authClient={authClient as unknown as AuthClient}>
        <AuthProvider>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
          <ConvexUrlWarning />
        </AuthProvider>
      </ConvexBetterAuthProvider>
    </ThemeProvider>
  );
}