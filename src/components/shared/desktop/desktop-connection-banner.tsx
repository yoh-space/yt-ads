"use client";

import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { isDesktopShell } from "@/lib/desktop";
import { cn } from "@/lib/utils";

/**
 * Desktop status banner that monitors network connectivity.
 * Stays inert when online, and presents a non-intrusive warning
 * if the workstation loses its network connection.
 */
export function DesktopConnectionBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isDesktopShell());
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold shadow-2xl",
        "bg-rose-950/90 text-rose-200 border border-rose-500/50 backdrop-blur-md animate-in slide-in-from-bottom-2"
      )}
    >
      <WifiOff size={15} className="text-rose-400 shrink-0" />
      <span>Workstation offline — waiting for network reconnection</span>
    </div>
  );
}
