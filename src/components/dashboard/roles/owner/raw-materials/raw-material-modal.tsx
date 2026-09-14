"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { ModalShell } from "@/components/dashboard/modals/modal-shell";
import { Button, Input, Select } from "@/components/shared/ui";
import { Save, Layers } from "lucide-react";

export type RawMaterialItem = {
  _id: Id<"materials">;
  catalogMaterialId?: Id<"materialCatalog">;
  name: string;
  category: string;
  catalogFamily: string;
  unit: string;
  baseUnit: string;
  purchaseUnit: string;
  conversionRatio: number;
  quantity: number;
  parentStockQuantity: number;
  parentUnitType?: string;
  reorderAt: number;
  rollWidth?: number;
  sheetWidth?: number;
  sheetLength?: number;
  thickness?: number;
  storageLocation?: string;
  averageUse?: string;
  active: boolean;
};

const CATEGORY_FAMILIES = [
  { value: "ROLL", label: "Roll (Banner, Vinyl, Sticker, Canvas, Mesh)" },
  { value: "RIGID_SHEET", label: "Rigid Sheet (Foam Board, Mica, Acrylic, Cladding, MDF)" },
  { value: "INK_SOLVENT", label: "Ink & Solvent (Solvent, Eco-Solvent, UV, DTF, Cleaner)" },
  { value: "BARS", label: "Bars & Profiles (Aluminum Extrusion, Neon Flex, Rods)" },
  { value: "PACKAGES", label: "Packages & Hardware (Roll-Up Stands, Fasteners, LEDs, T-Shirts)" },
  { value: "HARDWARE", label: "General Hardware & Auxiliary Parts" },
] as const;

const BASE_UNITS = [
  { value: "m²", label: "m² (Square Metres - Area)" },
  { value: "m", label: "m (Linear Metres - Length)" },
  { value: "sheet", label: "sheet (Rigid Sheets)" },
  { value: "pcs", label: "pcs (Pieces / Count)" },
  { value: "piece", label: "piece (Units)" },
  { value: "L", label: "L (Litres - Liquid Volume)" },
  { value: "mL", label: "mL (Millilitres - Liquid Volume)" },
] as const;

const PURCHASE_UNITS = [
  { value: "roll", label: "roll (Full Rolls)" },
  { value: "sheet", label: "sheet (Full Sized Sheets)" },
  { value: "canister", label: "canister (Sealed Canister / Bottle)" },
  { value: "liter", label: "liter (Bulk Liquid Container)" },
  { value: "pack", label: "pack (Multi-item Pack)" },
  { value: "piece", label: "piece (Individual Wholesale Piece)" },
] as const;

interface RawMaterialModalProps {
  material: RawMaterialItem | null;
  onClose: () => void;
}

