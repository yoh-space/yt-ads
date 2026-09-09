/** Returns "Browser · OS" parsed from a user-agent string, e.g. "Chrome · Windows". */
export function summariseSessionUserAgent(userAgent?: string | null): string {
  if (!userAgent) return "Unknown device";
  const os = /Windows/i.test(userAgent)
    ? "Windows"
    : /Mac OS X/i.test(userAgent)
      ? "macOS"
      : /Android/i.test(userAgent)
        ? "Android"
        : /iPhone/i.test(userAgent)
          ? "iPhone"
          : /iPad/i.test(userAgent)
            ? "iPad"
            : /Linux/i.test(userAgent)
              ? "Linux"
              : "Unknown OS";
  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /Chrome\//i.test(userAgent) || /CriOS\//i.test(userAgent)
      ? "Chrome"
      : /Firefox\//i.test(userAgent) || /FxiOS\//i.test(userAgent)
        ? "Firefox"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : "Browser";
  return `${browser} · ${os}`;
}

/** Compact `01 Jun, 14:32` style timestamp used inside session cards. */
export function formatSessionTime(timestamp?: Date): string {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/** Detects whether a `success | error` FormMessage tone should be used for this text. */
export function messageToneFromText(message: string): "success" | "error" {
  return message.toLowerCase().includes("unable") ? "error" : "success";
}
