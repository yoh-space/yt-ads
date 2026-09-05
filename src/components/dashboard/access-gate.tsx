"use client";

import type { ReactNode } from "react";
import type { AccessContext, Capability } from "@/lib/access-policy";
import { canAccess } from "@/lib/access-policy";

export function AccessGate({
  context,
  capability,
  children,
  fallback = null,
}: {
  context: AccessContext;
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return canAccess(context, capability) ? children : fallback;
}
