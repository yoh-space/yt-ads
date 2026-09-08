"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/operations-types";
import { InventoryLoader } from "./inventory-loader";
import { DashboardAccessDenied } from "./access-denied";
import { Crown, Menu, LogOut, type LucideIcon } from "lucide-react";

export interface WorkspaceNavItem {
  href: string;
  label: string;
  english: string;
  icon: LucideIcon;
}

function WorkspaceSidebar({
  mobileOpen,
  onClose,
  navItems,
  brandLabel,
  companyName,
  BrandIcon,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  navItems: WorkspaceNavItem[];
  brandLabel: string;
  companyName?: string;
  BrandIcon: LucideIcon;
}) {
  const pathname = usePathname();

  const nav = (
    <nav aria-label={`${brandLabel} navigation`} className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary border-l-2 border-primary"
                : "text-muted-foreground hover:bg-muted/10 hover:text-foreground border-l-2 border-transparent",
            )}
          >
            <Icon size={16} className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")} />
            <span className="truncate">
              <span className="block leading-tight">{item.label}</span>
              <span className="block text-[10px] text-muted-foreground/70 leading-tight">{item.english}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2 px-4 h-14 border-b border-border shrink-0">
      <span className="grid place-items-center w-7 h-7 rounded-md bg-primary/15 text-primary">
        <BrandIcon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground leading-tight truncate">
          {companyName ?? "YT Advertisement"}
        </p>
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-primary leading-tight">{brandLabel}</p>
      </div>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-card border-r border-border transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {brand}
        {nav}
        <div className="p-3 border-t border-border">
          <Link
            href="/sign-in"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <LogOut size={14} />
            <span>ውጣ · Sign out</span>
          </Link>
        </div>
      </aside>
    </>
  );
}

function WorkspaceTopbar({
  onOpenMenu,
  profileName,
  companyName,
  consoleLabel,
  workspaceTitle,
}: {
  onOpenMenu: () => void;
  profileName?: string;
  companyName?: string;
  consoleLabel: string;
  workspaceTitle: string;
}) {
  const initials = (profileName ?? "U")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 backdrop-blur px-4 md:px-6">
      <button
        onClick={onOpenMenu}
        className="grid place-items-center rounded-md border border-border p-1.5 text-muted-foreground md:hidden"
        aria-label="Open workspace menu"
      >
        <Menu size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[8px] font-mono uppercase tracking-[0.2em] text-muted-foreground truncate">
          {companyName ?? "YT Advertisement"} · {consoleLabel}
        </p>
        <p className="text-[13px] font-semibold text-foreground truncate">{workspaceTitle}</p>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1">
        <span className="grid place-items-center w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
          {initials}
        </span>
        <span className="hidden sm:block text-[11px] font-medium text-muted-foreground max-w-[140px] truncate">
          {profileName ?? "User"}
        </span>
      </div>
    </header>
  );
}

/**
 * Parametrized role-workspace shell (sidebar, topbar, loading and access guards).
 * Mirrors the owner console shell so every isolated workspace shares one layout
 * implementation. Authorization is enforced again inside each workspace's Convex
 * namespace via strict role guards.
 */
export function WorkspaceShell({
  roles,
  navItems,
  brandLabel,
  workspaceTitle,
  consoleLabel,
  icon = Crown,
  accessDeniedReason,
  children,
}: {
  roles: Role[];
  navItems: WorkspaceNavItem[];
  brandLabel: string;
  workspaceTitle: string;
  consoleLabel: string;
  icon?: LucideIcon;
  accessDeniedReason?: string;
  children: ReactNode;
}) {
  const profile = useQuery(api.users.getCurrentProfile);
  const companySettings = useQuery(api.users.getCompanySettings);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (profile === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <InventoryLoader label={`Loading ${consoleLabel}…`} />
      </div>
    );
  }

  if (!profile) {
    return <DashboardAccessDenied reason={accessDeniedReason ?? "This area is reserved for an authorized profile."} />;
  }

  if (!roles.includes(profile.role)) {
    return <DashboardAccessDenied reason={accessDeniedReason ?? "This area is reserved for an authorized profile only."} />;
  }

  if (!profile.active) {
    return <DashboardAccessDenied reason="Your profile is inactive. Contact the owner to restore access." />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkspaceSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        navItems={navItems}
        brandLabel={brandLabel}
        companyName={companySettings?.companyName}
        BrandIcon={icon}
      />
      <div className="flex min-h-screen flex-col md:pl-64">
        <WorkspaceTopbar
          onOpenMenu={() => setMobileOpen(true)}
          profileName={profile.name}
          companyName={companySettings?.companyName}
          consoleLabel={consoleLabel}
          workspaceTitle={workspaceTitle}
        />
        <main className="flex-1 w-full max-w-[1700px] mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}