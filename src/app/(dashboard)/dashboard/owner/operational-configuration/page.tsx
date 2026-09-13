"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { Clock, Shield, Save, Database } from "lucide-react";
import { Button } from "@/components/shared/ui";
import { FormMessage } from "@/components/dashboard/roles/admin/settings/chrome/form";
import { OrderExpirySection } from "@/components/dashboard/roles/admin/settings/operational/sections/order-expiry-section";
import { RiskSection } from "@/components/dashboard/roles/admin/settings/operational/sections/risk-section";
import { DatabaseCatalogSuite } from "@/components/dashboard/roles/owner/catalogs/database-catalog-suite";
import { useOperationalConfigState } from "@/components/dashboard/roles/admin/settings/operational/state";

type ConfigSection = "orders" | "security" | "catalogs";

const SECTIONS = [
  { id: "catalogs" as ConfigSection, label: "Master Catalogs", icon: Database, amharic: "ዳታቤዝ ካታሎግ" },
  { id: "orders" as ConfigSection, label: "Order Lifecycle", icon: Clock, amharic: "የትዕዛዝ ዘርፍ" },
  { id: "security" as ConfigSection, label: "Security Controls", icon: Shield, amharic: "የደህንነት ቁጥጥር" },
];

export default function OwnerOperationalConfigurationPage() {
  const [activeSection, setActiveSection] = useState<ConfigSection>("catalogs");
  const config = useQuery(api.systemConfigs.getSystemConfig);
  const state = useQuery(api.dashboard.getState, {});
  const updateSystemConfig = useMutation(api.systemConfigs.updateSystemConfig);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const form = useOperationalConfigState(config ?? undefined);

  if (config === undefined || state === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <p className="text-xs text-muted-foreground">Loading configuration…</p>
      </div>
    );
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await updateSystemConfig({
        etbPerSquareMetre: form.etbPerSquareMetre,
        etbPerLitre: form.etbPerLitre,
        etbPerPiece: form.etbPerPiece,
        etbPerMetre: form.etbPerMetre,
        etbPerSheet: form.etbPerSheet,
        unitConversionDefaults: form.unitConversionDefaults,
        materialOverrides: form.overrides,
        inkMlPerSquareMetre: form.inkMlPerSquareMetre,
        maxAllowedWastePercent: form.maxAllowedWastePercent,
        minOffcutAreaSquareMetre: form.minOffcutAreaSquareMetre,
        standardWasteMargin: form.standardWasteMargin,
        maxAllowedScrapLimit: form.maxAllowedScrapLimit,
        defaultReorderLevel: form.defaultReorderLevel,
        reorderAlertsEnabled: form.reorderAlertsEnabled,
        reorderAlertCooldownHours: form.reorderAlertCooldownHours,
        requireAdminPinForExceptions: form.requireAdminPinForExceptions,
        maxDirectStockOutEtb: form.maxDirectStockOutEtb,
        orderExpirationHours: form.orderExpirationHours,
        defaultScrapAllowancePercent: form.defaultScrapAllowancePercent,
        defaultMarginSquareMetres: form.defaultMarginSquareMetres,
        materialScrapAllowances: form.materialScrapAllowances,
      });
      setMessage("ቅኑ ተስርሷል። በቀጣዩ የምርት መዝገብ ላይ ይተገበራል።");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ማስቀመጥ አልተቻለም።",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left Sidebar */}
      <div className="w-44 shrink-0 overflow-y-auto">
        <div className="sticky top-0 space-y-2">
          <div className="space-y-1">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Configuration Sections
            </p>
            <nav className="space-y-0.5">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{section.label}</div>
                      <div className="truncate text-[10px] opacity-70">{section.amharic}</div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="space-y-6">
          <OwnerPageHeader
            kicker="Operational Configuration · የሥራ ማስተካከያ"
            title={SECTIONS.find((s) => s.id === activeSection)?.label || "Configuration"}
            subtitle="Set the operational rules that govern your business processes."
          />

          {activeSection === "catalogs" ? (
            <DatabaseCatalogSuite />
          ) : (
            <form onSubmit={save} className="space-y-6">
              <div className="rounded-xl border border-border bg-card divide-y divide-border">
                {activeSection === "orders" && (
                  <OrderExpirySection
                    orderExpirationHours={form.orderExpirationHours}
                    setOrderExpirationHours={form.setOrderExpirationHours}
                  />
                )}

                {activeSection === "security" && (
                  <RiskSection
                    requireAdminPinForExceptions={form.requireAdminPinForExceptions}
                    setRequireAdminPinForExceptions={form.setRequireAdminPinForExceptions}
                    maxDirectStockOutEtb={form.maxDirectStockOutEtb}
                    setMaxDirectStockOutEtb={form.setMaxDirectStockOutEtb}
                  />
                )}

              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-5 py-4">
                <p className="text-[11px] text-muted-foreground">
                  የባለቤት ብቻ ማስተካከያ · በቀጣዩ የምርት መዝገብ ላይ ይተገበራል።
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {message ? (
                    <FormMessage tone={message.includes("Unable") || message.includes("አልተቻለም") ? "error" : "success"}>{message}</FormMessage>
                  ) : null}
                  <Button variant="primary" type="submit" disabled={busy}>
                    <Save size={15} />
                    {busy ? "በመቀመጥ ላይ…" : "ማስቀመጥ"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
