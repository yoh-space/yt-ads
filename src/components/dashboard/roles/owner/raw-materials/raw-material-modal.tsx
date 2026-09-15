"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { ModalShell } from "@/components/dashboard/modals/modal-shell";
import { Button, Input, Select } from "@/components/shared/ui";
import { Save, Layers, Droplet, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

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
  inkColor?: string;
  materialFamily?: string;
  maxScrap?: number;
  minOffcutWidth?: number;
  minOffcutLength?: number;
  wasteLimitPolicy?: "warn" | "block";
  active: boolean;
};

export const INK_COLORS = [
  { value: "CYAN", label: "Blue (Cyan)", bg: "bg-cyan-500", border: "border-cyan-500" },
  { value: "MAGENTA", label: "Red (Magenta)", bg: "bg-pink-500", border: "border-pink-500" },
  { value: "YELLOW", label: "Yellow", bg: "bg-yellow-400", border: "border-yellow-400" },
  { value: "BLACK", label: "Black", bg: "bg-neutral-900", border: "border-neutral-700" },
  { value: "WHITE", label: "White", bg: "bg-white", border: "border-neutral-300" },
] as const;

const CATEGORY_FAMILIES = [
  { value: "ROLL", label: "Roll (Banner, Vinyl, Sticker, Canvas, Mesh)" },
  { value: "RIGID_SHEET", label: "Rigid Sheet (Foam Board, Mica, Acrylic, Cladding, MDF)" },
  { value: "INK_SOLVENT", label: "Ink & Solvent (Solvent, Eco-Solvent, UV, DTF, Cleaner)" },
  { value: "BARS", label: "Bars & Profiles (Aluminum Extrusion, Neon Flex, Rods)" },
  { value: "PACKAGES", label: "Packages & Hardware (Roll-Up Stands, Fasteners, LEDs, T-Shirts)" },
  { value: "HARDWARE", label: "General Hardware & Auxiliary Parts" },
] as const;

export const CATEGORY_OPTIONS_BY_FAMILY: Record<string, string[]> = {
  ROLL: ["Banner", "Sticker roll", "Mesh", "Canvas", "Film"],
  RIGID_SHEET: ["Foam board", "Mica sheet", "Acrylic", "Cladding"],
  INK_SOLVENT: ["Ink", "Solvent", "Cleaner"],
  BARS: ["Aluminum Extrusion", "Neon Flex", "Profile Frame"],
  PACKAGES: ["Roll-Up Stand", "Display hardware", "Fasteners"],
  HARDWARE: ["Hardware", "Fasteners", "Mounting Brackets", "Power Supply", "LED Module"],
};

const BASE_UNITS = [
  { value: "m²", label: "m² (Square Metres - Area)" },
  { value: "m", label: "m (Linear Metres - Length)" },
  { value: "sheet", label: "sheet (Rigid Sheets)" },
  { value: "pcs", label: "pcs (Pieces)" },
  { value: "piece", label: "piece (Units)" },
  { value: "L", label: "L (Litres)" },
  { value: "mL", label: "mL (Millilitres)" },
] as const;

