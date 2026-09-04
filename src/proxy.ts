import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getRoleHomeRoute,
  isPublicRoute,
  isRouteAllowedForRole,
  isValidRole,
} from "./lib/role-routing";
import type { Role } from "./lib/operations-types";

const COOKIE_SESSION_NAME = "better-auth.session_token";
const COOKIE_SECURE_SESSION_NAME = "__Secure-better-auth.session_token";
const COOKIE_ROLE_NAME = "user_role";

async function resolveRoleFromConvex(sessionToken: string): Promise<Role | null> {
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!siteUrl || !convexUrl) return null;

  try {
    // 1. Exchange session token for Convex JWT
    const tokenRes = await fetch(`${siteUrl}/api/auth/convex/token`, {
      headers: {
        host: new URL(siteUrl).host,
        cookie: `${COOKIE_SESSION_NAME}=${sessionToken}`,
      },
    });
    if (!tokenRes.ok) return null;
    const tokenData = (await tokenRes.json()) as { token?: string };
    const jwt = tokenData.token;
    if (!jwt) return null;

    // 2. Query user profile from Convex
    const profileRes = await fetch(`${convexUrl}/api/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        path: "users:getCurrentProfile",
        args: {},
        format: "json",
      }),
    });
    if (!profileRes.ok) return null;
    const data = (await profileRes.json()) as { value?: { role?: string; active?: boolean } };
    const userRole = data?.value?.role;
    if (isValidRole(userRole)) {
      return userRole;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Next.js 16 Edge Access & Request Interceptor Guard (replacing deprecated middleware.ts).
 * Handles primary request interception, session token verification, role landing dispatch,
 * and unauthorized route redirects.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public routes (landing, sign-in, track, static files, api)
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Verify Better Auth session cookie
  const sessionToken =
    request.cookies.get(COOKIE_SESSION_NAME)?.value ||
    request.cookies.get(COOKIE_SECURE_SESSION_NAME)?.value;

  if (!sessionToken) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // 3. Resolve role: check fast cookie cache first, fallback to Convex API query
  let role: Role | null = null;
  const cachedRole = request.cookies.get(COOKIE_ROLE_NAME)?.value;
  if (isValidRole(cachedRole)) {
    role = cachedRole;
  } else {
    role = await resolveRoleFromConvex(sessionToken);
  }

  // If session is expired/invalid, redirect to sign-in
  if (!role) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const roleHome = getRoleHomeRoute(role);

  // 4. Root /dashboard dispatch: route to specific role landing page
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    const redirectUrl = new URL(roleHome, request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(COOKIE_ROLE_NAME, role, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  // 5. Root /inventory dispatch: route storekeeper to parent, operators to substock
  if (pathname === "/inventory" || pathname === "/inventory/") {
    const target =
      role === "storekeeper"
        ? "/inventory/parent"
        : ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"].includes(role)
          ? "/inventory/substock"
          : "/inventory/parent";
    const redirectUrl = new URL(target, request.url);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(COOKIE_ROLE_NAME, role, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  // 6. Access Authorization Guard: block unauthorized route attempts
  if (!isRouteAllowedForRole(role, pathname)) {
    const redirectUrl = new URL(roleHome, request.url);
    redirectUrl.searchParams.set("unauthorized", "1");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(COOKIE_ROLE_NAME, role, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  // 7. Authorized route: proceed and keep role cookie in sync
  const response = NextResponse.next();
  if (cachedRole !== role) {
    response.cookies.set(COOKIE_ROLE_NAME, role, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
