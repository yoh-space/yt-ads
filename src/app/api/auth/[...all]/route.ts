import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, method: "GET" | "POST") {
  const { handler } = await import("@/lib/auth-server");
  return handler[method](request);
}

export function GET(request: NextRequest) {
  return proxy(request, "GET");
}

export function POST(request: NextRequest) {
  return proxy(request, "POST");
}
