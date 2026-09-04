"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isDesktopShell } from "@/lib/desktop";
import { TelegramMiniAppOrder } from "@/components/public/telegram-mini-app-order";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (isDesktopShell()) {
      router.replace("/dashboard");
    }
  }, [router]);

  return <TelegramMiniAppOrder />;
}

