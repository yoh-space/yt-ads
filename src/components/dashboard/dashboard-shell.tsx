"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Profile, Role } from "@/lib/operations-types";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DesktopConnectionBanner } from "./desktop-connection-banner";
import { InventoryLoader } from "./inventory-loader";
import { DashboardAccessDenied } from "./access-denied";
import { canAccess } from "@/lib/access-policy";
import { WorkspaceRenderer } from "./workspace-renderer";
import { isOwnerWorkspacePath } from "./owner/owner-shell";
import { resolveWorkspace } from "./workspace-registry";
import { DashboardModalProvider } from "./modal-context";
import { DashboardActionModals } from "./dashboard-action-modals";
import { useNotification, type NotificationSummary } from "@/hooks/useNotification";

function NotificationAudioBridge({ enabled }: { enabled: boolean }) {
  const notifications = useQuery(api.notifications.list, enabled ? {} : "skip");
  useNotification(notifications as NotificationSummary[] | undefined);
  return null;
}

function DashboardShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const profile = useQuery(api.users.getCurrentProfile);
  const companySettings = useQuery(api.users.getCompanySettings);
  const role: Role = profile?.role ?? "admin";
  const accessContext = { profile: profile ? { role: profile.role, active: profile.active } : null };
  const workspace = resolveWorkspace(accessContext);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Synchronize role cookie for Next.js proxy routing
  useEffect(() => {
    if (profile?.role) {
      document.cookie = `user_role=${profile.role}; path=/; max-age=604800; SameSite=Lax`;
    }
  }, [profile?.role]);

  useEffect(() => {
    const stored = window.localStorage.getItem("dashboard-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("dashboard-sidebar-collapsed", String(next));
      return next;
    });
  }

  if (profile === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0C0D10]">
        <InventoryLoader label="Loading Operations Console…" />
      </div>
    );
  }

  if (profile && !profile.active) {
    return <DashboardAccessDenied />;
  }

  const notificationAudio = <NotificationAudioBridge enabled={Boolean(profile)} />;

  // Owner workspace renders its own isolated shell inside owner/layout.tsx.
  // Branch here (client-side) so client navigations from shared pages also
  // bypass the shared shell correctly.
  if (isOwnerWorkspacePath(pathname)) {
    return <>{notificationAudio}{children}</>;
  }

  const resolvedProfile: Profile | null = profile ? { ...profile, id: profile._id } : null;

  return (
    <div
      className="min-h-screen bg-[#0C0D10] text-[#E2E8F0]"
    >
      {notificationAudio}
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onToggleSidebar={toggleSidebar}
        collapsed={sidebarCollapsed}
        companyName={companySettings?.companyName}
        role={role}
        workspace={workspace ?? undefined}
      />

      <div
        className={cn(
          "min-h-screen flex flex-col transition-all duration-300",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60"
        )}
      >
        <Topbar
          onMenu={() => setMobileNavOpen(true)}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          profile={resolvedProfile}
          companyName={companySettings?.companyName}
          onOpenSettings={() => {}}
        />

        <main className="flex-1 p-6 md:p-8 max-w-[1700px] w-full mx-auto animate-in fade-in duration-200">
          <WorkspaceRenderer context={accessContext}>{children}</WorkspaceRenderer>
        </main>
      </div>

      <DesktopConnectionBanner />

      <DashboardActionModals profile={resolvedProfile} />
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardModalProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </DashboardModalProvider>
  );
}
