"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Save } from "lucide-react";
import { Button } from "@/components/shared/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/shared/ui/tabs";
import { FormMessage } from "../chrome/form";
import { ConversionSection } from "./sections/conversion-section";
import { OrderExpirySection } from "./sections/order-expiry-section";
import { OverrideSection, type MaterialOption } from "./sections/override-section";
import { ProductionSection } from "./sections/production-section";
import { RiskSection } from "./sections/risk-section";
import { ScrapAllowanceSection } from "./sections/scrap-allowance-section";
import { ValuationSection } from "./sections/valuation-section";
import { useOperationalConfigState } from "./state";

/**
 * Owner-only Operational Configuration view:
 * composes the seven per-domain sections into four categorized tabs
 * and persists changes to the `systemConfigs.updateSystemConfig` mutation.
 */
export function OperationalPanel() {
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
      <div className="rounded-xl border border-border bg-card p-10 text-center">
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
    <Tabs defaultValue="pricing" className="space-y-4">
      <TabsList>
        <TabsTrigger value="pricing">
          <span className="text-sm font-semibold">የዋጋ እና ሂሳብ ተመኖች</span>
        </TabsTrigger>
        <TabsTrigger value="production">
          <span className="text-sm font-semibold">የምርት እና ብክነት ህጎች</span>
        </TabsTrigger>
        <TabsTrigger value="orders">
          <span className="text-sm font-semibold">የትዕዛዝ አስተዳደር</span>
        </TabsTrigger>
        <TabsTrigger value="security">
          <span className="text-sm font-semibold">የደህንነት እና ቁጥጥር ህጎች</span>
        </TabsTrigger>
      </TabsList>

      <form
        onSubmit={save}
        className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card"
      >
        {/* Tab 1: Pricing & Valuation */}
        <TabsContent value="pricing">
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

          <ConversionSection
            rules={form.unitConversionDefaults}
            setRules={form.setUnitConversionDefaults}
          />
        </TabsContent>

        {/* Tab 2: Production & Waste Rules */}
        <TabsContent value="production">
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
        </TabsContent>

        {/* Tab 3: Order Management */}
        <TabsContent value="orders">
          <OrderExpirySection
            orderExpirationHours={form.orderExpirationHours}
            setOrderExpirationHours={form.setOrderExpirationHours}
          />
        </TabsContent>

        {/* Tab 4: Security & Audit */}
        <TabsContent value="security">
          <RiskSection
            requireAdminPinForExceptions={form.requireAdminPinForExceptions}
            setRequireAdminPinForExceptions={form.setRequireAdminPinForExceptions}
            maxDirectStockOutEtb={form.maxDirectStockOutEtb}
            setMaxDirectStockOutEtb={form.setMaxDirectStockOutEtb}
          />
        </TabsContent>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-secondary/40 px-5 py-4 sm:px-6">
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
    </Tabs>
  );
}
