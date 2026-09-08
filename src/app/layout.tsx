import type { Metadata } from "next";
import Script from "next/script";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { AutoUpdater } from "@/components/auto-updater";
import { DesktopConnectionBanner } from "@/components/dashboard/desktop-connection-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "YT Advertising | Operations Control",
  description: "Inventory and production tracking by YoTech Digitals",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="am">
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js?57" strategy="beforeInteractive" />
        <AutoUpdater />
        <DesktopConnectionBanner />
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