const PURCHASE_UNITS = [
  { value: "roll", label: "roll" },
  { value: "sheet", label: "sheet" },
  { value: "canister", label: "canister (Bottle)" },
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

  const [catalogFamily, setCatalogFamily] = useState(material?.catalogFamily ?? "ROLL");
  const [category, setCategory] = useState(material?.category ?? "Banner");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [name, setName] = useState(material?.name ?? "");
  const [unit, setUnit] = useState(material?.unit ?? "m²");
  const [purchaseUnit, setPurchaseUnit] = useState(material?.purchaseUnit ?? "roll");
  const [conversionRatio, setConversionRatio] = useState(material?.conversionRatio?.toString() ?? "50");
  const [rollWidth, setRollWidth] = useState(material?.rollWidth?.toString() ?? "3.2");
  const [rollLength, setRollLength] = useState("50");
  const [sheetWidth, setSheetWidth] = useState(material?.sheetWidth?.toString() ?? "");
  const [sheetLength, setSheetLength] = useState(material?.sheetLength?.toString() ?? "");
  const [thickness, setThickness] = useState(material?.thickness?.toString() ?? "");
  const [reorderAt, setReorderAt] = useState(material?.reorderAt?.toString() ?? "5");
  const [storageLocation, setStorageLocation] = useState(material?.storageLocation ?? "Central store");
  const [averageUse, setAverageUse] = useState(material?.averageUse ?? "");
  const [inkColor, setInkColor] = useState(material?.inkColor ?? "CYAN");
  const [maxScrap, setMaxScrap] = useState(material?.maxScrap?.toString() ?? "");
  const [minOffcutWidth, setMinOffcutWidth] = useState(material?.minOffcutWidth?.toString() ?? "");
  const [minOffcutLength, setMinOffcutLength] = useState(material?.minOffcutLength?.toString() ?? "");
  const [wasteLimitPolicy, setWasteLimitPolicy] = useState<"warn" | "block">(
    material?.wasteLimitPolicy ?? "warn"
  );
  const [active, setActive] = useState(material?.active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available categories for the currently selected family
  const availableCategories = CATEGORY_OPTIONS_BY_FAMILY[catalogFamily] ?? [];
  const isAreaMaterial = catalogFamily === "ROLL" || catalogFamily === "RIGID_SHEET";

  // If editing an item with a category not in the pre-defined list, handle custom
  useEffect(() => {
    if (material && !availableCategories.includes(material.category)) {
      setIsCustomCategory(true);
    }
  }, [material, availableCategories]);

  // Auto-calculate Conversion Ratio (Roll Width × Standard Roll Length) for ROLL family
  useEffect(() => {
    if (catalogFamily !== "ROLL") return;
    const width = parseFloat(rollWidth);
    const length = parseFloat(rollLength);
    if (Number.isFinite(width) && Number.isFinite(length) && width > 0 && length > 0) {
      setConversionRatio(String(Math.round(width * length * 10) / 10));
    }
  }, [catalogFamily, rollWidth, rollLength]);

  // When catalogFamily changes in create mode, automatically auto-fill corresponding category & units
  function handleFamilyChange(newFamily: string) {
    setCatalogFamily(newFamily);
    setIsCustomCategory(false);

    const familyCategories = CATEGORY_OPTIONS_BY_FAMILY[newFamily] ?? [];
    if (familyCategories.length > 0) {
      setCategory(familyCategories[0]);
    }

    if (newFamily === "ROLL") {
      setUnit("m²");
      setPurchaseUnit("roll");
      setRollWidth("3.2");
      setRollLength("50");
      setConversionRatio("160");
    } else if (newFamily === "RIGID_SHEET") {
      setUnit("m²");
      setPurchaseUnit("sheet");
      setConversionRatio("2.98");
      setSheetWidth("1.22");
      setSheetLength("2.44");
      setThickness("3");
    } else if (newFamily === "INK_SOLVENT") {
      setUnit("L");
      setPurchaseUnit("canister");
      setConversionRatio("5");
    } else if (newFamily === "BARS") {
      setUnit("m");
      setPurchaseUnit("piece");
      setConversionRatio("6");
    } else if (newFamily === "PACKAGES" || newFamily === "HARDWARE") {
      setUnit("pcs");
      setPurchaseUnit("piece");
      setConversionRatio("1");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a material name.");
      return;
    }
    if (!category.trim()) {
      toast.error("Please select or enter a material category.");
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
    const maxScrapVal = maxScrap.trim() === "" ? undefined : parseFloat(maxScrap);
    if (maxScrapVal !== undefined && (isNaN(maxScrapVal) || maxScrapVal < 0)) {
      toast.error("Max scrap must be zero or greater.");
      return;
    }
    const isAreaMaterial = catalogFamily === "ROLL" || catalogFamily === "RIGID_SHEET";
    const minWidthVal = minOffcutWidth.trim() === "" ? undefined : parseFloat(minOffcutWidth);
    const minLengthVal = minOffcutLength.trim() === "" ? undefined : parseFloat(minOffcutLength);
    if (minWidthVal !== undefined && (isNaN(minWidthVal) || minWidthVal <= 0)) {
      toast.error("Minimum offcut width must be greater than zero.");
      return;
    }
    if (minLengthVal !== undefined && (isNaN(minLengthVal) || minLengthVal <= 0)) {
      toast.error("Minimum offcut length must be greater than zero.");
      return;
    }
    const wastePayload = {
      maxScrap: maxScrapVal,
      minOffcutWidth: isAreaMaterial ? minWidthVal : undefined,
      minOffcutLength: isAreaMaterial ? minLengthVal : undefined,
      wasteLimitPolicy,
    };

    setIsSubmitting(true);
    const isInkMaterial = catalogFamily === "INK_SOLVENT" || category.toLowerCase().includes("ink");
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
          inkColor: isInkMaterial ? inkColor : undefined,
          reorderAt: reorderNum,
          storageLocation: storageLocation.trim() || undefined,
          averageUse: averageUse.trim() || undefined,
          active,
          ...wastePayload,
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
          inkColor: isInkMaterial ? inkColor : undefined,
          reorderAt: reorderNum,
          storageLocation: storageLocation.trim() || undefined,
          averageUse: averageUse.trim() || undefined,
          ...wastePayload,
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
          : "Define a canonical raw material blueprint with streamlined category and form-factor controls."
      }
      kicker="RAW MATERIAL BLUEPRINT · ነጠላ የመረጃ ምንጭ"
      onClose={onClose}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* 1. Category Family (Selected First) */}
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Layers size={13} className="text-cyan-dark" />
            Category Family *
          </label>
          <Select
            value={catalogFamily}
            onChange={(e) => handleFamilyChange(e.target.value)}
            className="w-full bg-background"
          >
            {CATEGORY_FAMILIES.map((fam) => (
              <option key={fam.value} value={fam.value}>
                {fam.label}
              </option>
            ))}
          </Select>
        </div>

        {/* 2. Core details: Category Dropdown (Filtered) + Material Name */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Smart Category Dropdown */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Category *
              </label>
              {!isCustomCategory ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCategory(true);
                    setCategory("");
                  }}
                  className="text-[11px] font-medium text-cyan-dark hover:underline"
                >
                  + Custom Category
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomCategory(false);
                    setCategory(availableCategories[0] || "Banner");
                  }}
                  className="text-[11px] font-medium text-cyan-dark hover:underline"
                >
                  Back to list
                </button>
              )}
            </div>

            {isCustomCategory ? (
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Enter custom category name"
                required
                autoFocus
              />
            ) : (
              <Select
                value={category}
                onChange={(e) => {
                  if (e.target.value === "__CUSTOM__") {
                    setIsCustomCategory(true);
                    setCategory("");
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full bg-background"
                required
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="__CUSTOM__">+ Enter Custom Category…</option>
              </Select>
            )}
          </div>

          {/* Material Name */}
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
                <label className="mb-1 block text-xs text-muted-foreground">Standard Roll Length (m)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={rollLength}
                  onChange={(e) => setRollLength(e.target.value)}
                  placeholder="50"
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

        {/* Ink Color Selector (for INK_SOLVENT family or Ink category) */}
        {(catalogFamily === "INK_SOLVENT" || category.toLowerCase().includes("ink")) && (
          <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Droplet size={13} className="text-cyan-500" />
                Ink Color Channel *
              </label>
              <span className="text-[10px] text-muted-foreground">Each color is an independent raw material</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {INK_COLORS.map((c) => {
                const isSelected = inkColor === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      setInkColor(c.value);
                      if (!isEditing && name.trim()) {
                        const cleanName = name.replace(/\s*-\s*(Cyan|Magenta|Yellow|Black|White|Blue|Red)/gi, "").trim();
                        setName(`${cleanName} - ${c.value.charAt(0) + c.value.slice(1).toLowerCase()}`);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2 text-xs font-medium transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                        : "border-border bg-background text-muted-foreground hover:bg-secondary/40"
                    )}
                  >
                    <span className={cn("h-3.5 w-3.5 rounded-full border", c.bg, c.border)} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Waste & Offcut limits — family-aware bounds set by the owner */}
        <div className="rounded-lg border border-border/70 bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Scissors size={13} className="text-cyan-500" />
              Waste Limits
            </label>
            <span className="text-[10px] text-muted-foreground">Bounded operator scrap / offcut logging</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Max Scrap ({unit})
                {catalogFamily === "ROLL" && (
                  <span className="text-[10px]"> (e.g. ≈ 1.00 × 2.00 m piece)</span>
                )}
              </label>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={maxScrap}
                onChange={(e) => setMaxScrap(e.target.value)}
                placeholder={catalogFamily === "INK_SOLVENT" ? "e.g. 250" : "e.g. 2"}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Unconfigured Policy</label>
              <Select value={wasteLimitPolicy} onChange={(e) => setWasteLimitPolicy(e.target.value as "warn" | "block")} className="w-full bg-background">
                <option value="warn">Warn (let operators log freely)</option>
                <option value="block">Block (require limits before logging)</option>
              </Select>
            </div>
          </div>

          {isAreaMaterial && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Min Offcut Width (m)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={minOffcutWidth}
                  onChange={(e) => setMinOffcutWidth(e.target.value)}
                  placeholder="0.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Min Offcut Length (m)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={minOffcutLength}
                  onChange={(e) => setMinOffcutLength(e.target.value)}
                  placeholder="0.5"
                />
              </div>
              {/* Live helper text */}
              {minOffcutWidth && minOffcutLength && (
                <p className="text-[11px] text-muted-foreground sm:col-span-2">
                  A leftover piece ≥ <span className="font-medium text-foreground">{minOffcutWidth} × {minOffcutLength} m</span> is a
                  usable offcut; anything smaller must be logged as scrap.
                  {wasteLimitPolicy === "block" && (
                    <span className="ml-1 text-amber-600">
                      While the offcut limits are empty and policy is “Block”, operators cannot log offcuts for this material.
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {wasteLimitPolicy === "block" && maxScrap.trim() === "" && (
            <p className="mt-3 text-[11px] text-amber-600">
              Policy is “Block” but the max scrap limit is empty — operators will be unable to log scrap for this material
              until it is set.
            </p>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            Max scrap applies to the total scrap logged for this material across the whole factory. “Warn” is the default:
            limits left empty are not enforced, and operators are nudged to ask the owner to configure them.
          </p>
        </div>

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
              onChange={(e) => {
                if (catalogFamily !== "ROLL") setConversionRatio(e.target.value);
              }}
              placeholder="e.g. 50"
              required
              readOnly={catalogFamily === "ROLL"}
              className={cn(catalogFamily === "ROLL" && "bg-secondary/40 cursor-not-allowed")}
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
