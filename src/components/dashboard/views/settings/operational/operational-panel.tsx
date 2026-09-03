"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Save } from "lucide-react";
import { Button } from "@/components/ui";
import { FormMessage } from "../chrome/form";
import { ConversionSection } from "./sections/conversion-section";
import { OrderExpirySection } from "./sections/order-expiry-section";
import { OverrideSection, type MaterialOption } from "./sections/override-section";
import { ProductionSection } from "./sections/production-section";
import { RiskSection } from "./sections/risk-section";
import { ValuationSection } from "./sections/valuation-section";
import { useOperationalConfigState } from "./state";

/**
 * Owner-only Operational Configuration view:
 * composes the six per-domain sections and persists changes to the
 * `systemConfigs.updateSystemConfig` mutation.
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
      <div className="rounded-xl border border-line bg-white p-10 text-center shadow-sm">
        <p className="text-xs text-gray-500">Loading configuration…</p>
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
        requireAdminPinForExceptions: form.requireAdminPinForExceptions,
        maxDirectStockOutEtb: form.maxDirectStockOutEtb,
        orderExpirationHours: form.orderExpirationHours,
      });
      setMessage(
        "Operational configuration saved. Production & valuation will use the new rates on the next record.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save operational configuration.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm"
    >
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

      <ConversionSection
        rules={form.unitConversionDefaults}
        setRules={form.setUnitConversionDefaults}
      />

      <OverrideSection
        overrides={form.overrides}
        setOverrides={form.setOverrides}
        materials={materials}
        onMessage={setMessage}
      />

      <ProductionSection
        inkMlPerSquareMetre={form.inkMlPerSquareMetre}
        setInkMlPerSquareMetre={form.setInkMlPerSquareMetre}
        maxAllowedWastePercent={form.maxAllowedWastePercent}
        setMaxAllowedWastePercent={form.setMaxAllowedWastePercent}
        minOffcutAreaSquareMetre={form.minOffcutAreaSquareMetre}
        setMinOffcutAreaSquareMetre={form.setMinOffcutAreaSquareMetre}
      />

      <OrderExpirySection
        orderExpirationHours={form.orderExpirationHours}
        setOrderExpirationHours={form.setOrderExpirationHours}
      />

      <RiskSection
        requireAdminPinForExceptions={form.requireAdminPinForExceptions}
        setRequireAdminPinForExceptions={form.setRequireAdminPinForExceptions}
        maxDirectStockOutEtb={form.maxDirectStockOutEtb}
        setMaxDirectStockOutEtb={form.setMaxDirectStockOutEtb}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50/70 px-5 py-4 sm:px-6">
        <p className="text-[11px] text-gray-500">
          Owner-only configuration · applied transactionally on the next production record.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {message ? (
            <FormMessage tone={message.includes("Unable") ? "error" : "success"}>{message}</FormMessage>
          ) : null}
          <Button variant="primary" type="submit" disabled={busy}>
            <Save size={15} />
            {busy ? "Saving…" : "Save operational configuration"}
          </Button>
        </div>
      </div>
    </form>
  );
}