export function RawMaterialModal({ material, onClose }: RawMaterialModalProps) {
  const isEditing = Boolean(material);
  const createMaterial = useMutation(api.owner.materials.createRawMaterial);
  const updateMaterial = useMutation(api.owner.materials.updateRawMaterial);

  const [name, setName] = useState(material?.name ?? "");
  const [category, setCategory] = useState(material?.category ?? "");
  const [catalogFamily, setCatalogFamily] = useState(material?.catalogFamily ?? "ROLL");
  const [unit, setUnit] = useState(material?.unit ?? "m²");
  const [purchaseUnit, setPurchaseUnit] = useState(material?.purchaseUnit ?? "roll");
  const [conversionRatio, setConversionRatio] = useState(material?.conversionRatio?.toString() ?? "50");
  const [rollWidth, setRollWidth] = useState(material?.rollWidth?.toString() ?? "");
  const [sheetWidth, setSheetWidth] = useState(material?.sheetWidth?.toString() ?? "");
  const [sheetLength, setSheetLength] = useState(material?.sheetLength?.toString() ?? "");
  const [thickness, setThickness] = useState(material?.thickness?.toString() ?? "");
  const [reorderAt, setReorderAt] = useState(material?.reorderAt?.toString() ?? "5");
  const [storageLocation, setStorageLocation] = useState(material?.storageLocation ?? "Central store");
  const [averageUse, setAverageUse] = useState(material?.averageUse ?? "");
  const [active, setActive] = useState(material?.active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-adjust default units based on category family if creating new
  useEffect(() => {
    if (isEditing) return;
    if (catalogFamily === "ROLL") {
      setUnit("m²");
      setPurchaseUnit("roll");
      setConversionRatio("50");
      setRollWidth("3.2");
    } else if (catalogFamily === "RIGID_SHEET") {
      setUnit("m²");
      setPurchaseUnit("sheet");
      setConversionRatio("2.98");
      setSheetWidth("1.22");
      setSheetLength("2.44");
    } else if (catalogFamily === "INK_SOLVENT") {
      setUnit("L");
      setPurchaseUnit("canister");
      setConversionRatio("5");
    } else if (catalogFamily === "BARS") {
      setUnit("m");
      setPurchaseUnit("piece");
      setConversionRatio("6");
    } else if (catalogFamily === "PACKAGES" || catalogFamily === "HARDWARE") {
      setUnit("pcs");
      setPurchaseUnit("piece");
      setConversionRatio("1");
    }
  }, [catalogFamily, isEditing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a material name.");
      return;
    }
    if (!category.trim()) {
      toast.error("Please provide a material category.");
      return;
    }
    const ratioNum = parseFloat(conversionRatio);
    if (isNaN(ratioNum) || ratioNum <= 0) {
      toast.error("Conversion ratio must be a positive number.");
      return;
    }
    const reorderNum = parseFloat(reorderAt);
    if (isNaN(reorderNum) || reorderNum < 0) {
      toast.error("Reorder level must be zero or greater.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && material) {
        await updateMaterial({
          materialId: material._id,
          name: name.trim(),
          category: category.trim(),
          catalogFamily: catalogFamily as any,
          unit: unit as any,
          baseUnit: unit as any,
          purchaseUnit: purchaseUnit as any,
          conversionRatio: ratioNum,
          rollWidth: rollWidth ? parseFloat(rollWidth) : undefined,
          sheetWidth: sheetWidth ? parseFloat(sheetWidth) : undefined,
          sheetLength: sheetLength ? parseFloat(sheetLength) : undefined,
          thickness: thickness ? parseFloat(thickness) : undefined,
          reorderAt: reorderNum,
          storageLocation: storageLocation.trim() || undefined,
          averageUse: averageUse.trim() || undefined,
          active,
        });
        toast.success(`Updated "${name.trim()}" successfully.`);
      } else {
        await createMaterial({
          name: name.trim(),
          category: category.trim(),
          catalogFamily: catalogFamily as any,
          unit: unit as any,
          baseUnit: unit as any,
          purchaseUnit: purchaseUnit as any,
          conversionRatio: ratioNum,
          rollWidth: rollWidth ? parseFloat(rollWidth) : undefined,
          sheetWidth: sheetWidth ? parseFloat(sheetWidth) : undefined,
          sheetLength: sheetLength ? parseFloat(sheetLength) : undefined,
          thickness: thickness ? parseFloat(thickness) : undefined,
          reorderAt: reorderNum,
          storageLocation: storageLocation.trim() || undefined,
          averageUse: averageUse.trim() || undefined,
        });
        toast.success(`Created raw material "${name.trim()}" successfully.`);
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save raw material.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ModalShell
      title={isEditing ? "Edit Raw Material" : "New Raw Material Specification"}
      subtitle={
        isEditing
          ? "Update operational and blueprint attributes across the factory ledger."
          : "Define a canonical raw material blueprint used across inventory, orders, and production."
      }
      kicker="RAW MATERIAL BLUEPRINT · ነጠላ የመረጃ ምንጭ"
      onClose={onClose}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Core details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Material Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Banner Flex 440g, Mica Sheet 3mm"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category *
            </label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Banner, Sticker, Rigid Board, Ink, Hardware"
              required
            />
          </div>
        </div>

        {/* Category Family */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Layers size={13} className="text-cyan-dark" />
            Category Family (Single Source of Truth) *
          </label>
          <Select
            value={catalogFamily}
            onChange={(e) => setCatalogFamily(e.target.value)}
            className="w-full bg-background"
          >
            {CATEGORY_FAMILIES.map((fam) => (
              <option key={fam.value} value={fam.value}>
                {fam.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Dynamic Dimensions based on Category Family */}
        {catalogFamily === "ROLL" && (
          <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
            <h4 className="mb-2 text-xs font-semibold text-foreground">Roll Specifications</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Roll Width (metres)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={rollWidth}
                  onChange={(e) => setRollWidth(e.target.value)}
                  placeholder="3.2 or 1.6"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Standard Area Per Roll (m²)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={conversionRatio}
                  onChange={(e) => setConversionRatio(e.target.value)}
                  placeholder="e.g. 160"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {catalogFamily === "RIGID_SHEET" && (
          <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
            <h4 className="mb-2 text-xs font-semibold text-foreground">Sheet Specifications</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Width (m)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={sheetWidth}
                  onChange={(e) => setSheetWidth(e.target.value)}
                  placeholder="1.22"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Length (m)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={sheetLength}
                  onChange={(e) => setSheetLength(e.target.value)}
                  placeholder="2.44"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Thickness (mm)</label>
                <Input
                  type="number"
                  step="0.5"
                  value={thickness}
                  onChange={(e) => setThickness(e.target.value)}
                  placeholder="3 or 5"
                />
              </div>
            </div>
          </div>
        )}

        {/* Units and Packaging Conversion */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Production Unit (Base) *
            </label>
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full bg-background">
              {BASE_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Purchase Unit (Package) *
            </label>
            <Select
              value={purchaseUnit}
              onChange={(e) => setPurchaseUnit(e.target.value)}
              className="w-full bg-background"
            >
              {PURCHASE_UNITS.map((pu) => (
                <option key={pu.value} value={pu.value}>
                  {pu.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Conversion Ratio ({unit}/{purchaseUnit}) *
            </label>
            <Input
              type="number"
              step="0.001"
              value={conversionRatio}
              onChange={(e) => setConversionRatio(e.target.value)}
              placeholder="e.g. 50"
              required
            />
          </div>
        </div>

        {/* Reorder and storage */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reorder Warning Level ({purchaseUnit}s)
            </label>
            <Input
              type="number"
              min="0"
              value={reorderAt}
              onChange={(e) => setReorderAt(e.target.value)}
              placeholder="5"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Storage Bay / Location
            </label>
            <Input
              value={storageLocation}
              onChange={(e) => setStorageLocation(e.target.value)}
              placeholder="e.g. Central Warehouse Bay 3, Rack A"
            />
          </div>
        </div>

        {/* Status toggle for edit mode */}
        {isEditing && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/20 p-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Operational Status</p>
              <p className="text-[11px] text-muted-foreground">
                Active materials are available across reception orders, job dispatch, and store transfers.
              </p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-5 w-9 rounded-full bg-border after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-border after:bg-white after:transition-all after:content-[''] peer-checked:bg-cyan-dark peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting} className="flex items-center gap-2">
            <Save size={15} />
            {isSubmitting ? "Saving…" : isEditing ? "Save Changes" : "Create Material"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
