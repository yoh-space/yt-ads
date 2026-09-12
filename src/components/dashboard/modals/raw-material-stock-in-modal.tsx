"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ArrowDownRight, ArrowUpRight, Check, ChevronLeft, Info, Package, Sparkles } from "lucide-react";
import { ModalShell } from "./modal-shell";
import { Button } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import type { InputUnit } from "@/lib/units";
import { convertToBase, formatQuantity } from "@/lib/units";
import type { Material } from "@/lib/operations-types";

function inputUnitsFor(material?: Material): InputUnit[] {
  if (!material) return [];
  return Array.from(new Set<InputUnit>([
    ...(material.purchaseUnit ? [material.purchaseUnit] : []),
    material.unit,
  ]));
}

type Step = "form" | "confirm";

export function RawMaterialStockInModal({ onClose }: { onClose: () => void }) {
  const rawMaterials = useQuery(api.materials.list, {});
  const materials = rawMaterials?.map((m) => ({ ...m, id: m._id })) ?? [];
  const recordMovement = useMutation(api.materials.recordStockMovement);

  const [step, setStep] = useState<Step>("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [materialId, setMaterialId] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("");
  const [inputUnit, setInputUnit] = useState<InputUnit>("m²");
  const [note, setNote] = useState("");

  const material = materials.find((m) => m.id === materialId);
  const inputUnits = inputUnitsFor(material);

  const quantityNum = Number(quantity);
  const converted = material
    ? (() => {
        try {
          return convertToBase(
            quantityNum,
            inputUnit,
            material.baseUnit ?? material.unit,
            material.conversionRatio,
            material.rollEquivalent,
            material.sheetEquivalent,
          );
        } catch {
          return 0;
        }
      })()
    : 0;

  const isValid = materialId && quantityNum > 0 && inputUnit;

  function handleProceed() {
    if (!isValid) return;
    setError(null);
    setStep("confirm");
  }

  async function handleConfirm() {
    if (!isValid || !material) return;
    setSaving(true);
    setError(null);
    try {
      await recordMovement({
        materialId: materialId as Id<"materials">,
        direction,
        quantity: quantityNum,
        inputUnit,
        note: note || `Stock ${direction} by storekeeper`,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record stock movement");
      setStep("form");
    } finally {
      setSaving(false);
    }
  }

  if (rawMaterials === undefined) {
    return (
      <ModalShell title="Stock Movement" subtitle="Loading materials…" onClose={onClose}>
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={step === "form" ? "Record Stock Movement" : "Confirm Stock Movement"}
      subtitle={step === "form" ? "Add or remove raw material stock from the main store." : "Review details before saving"}
      kicker={step === "confirm" ? "CONFIRMATION" : undefined}
      step={step === "form" ? 1 : 2}
      onClose={onClose}
      footer={
        step === "form" ? (
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="tertiary" onClick={onClose}>Cancel</Button>
            <Button type="button" variant="primary" disabled={!isValid} onClick={handleProceed}>
              Review & Confirm <ArrowDownRight size={16} />
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="tertiary" onClick={() => setStep("form")} disabled={saving}>
              <ChevronLeft size={14} /> Back
            </Button>
            <Button type="button" variant="primary" onClick={handleConfirm} disabled={saving}>
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving…
                </>
              ) : (
                <>
                  <Check size={16} /> Confirm & Save
                </>
              )}
            </Button>
          </div>
        )
      }
    >
      {step === "form" ? (
        <div className="space-y-6">
          {/* Direction Toggle */}
          <div className="flex gap-3 p-3 bg-muted/30 border border-border rounded-lg">
            <button
              type="button"
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors",
                direction === "in"
                  ? "bg-green text-white shadow-sm"
                  : "bg-background text-muted-foreground border border-border hover:bg-muted/50"
              )}
              onClick={() => setDirection("in")}
            >
              <ArrowDownRight size={18} />
              Stock In
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors",
                direction === "out"
                  ? "bg-destructive text-white shadow-sm"
                  : "bg-background text-muted-foreground border border-border hover:bg-muted/50"
              )}
              onClick={() => setDirection("out")}
            >
              <ArrowUpRight size={18} />
              Stock Out
            </button>
          </div>

          {/* Material */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">Material *</label>
            <select
              value={materialId}
              onChange={(e) => {
                const next = materials.find((m) => m.id === e.target.value);
                setMaterialId(e.target.value);
                setInputUnit((next?.purchaseUnit ?? next?.unit ?? "m²") as InputUnit);
              }}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">Select material…</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.category})</option>
              ))}
            </select>
            {material?.specification && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {material.specification}{material.specificationValue ? `: ${material.specificationValue}` : ""}
              </p>
            )}
          </div>

          {/* Quantity + Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">Quantity *</label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.000"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">Entry Unit *</label>
              <select
                value={inputUnit}
                onChange={(e) => setInputUnit(e.target.value as InputUnit)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              >
                {inputUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Conversion Preview */}
          {material && quantityNum > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Sparkles size={16} className="text-primary flex-none" />
              <span className="text-sm text-muted-foreground">Base quantity</span>
              <span className="font-semibold text-foreground ml-auto">
                {formatQuantity(converted, material.baseUnit ?? material.unit)}
              </span>
            </div>
          )}

          {material?.conversionRatio ? (
            <p className="text-[11px] text-muted-foreground">
              1 {material.purchaseUnit ?? "unit"} = {material.conversionRatio} {material.baseUnit ?? material.unit}
            </p>
          ) : null}

          {/* Note */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2">Reference Note</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Supplier name, invoice #, or reason"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
      ) : (
        /* Confirmation Step */
        <div className="space-y-5">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="text-primary" />
              <span className="text-xs font-semibold text-foreground">Please verify the following details before saving:</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">Direction</span>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                  direction === "in"
                    ? "bg-green/10 text-green border border-green/30"
                    : "bg-destructive/10 text-destructive border border-destructive/30"
                )}>
                  {direction === "in" ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                  Stock {direction === "in" ? "In" : "Out"}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">Material</span>
                <span className="text-sm font-semibold text-foreground">{material?.name}</span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">Quantity</span>
                <span className="text-sm font-semibold text-foreground">
                  {quantityNum} {inputUnit}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs text-muted-foreground">Base Quantity</span>
                <span className="text-sm font-bold text-primary">
                  {formatQuantity(converted, material?.baseUnit ?? material?.unit ?? "m²")}
                </span>
              </div>

              {note && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Note</span>
                  <span className="text-xs text-foreground max-w-[200px] truncate">{note}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <Package size={16} className="text-amber-500 mt-0.5 flex-none" />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              This action will {direction === "in" ? "increase" : "decrease"} the main store stock for <strong>{material?.name}</strong> by <strong>{formatQuantity(converted, material?.baseUnit ?? material?.unit ?? "m²")}</strong>. This cannot be undone.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
