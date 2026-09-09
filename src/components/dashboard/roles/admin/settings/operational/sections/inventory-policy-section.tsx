"use client";

import { BellRing, Boxes } from "lucide-react";
import { FormSection } from "../../chrome/form";
import { NumericField } from "../../chrome/numeric-field";

export function InventoryPolicySection({
  defaultReorderLevel,
  setDefaultReorderLevel,
  reorderAlertsEnabled,
  setReorderAlertsEnabled,
  reorderAlertCooldownHours,
  setReorderAlertCooldownHours,
}: {
  defaultReorderLevel: number;
  setDefaultReorderLevel: (value: number) => void;
  reorderAlertsEnabled: boolean;
  setReorderAlertsEnabled: (value: boolean) => void;
  reorderAlertCooldownHours: number;
  setReorderAlertCooldownHours: (value: number) => void;
}) {
  return (
    <FormSection
      icon={<Boxes size={17} />}
      tone="cyan"
      title="Inventory control"
      note="Reorder levels remain material-specific because each material uses its own unit."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NumericField
          label="Default Reorder Level"
          value={defaultReorderLevel}
          onChange={setDefaultReorderLevel}
          suffix="base units"
          min={0}
          step="0.01"
          hint="Used only when creating a new material; existing levels are not overwritten."
        />
        <NumericField
          label="Alert Cooldown"
          value={reorderAlertCooldownHours}
          onChange={setReorderAlertCooldownHours}
          suffix="hours"
          min={0}
          max={168}
          step="1"
          hint="Minimum time before the same low-stock condition can notify again."
        />
        <label className="flex items-center gap-3 rounded-lg border border-border bg-background/50 px-3 py-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={reorderAlertsEnabled}
            onChange={(event) => setReorderAlertsEnabled(event.target.checked)}
            className="h-4 w-4 accent-cyan-600"
          />
          <span>
            <span className="block font-semibold">Low-stock alerts enabled</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">Dashboards still calculate low stock when alerts are disabled.</span>
          </span>
        </label>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-lg border border-cyan/20 bg-cyan/5 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
        <BellRing size={14} className="mt-0.5 shrink-0 text-cyan-700" />
        <span>Manage each material&apos;s actual reorder level from the material catalog. Machine operators see the same policy converted to their floor-stock unit.</span>
      </div>
    </FormSection>
  );
}
