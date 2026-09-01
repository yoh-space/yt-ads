import type { NextRequest } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export const dynamic = "force-dynamic";

const TELEGRAM_API = "https://api.telegram.org";

async function proxy(request: NextRequest, method: "GET" | "POST") {
  const { handler } = await import("@/lib/auth-server");
  return handler[method](request);
}

export function GET(request: NextRequest) {
  return proxy(request, "GET");
}

async function sessionTokenFromResponse(response: Response): Promise<string | null> {
  const headers = response.headers;
  const setCookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : headers.get("set-cookie")
        ? [headers.get("set-cookie")!]
        : [];
  for (const cookie of setCookies) {
    const match = /better-auth\.session_token=(?:[^;]*\.)?([^;]+)/i.exec(cookie);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

async function convexTokenFromSession(sessionToken: string): Promise<string | null> {
  const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (!siteUrl) return null;
  try {
    const response = await fetch(`${siteUrl}/api/auth/convex/token`, {
      headers: {
        host: new URL(siteUrl).host,
        cookie: `better-auth.session_token=${sessionToken}`,
      },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function deviceLabel(request: NextRequest): string {
  const userAgent = request.headers.get("user-agent") ?? "";
  let os = "Unknown OS";
  const osChecks: Array<[RegExp, string]> = [
    [/windows nt 1?0/i, "Windows"],
    [/mac os x/i, "macOS"],
    [/android/i, "Android"],
    [/iphone/i, "iPhone"],
    [/ipad/i, "iPad"],
    [/linux/i, "Linux"],
  ];
  for (const [pattern, label] of osChecks) {
    if (pattern.test(userAgent)) {
      os = label;
      break;
    }
  }

  if (/edg\//i.test(userAgent)) return `Edge on ${os}`;
  if (/chrome\/|crios\//i.test(userAgent)) return `Chrome on ${os}`;
  if (/firefox\/|fxios\//i.test(userAgent)) return `Firefox on ${os}`;
  if (/safari\//i.test(userAgent)) return `Safari on ${os}`;
  return os;
}

async function sendTelegram(method: string, payload: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Owner login security alert. Fires only for successful sign-ins; determinines
 * the role with the freshly created session (exchanged for a Convex JWT) so a
 * non-owner can never trigger a message.
 */
async function sendOwnerLoginAlert(request: NextRequest, response: Response) {
  const alertChatId = process.env.TELEGRAM_ALERT_CHAT_ID;
  if (!alertChatId) return;

  const sessionToken = await sessionTokenFromResponse(response);
  if (!sessionToken) return;

  const token = await convexTokenFromSession(sessionToken);
  if (!token) return;

  const info = await fetchQuery(api.security.checkOwnerLogin, {}, { token });
  if (!info.isOwner) return;

  const message = `⚠️ Security Alert: ${info.userName} (${info.role}) logged in from ${deviceLabel(request)} (IP: ${clientIp(request)}).`;
  await sendTelegram("sendMessage", { chat_id: alertChatId, text: message });
}

export async function POST(request: NextRequest) {
  const response = await proxy(request, "POST");
  const pathname = new URL(request.url).pathname;
  if (pathname.includes("/sign-in/")) {
    void sendOwnerLoginAlert(request, response).catch(() => {});
  }
  return response;
}