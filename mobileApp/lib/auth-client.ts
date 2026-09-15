import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

/**
 * Better Auth is served through the Convex site URL (the root deployment's
 * HTTP router). The session cookie is cached on device in expo-secure-store.
 */
const siteUrl = process.env.EXPO_PUBLIC_CONVEX_SITE_URL ?? process.env.EXPO_PUBLIC_BETTER_AUTH_URL ?? "";

const rawScheme = Constants.expoConfig?.scheme;
const scheme = typeof rawScheme === "string" ? rawScheme : rawScheme?.[0] ?? "ytads";

const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
} as unknown as { getItem: (key: string) => string | null; setItem: (key: string, value: string) => unknown };

export const authClient = createAuthClient({
  baseURL: siteUrl,
  plugins: [
    expoClient({
      scheme,
      storagePrefix: scheme,
      storage: secureStorage,
    }),
    convexClient(),
  ],
});