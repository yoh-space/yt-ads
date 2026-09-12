"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { Package, Factory, Clock, Shield, Calculator, DollarSign, Save, Database } from "lucide-react";
import { Button } from "@/components/shared/ui";
import { FormMessage } from "@/components/dashboard/roles/admin/settings/chrome/form";
import { ValuationSection } from "@/components/dashboard/roles/admin/settings/operational/sections/valuation-section";
import { ConversionSection } from "@/components/dashboard/roles/admin/settings/operational/sections/conversion-section";
import { OverrideSection, type MaterialOption } from "@/components/dashboard/roles/admin/settings/operational/sections/override-section";
import { ProductionSection } from "@/components/dashboard/roles/admin/settings/operational/sections/production-section";
import { ScrapAllowanceSection } from "@/components/dashboard/roles/admin/settings/operational/sections/scrap-allowance-section";
import { OrderExpirySection } from "@/components/dashboard/roles/admin/settings/operational/sections/order-expiry-section";
import { RiskSection } from "@/components/dashboard/roles/admin/settings/operational/sections/risk-section";
import { InventoryPolicySection } from "@/components/dashboard/roles/admin/settings/operational/sections/inventory-policy-section";
import { DatabaseCatalogSuite } from "@/components/dashboard/roles/owner/catalogs/database-catalog-suite";
import { useOperationalConfigState } from "@/components/dashboard/roles/admin/settings/operational/state";
import { useMemo } from "react";

type ConfigSection = "inventory" | "production" | "orders" | "security" | "conversion" | "valuation" | "catalogs";

const SECTIONS = [
  { id: "catalogs" as ConfigSection, label: "Master Catalogs", icon: Database, amharic: "ዳታቤዝ ካታሎግ" },
  { id: "inventory" as ConfigSection, label: "Inventory Control", icon: Package, amharic: "የእቃ ቁጥጥር" },
  { id: "production" as ConfigSection, label: "Production Rules", icon: Factory, amharic: "የምርት ህጎች" },
  { id: "orders" as ConfigSection, label: "Order Lifecycle", icon: Clock, amharic: "የትዕዛዝ ዘርፍ" },
  { id: "security" as ConfigSection, label: "Security Controls", icon: Shield, amharic: "የደህንነት ቁጥጥር" },
  { id: "conversion" as ConfigSection, label: "Unit Conversion", icon: Calculator, amharic: "የክፍል መቀየሪያ" },
  { id: "valuation" as ConfigSection, label: "Valuation & Finance", icon: DollarSign, amharic: "የዋጋ እና ፋይናንስ" },
];

export default function OwnerOperationalConfigurationPage() {
  const [activeSection, setActiveSection] = useState<ConfigSection>("inventory");
  const config = useQuery(api.systemConfigs.getSystemConfig);
  const state = useQuery(api.dashboard.getState, {});
  const updateSystemConfig = useMutation(api.systemConfigs.updateSystemConfig);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const form = useOperationalConfigState(config ?? undefined);

  const materials = useMemo<MaterialOption[]>(() => {
    if (!state) return [];
    return state.materials
      .map((material) => ({
        id: material._id,
        name: material.name,
        baseUnit: material.baseUnit ?? material.unit,
        unit: material.unit,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [state]);

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
      <div className="w-64 shrink-0 overflow-y-auto">
        <div className="sticky top-0 space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              Configuration Sections
            </p>
            <nav className="space-y-1">
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
                {activeSection === "inventory" && (
                  <InventoryPolicySection
                    defaultReorderLevel={form.defaultReorderLevel}
                    setDefaultReorderLevel={form.setDefaultReorderLevel}
                    reorderAlertsEnabled={form.reorderAlertsEnabled}
                    setReorderAlertsEnabled={form.setReorderAlertsEnabled}
                    reorderAlertCooldownHours={form.reorderAlertCooldownHours}
                    setReorderAlertCooldownHours={form.setReorderAlertCooldownHours}
                  />
                )}

                {activeSection === "production" && (
                  <>
                    <ProductionSection
                      inkMlPerSquareMetre={form.inkMlPerSquareMetre}
                      setInkMlPerSquareMetre={form.setInkMlPerSquareMetre}
                      maxAllowedWastePercent={form.maxAllowedWastePercent}
                      setMaxAllowedWastePercent={form.setMaxAllowedWastePercent}
                      minOffcutAreaSquareMetre={form.minOffcutAreaSquareMetre}
                      setMinOffcutAreaSquareMetre={form.setMinOffcutAreaSquareMetre}
                      standardWasteMargin={form.standardWasteMargin}
                      setStandardWasteMargin={form.setStandardWasteMargin}
                      maxAllowedScrapLimit={form.maxAllowedScrapLimit}
                      setMaxAllowedScrapLimit={form.setMaxAllowedScrapLimit}
                    />
                    <ScrapAllowanceSection
                      defaultScrapAllowancePercent={form.defaultScrapAllowancePercent}
                      setDefaultScrapAllowancePercent={form.setDefaultScrapAllowancePercent}
                      defaultMarginSquareMetres={form.defaultMarginSquareMetres}
                      setDefaultMarginSquareMetres={form.setDefaultMarginSquareMetres}
                      scrapAllowances={form.materialScrapAllowances}
                      setScrapAllowances={form.setMaterialScrapAllowances}
                      materials={materials}
                      onMessage={setMessage}
                    />
                  </>
                )}

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

                {activeSection === "conversion" && (
                  <ConversionSection
                    rules={form.unitConversionDefaults}
                    setRules={form.setUnitConversionDefaults}
                  />
                )}

                {activeSection === "valuation" && (
                  <>
                    <ValuationSection
                      etbPerSquareMetre={form.etbPerSquareMetre}
                      setEtbPerSquareMetre={form.setEtbPerSquareMetre}
                      etbPerLitre={form.etbPerLitre}
                      setEtbPerLitre={form.setEtbPerLitre}
                      etbPerPiece={form.etbPerPiece}
                      setEtbPerPiece={form.setEtbPerPiece}
                      etbPerMetre={form.etbPerMetre}
                      setEtbPerMetre={form.setEtbPerMetre}
                      etbPerSheet={form.etbPerSheet}
                      setEtbPerSheet={form.setEtbPerSheet}
                    />
                    <OverrideSection
                      overrides={form.overrides}
                      setOverrides={form.setOverrides}
                      materials={materials}
                      onMessage={setMessage}
                    />
                  </>
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
