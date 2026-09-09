"use client";

import { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Toaster } from "sonner";
import { authClient } from "@/lib/auth-client";
import { ConvexBetterAuthProvider, type AuthClient } from "@convex-dev/better-auth/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = new ConvexReactClient(convexUrl ?? "https://local-placeholder.convex.cloud");

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convexUrl)
    return (
      <ConvexProvider client={convex}>
        {children}
        <Toaster richColors position="top-right" />
      </ConvexProvider>
    );
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient as unknown as AuthClient}>
      {children}
      <Toaster richColors position="top-right" />
    </ConvexBetterAuthProvider>
  );
}
