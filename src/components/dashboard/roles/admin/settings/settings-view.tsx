"use client";

import { useState } from "react";
import {
  Building2,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Profile } from "@/lib/operations-types";
import { can } from "@/lib/permissions";
import type { SettingsCategory } from "@/components/dashboard/shell/nav-config";
import type { SettingsCategoryEntry } from "./settings-sidebar";
import { SettingsSidebar } from "./settings-sidebar";
import { SettingsHeader } from "./settings-header";
import { CompanyPanel } from "./panels/company-panel";
import { ProfilePanel } from "./panels/profile-panel";
import { SecurityPanel } from "./panels/security-panel";
import { TeamPanel } from "./panels/team-panel";
import { MigrationPanel } from "./panels/migration-panel";
import { CatalogResetPanel } from "./panels/catalog-reset-panel";
import { SystemResetPanel } from "./panels/system-reset-panel";

/**
 * Top-level settings shell: chooses which settings category to show and
 * delegates rendering to category-specific panels.
 */
export function SettingsView({ profile }: { profile: Profile }) {
  const isOwner = profile.role === "owner";
  const canManageTeam = can(profile, "team.manage");
  const canUpdateCompany = can(profile, "company_settings.update");

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("profile");

  const categories: SettingsCategoryEntry[] = [
      { id: "profile", icon: <UserRound size={20} />, title: "Personal Profile", description: "Update your name, profile image, and display information." },
      { id: "security", icon: <ShieldCheck size={20} />, title: "Security", description: "Change your password and manage sign-in methods." },
      ...(canManageTeam
        ? [{
            id: "team",
            icon: <Shield size={20} />,
            title: "Team Access",
            description: "Manage team roles and workspace permissions.",
            badge: isOwner ? "Owner" : "Manager",
          } satisfies SettingsCategoryEntry]
        : []),
      ...(canUpdateCompany
        ? [{
            id: "company",
            icon: <Building2 size={20} />,
            title: "Company Profile",
            description: "Manage workspace branding and company settings.",
          } satisfies SettingsCategoryEntry]
        : []),
      ...(canUpdateCompany
        ? [{
            id: "migration",
            icon: <ShieldCheck size={20} />,
            title: "Data Migration",
            description: "Run one-time package metadata backfills.",
            badge: "Admin",
          } satisfies SettingsCategoryEntry]
        : []),
      ...(isOwner
        ? [{
            id: "catalog-reset",
            icon: <ShieldCheck size={20} />,
            title: "Catalog Reset",
            description: "Purge all data and re-seed the 23-category material catalog.",
            badge: "Owner",
          } satisfies SettingsCategoryEntry]
        : []),
      ...(isOwner
        ? [{
            id: "system-reset",
            icon: <ShieldCheck size={20} />,
            title: "System Data Reset",
            description: "Start the ERP from a clean operational slate.",
            badge: "Owner",
          } satisfies SettingsCategoryEntry]
        : []),
    ];

  const selected = categories.find((entry) => entry.id === activeCategory) ?? categories[0];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <SettingsSidebar
            categories={categories}
            activeId={selected.id}
            onSelect={(id) => setActiveCategory(id as SettingsCategory)}
          />

          <div className="space-y-6">
            <SettingsHeader selected={selected} />

            {selected.id === "profile" && <ProfilePanel profile={profile} />}
            {selected.id === "security" && <SecurityPanel isOwner={isOwner} />}
            {selected.id === "team" && <TeamPanel profile={profile} />}
            {selected.id === "company" && <CompanyPanel />}
            {selected.id === "migration" && <MigrationPanel />}
            {selected.id === "catalog-reset" && isOwner && <CatalogResetPanel />}
            {selected.id === "system-reset" && isOwner && <SystemResetPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}