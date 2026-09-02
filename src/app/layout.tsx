import type { Metadata } from "next";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { AutoUpdater } from "@/components/auto-updater";
import "./globals.css";

export const metadata: Metadata = {
  title: "YT Advertising | Operations Control",
  description: "Inventory and production tracking by YoTech Digitals",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="am">
      <body>
        <AutoUpdater />
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
