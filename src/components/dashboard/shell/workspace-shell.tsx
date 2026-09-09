"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import type { Profile, Role } from "@/lib/operations-types";
import { InventoryLoader } from "../widgets/inventory-loader";
import { DashboardAccessDenied } from "./access-denied";
import { Topbar } from "./topbar";
import {
  Boxes,
  CircleDollarSign,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Crown,
  Factory,
  FileBarChart,
  FolderKanban,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Scale,
  Scissors,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

const workspaceIcons = {
  boxes: Boxes,
  circleDollarSign: CircleDollarSign,
  clipboardList: ClipboardList,
  factory: Factory,
  fileBarChart: FileBarChart,
  folderKanban: FolderKanban,
  history: History,
  inbox: Inbox,
  layoutDashboard: LayoutDashboard,
  scale: Scale,
  scissors: Scissors,
  settings: Settings,
  shoppingCart: ShoppingCart,
  slidersHorizontal: SlidersHorizontal,
  users: Users,
} as const;

export type WorkspaceIconName = keyof typeof workspaceIcons;

export interface WorkspaceNavItem {
  href: string;
  label: string;
  english: string;
  icon: WorkspaceIconName;
}

function WorkspaceSidebar({
  mobileOpen,
  onClose,
  onToggleSidebar,
  collapsed,
  navItems,
  brandLabel,
  companyName,
  BrandIcon,
}: {
  mobileOpen: boolean;
  onClose: () => void;
  onToggleSidebar: () => void;
  collapsed: boolean;
  navItems: WorkspaceNavItem[];
  brandLabel: string;
  companyName?: string;
  BrandIcon: LucideIcon;
}) {
  const pathname = usePathname();

  const nav = (
    <nav
      aria-label={`${brandLabel} navigation`}
      className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-3 [scrollbar-color:hsl(var(--border))_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-primary"
    >
      {navItems.map((item) => {
        const Icon = workspaceIcons[item.icon];
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            title={collapsed ? item.english : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
              collapsed && "justify-center px-0",
              active
                ? "bg-primary/10 text-primary border-l-2 border-primary"
                : "text-muted-foreground hover:bg-muted/10 hover:text-foreground border-l-2 border-transparent",
            )}
          >
            <Icon size={16} className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("truncate", collapsed && "hidden")}>
              <span className="block leading-tight">{item.label}</span>
              <span className="block text-[10px] text-muted-foreground/70 leading-tight">{item.english}</span>
            </span>
            {collapsed && (
              <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                {item.english}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className={cn("relative flex items-center h-14 border-b border-border shrink-0", collapsed ? "justify-center px-0" : "gap-2 px-3")}>
      <span className="grid place-items-center w-7 h-7 rounded-md bg-primary/15 text-primary">
        <BrandIcon size={14} />
      </span>
      <div className={cn("min-w-0", collapsed && "hidden")}>
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground leading-tight truncate">
          {companyName ?? "YT Advertisement"}
        </p>
        <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-primary leading-tight truncate">{brandLabel}</p>
      </div>
      <button
        type="button"
        className={cn(
          "hidden md:grid place-items-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted/20 hover:text-foreground",
          collapsed ? "absolute -right-3 top-5 bg-card border border-border" : "ml-auto",
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={onToggleSidebar}
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
      <button
        type="button"
        className="ml-auto grid place-items-center rounded-md border border-border p-1.5 text-muted-foreground md:hidden"
        aria-label="Close navigation"
        onClick={onClose}
      >
        <X size={16} />
      </button>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-visible bg-card border-r border-border shadow-[0_20px_55px_rgba(2,6,23,0.25)] transition-all duration-300 ease-in-out md:translate-x-0",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {brand}
        {nav}
        <div className={cn("p-3 border-t border-border", collapsed && "px-2")}>
          <Link
            href="/sign-in"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <LogOut size={14} />
            <span className={cn(collapsed && "hidden")}>ውጣ · Sign out</span>
          </Link>
        </div>
      </aside>
    </>
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
  consoleLabel,
  icon = Crown,
  accessDeniedReason,
  children,
}: {
  roles: Role[];
  navItems: WorkspaceNavItem[];
  brandLabel: string;
  consoleLabel: string;
  icon?: LucideIcon;
  accessDeniedReason?: string;
  children: ReactNode;
}) {
  const profile = useQuery(api.users.getCurrentProfile);
  const companySettings = useQuery(api.users.getCompanySettings);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const resolvedProfile: Profile = { ...profile, id: profile._id };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkspaceSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onToggleSidebar={toggleSidebar}
        collapsed={sidebarCollapsed}
        navItems={navItems}
        brandLabel={brandLabel}
        companyName={companySettings?.companyName}
        BrandIcon={icon}
      />
      <div className={cn("flex min-h-screen flex-col transition-all duration-300", sidebarCollapsed ? "md:ml-16" : "md:ml-60")}>
        <Topbar
          onMenu={() => setMobileOpen(true)}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          profile={resolvedProfile}
          companyName={companySettings?.companyName}
          onOpenSettings={() => {}}
        />
        <main className="flex-1 w-full max-w-[1700px] mx-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}