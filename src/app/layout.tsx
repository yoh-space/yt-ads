import type { Metadata } from "next";
import Script from "next/script";
import { ConvexClientProvider } from "@/components/shared/providers/convex-client-provider";
import { AutoUpdater } from "@/components/shared/desktop/auto-updater";
import { DesktopConnectionBanner } from "@/components/shared/desktop/desktop-connection-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "YT Advertising | Operations Control",
  description: "Inventory and production tracking by YoTech Digitals",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="am" suppressHydrationWarning>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js?57" strategy="beforeInteractive" />
        <AutoUpdater />
        <DesktopConnectionBanner />
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
