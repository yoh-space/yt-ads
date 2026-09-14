"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  Filter,
  Layers,
  Package,
  Search,
  Sparkles,
  Tag,
  Warehouse,
  X,
} from "lucide-react";
import { ModalShell } from "./modal-shell";
import { Button } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import type { InputUnit } from "@/lib/units";
import { convertToBase, formatQuantity } from "@/lib/units";
import type { Unit } from "@/lib/operations-types";

type Step = "form" | "confirm";
type CategoryFamilyFilter = "ALL" | "ROLL" | "RIGID_SHEET" | "INK_SOLVENT" | "HARDWARE";

const INK_COLOR_SWATCHES: Record<string, { bg: string; border: string; label: string; text: string }> = {
  CYAN: { bg: "bg-[#00A3E0]", border: "border-[#0082B4]", label: "Cyan", text: "text-white" },
  MAGENTA: { bg: "bg-[#EC008C]", border: "border-[#B8006E]", label: "Magenta", text: "text-white" },
  YELLOW: { bg: "bg-[#FFEF00]", border: "border-[#D4C700]", label: "Yellow", text: "text-black" },
  BLACK: { bg: "bg-[#111111]", border: "border-slate-600", label: "Black", text: "text-white" },
  WHITE: { bg: "bg-[#FFFFFF]", border: "border-slate-300", label: "White", text: "text-black" },
  LIGHT_CYAN: { bg: "bg-[#80D1F0]", border: "border-[#00A3E0]", label: "Lt Cyan", text: "text-black" },
  LIGHT_MAGENTA: { bg: "bg-[#F680C5]", border: "border-[#EC008C]", label: "Lt Magenta", text: "text-black" },
  FLUSH: { bg: "bg-slate-300", border: "border-slate-400", label: "Flush / Solvent", text: "text-slate-800" },
};

function getMaterialFamily(m: any): "ROLL" | "RIGID_SHEET" | "INK_SOLVENT" | "HARDWARE" | "OTHER" {
  if (m.catalogFamily) {
    if (m.catalogFamily === "ROLL") return "ROLL";
    if (m.catalogFamily === "RIGID_SHEET" || m.catalogFamily === "BARS") return "RIGID_SHEET";
    if (m.catalogFamily === "INK_SOLVENT") return "INK_SOLVENT";
    if (
      m.catalogFamily === "HARDWARE" ||
      m.catalogFamily === "SIGNAGE_FRAME_PROFILE" ||
      m.catalogFamily === "ILLUMINATED_DISPLAY_SYSTEM" ||
      m.catalogFamily === "PACKAGES"
    ) {
      return "HARDWARE";
    }
  }
  if (
    m.materialFamily === "INK" ||
    m.materialFamily === "SOLVENT" ||
    m.category?.toLowerCase().includes("ink") ||
    m.isSolvent
  ) {
    return "INK_SOLVENT";
  }
  if (
    m.category?.toLowerCase().includes("roll") ||
    m.category?.toLowerCase().includes("banner") ||
    m.category?.toLowerCase().includes("sticker") ||
    m.category?.toLowerCase().includes("vinyl") ||
    m.purchaseUnit === "roll"
  ) {
    return "ROLL";
  }
  if (
    m.category?.toLowerCase().includes("sheet") ||
    m.category?.toLowerCase().includes("acrylic") ||
    m.category?.toLowerCase().includes("board") ||
    m.purchaseUnit === "sheet"
  ) {
    return "RIGID_SHEET";
  }
  if (
    m.materialFamily === "HARDWARE" ||
    m.category?.toLowerCase().includes("hardware") ||
    m.category?.toLowerCase().includes("accessor")
  ) {
    return "HARDWARE";
  }
  return "OTHER";
}

function getAvailableInputUnits(material?: any): Array<{ value: InputUnit; label: string }> {
  if (!material) return [{ value: "m²" as InputUnit, label: "m²" }];
  const fam = getMaterialFamily(material);
  const units: Array<{ value: InputUnit; label: string }> = [];

  if (fam === "ROLL" || material.purchaseUnit === "roll") {
    units.push({
      value: "roll" as InputUnit,
      label: `ሮል (Rolls)${material.conversionRatio ? ` · 1 roll = ${material.conversionRatio} ${material.baseUnit ?? material.unit}` : ""}`,
    });
    units.push({
      value: (material.baseUnit ?? material.unit ?? "m²") as InputUnit,
      label: `${material.baseUnit ?? material.unit ?? "m²"} (ስፋት / Base unit)`,
    });
    if (material.unit === "m" || material.baseUnit === "m") {
      units.push({ value: "m" as InputUnit, label: "m (Linear meters)" });
    }
  } else if (fam === "RIGID_SHEET" || material.purchaseUnit === "sheet") {
    units.push({
      value: "sheet" as InputUnit,
      label: `ሺት (Sheets)${material.conversionRatio ? ` · 1 sheet = ${material.conversionRatio} ${material.baseUnit ?? material.unit}` : ""}`,
    });
    units.push({
      value: (material.baseUnit ?? material.unit ?? "m²") as InputUnit,
      label: `${material.baseUnit ?? material.unit ?? "m²"} (ስፋት / Base unit)`,
    });
    units.push({ value: "piece" as InputUnit, label: "piece / ፍሬ" });
  } else if (fam === "INK_SOLVENT") {
    units.push({
      value: (material.purchaseUnit ?? "canister") as InputUnit,
      label: `ካኒስተር (Canisters)${material.conversionRatio ? ` · 1 canister = ${material.conversionRatio} ${material.baseUnit ?? material.unit}` : ""}`,
    });
    units.push({
      value: (material.baseUnit ?? material.unit ?? "L") as InputUnit,
      label: `${material.baseUnit ?? material.unit ?? "L"} (ሊትር / Liters)`,
    });
  } else {
    if (material.purchaseUnit) {
      units.push({
        value: material.purchaseUnit as InputUnit,
        label: `${material.purchaseUnit}${material.conversionRatio ? ` · 1 = ${material.conversionRatio} ${material.baseUnit ?? material.unit}` : ""}`,
      });
    }
    units.push({
      value: (material.baseUnit ?? material.unit ?? "pcs") as InputUnit,
      label: `${material.baseUnit ?? material.unit ?? "pcs"}`,
    });
  }

  const seen = new Set<string>();
  return units.filter((u) => {
    if (seen.has(u.value)) return false;
    seen.add(u.value);
    return true;
  });
}

export function RawMaterialStockInModal({ onClose }: { onClose: () => void }) {
  const rawMaterials = useQuery(api.materials.list, {});
  const parentInventory = useQuery(api.inventory.listParentInventory, {});
  const recordMovement = useMutation(api.materials.recordStockMovement);

  const [step, setStep] = useState<Step>("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Material selection & category filters
  const [familyFilter, setFamilyFilter] = useState<CategoryFamilyFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [inkColorFilter, setInkColorFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [materialId, setMaterialId] = useState("");

  // Movement parameters
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("");
  const [inputUnit, setInputUnit] = useState<InputUnit>("roll");
  const [note, setNote] = useState("");

  const materials = useMemo(
    () => rawMaterials?.map((m) => ({ ...m, id: m._id })) ?? [],
    [rawMaterials]
  );

  const parentByMaterialId = useMemo(() => {
    const map = new Map<string, any>();
    if (parentInventory) {
      for (const item of parentInventory) {
        map.set(item.materialId, item);
      }
    }
    return map;
  }, [parentInventory]);

  // Unique categories for active family
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    for (const m of materials) {
      const fam = getMaterialFamily(m);
      if (familyFilter === "ALL" || fam === familyFilter) {
        if (m.category) set.add(m.category);
      }
    }
    return Array.from(set).sort();
  }, [materials, familyFilter]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return materials.filter((m) => {
      const fam = getMaterialFamily(m);
      const matchesFamily = familyFilter === "ALL" || fam === familyFilter;
      const matchesCategory = categoryFilter === "ALL" || m.category === categoryFilter;
      const matchesInkColor =
        inkColorFilter === "ALL" ||
        (m.inkColor && m.inkColor.toUpperCase() === inkColorFilter);

      const matchesSearch =
        !q ||
        [m.name, m.category, m.inkColor, m.specification, m.storageLocation]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      return matchesFamily && matchesCategory && matchesInkColor && matchesSearch;
    });
  }, [materials, familyFilter, categoryFilter, inkColorFilter, searchQuery]);

  const selectedMaterial = useMemo(
    () => materials.find((m) => m.id === materialId),
    [materials, materialId]
  );

  const availableInputUnits = useMemo(
    () => getAvailableInputUnits(selectedMaterial),
    [selectedMaterial]
  );

  const quantityNum = Number(quantity);
  const selectedBaseUnit = (selectedMaterial?.baseUnit ?? selectedMaterial?.unit ?? "m²") as Unit;

  const converted = selectedMaterial
    ? (() => {
        try {
          return convertToBase(
            quantityNum,
            inputUnit,
            selectedBaseUnit,
            selectedMaterial.conversionRatio,
            selectedMaterial.rollEquivalent,
            selectedMaterial.sheetEquivalent
          );
        } catch {
          return 0;
        }
      })()
    : 0;

  const availableBaseStock = selectedMaterial?.quantity ?? 0;
  const parentRecord = selectedMaterial ? parentByMaterialId.get(selectedMaterial.id) : undefined;
  const availablePackages = parentRecord?.totalStockQuantity ?? 0;
  const packageUnitLabel = parentRecord?.unitType ?? selectedMaterial?.packageUnit ?? "UNITS";

  // Balance validation for Stock Out
  const isStockOutExceeded = direction === "out" && quantityNum > 0 && converted > availableBaseStock;
  const isValid = materialId && quantityNum > 0 && inputUnit && !isStockOutExceeded;

  function handleMaterialSelect(mId: string) {
    setMaterialId(mId);
    const chosen = materials.find((m) => m.id === mId);
    if (chosen) {
      const units = getAvailableInputUnits(chosen);
      setInputUnit(units[0]?.value ?? ("m²" as InputUnit));
    }
  }

  function handleProceed() {
    if (!isValid) return;
    setError(null);
    setStep("confirm");
  }

  async function handleConfirm() {
    if (!isValid || !selectedMaterial) return;
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

  if (rawMaterials === undefined || parentInventory === undefined) {
    return (
      <ModalShell title="Stock Movement" subtitle="Loading materials and inventory ledger…" onClose={onClose}>
        <div className="flex items-center justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-700 border-t-[#00B4D8]" />
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title={step === "form" ? "የስቶክ እንቅስቃሴ ምዝገባ (Stock Movement)" : "እንቅስቃሴውን አረጋግጥ (Confirm Movement)"}
      subtitle={
        step === "form"
          ? "ከዋና ስቶክ ጥሬ እቃዎችን ያስገቡ ወይም ያውጡ። በምድብ እና ሮል አይነት ይምረጡ።"
          : "መረጃው ትክክል መሆኑን ከመመዝገብዎ በፊት ያረጋግጡ።"
      }
      kicker={step === "confirm" ? "CONFIRMATION" : "MAIN STORE LEDGER"}
      step={step === "form" ? 1 : 2}
      onClose={onClose}
      footer={
        step === "form" ? (
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="tertiary" onClick={onClose}>
              ይቅር (Cancel)
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!isValid}
              onClick={handleProceed}
              className="font-bold gap-2"
            >
              ቀጣይ: አረጋግጥ <ArrowDownRight size={16} />
            </Button>
          </div>
        ) : (
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="tertiary" onClick={() => setStep("form")} disabled={saving}>
              <ChevronLeft size={14} /> ተመለስ (Back)
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirm}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold gap-2"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  በመመዝገብ ላይ…
                </>
              ) : (
                <>
                  <Check size={16} /> መዝግብና አስቀምጥ (Save Movement)
                </>
              )}
            </Button>
          </div>
        )
      }
    >
      {step === "form" ? (
        <div className="space-y-5">
          {/* 1. Movement Direction Selector */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-900/80 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setDirection("in")}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all",
                direction === "in"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <ArrowDownRight size={16} />
              አዲስ እቃ ማስገቢያ (Stock In)
            </button>
            <button
              type="button"
              onClick={() => setDirection("out")}
              className={cn(
                "flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all",
                direction === "out"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <ArrowUpRight size={16} />
              እቃ ማውጫ (Stock Out)
            </button>
          </div>

          {/* 2. Category Family Tabs */}
          <div className="space-y-2">
            <label className="block text-[11px] font-mono uppercase text-slate-400 font-semibold">
              የእቃ ምድብ (Category Family) *
            </label>
            <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-slate-900/60 border border-slate-800">
              {(
                [
                  { key: "ALL", label: "ሁሉም (All)" },
                  { key: "ROLL", label: "ሮል ጥሬ እቃዎች (Rolls)" },
                  { key: "RIGID_SHEET", label: "ሺት እና ቦርድ (Sheets)" },
                  { key: "INK_SOLVENT", label: "ቀለም እና ሶልቨንት (Inks)" },
                  { key: "HARDWARE", label: "መለዋወጫ (Hardware)" },
                ] as Array<{ key: CategoryFamilyFilter; label: string }>
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setFamilyFilter(tab.key);
                    setCategoryFilter("ALL");
                    setInkColorFilter("ALL");
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                    familyFilter === tab.key
                      ? "bg-[#00B4D8] text-[#07131F]"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Subcategory & Ink Color Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category Dropdown */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-mono">ንዑስ ምድብ (Category)</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-[#00B4D8]"
              >
                <option value="ALL">ሁሉም ንዑስ ምድቦች (All Categories)</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Ink Color Filter (if INK_SOLVENT family selected or visible) */}
            {familyFilter === "INK_SOLVENT" || familyFilter === "ALL" ? (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1 font-mono">የቀለም አይነት (Ink Color)</label>
                <select
                  value={inkColorFilter}
                  onChange={(e) => setInkColorFilter(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white outline-none focus:border-[#00B4D8]"
                >
                  <option value="ALL">ሁሉም ቀለሞች (All Colors)</option>
                  <option value="CYAN">Cyan (ሰማያዊ)</option>
                  <option value="MAGENTA">Magenta (ቀይ)</option>
                  <option value="YELLOW">Yellow (ቢጫ)</option>
                  <option value="BLACK">Black (ጥቁር)</option>
                  <option value="WHITE">White (ነጭ)</option>
                  <option value="FLUSH">Flush / Cleaner</option>
                </select>
              </div>
            ) : null}
          </div>

          {/* 4. Instant Search & Material Selection List / Combobox */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-white">
                ጥሬ እቃ ይምረጡ (Select Material) *
              </label>
              <span className="text-[10px] font-mono text-slate-400">
                {filteredMaterials.length} እቃዎች ተገኝተዋል
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="በስም፣ መግለጫ፣ ወይም ቦታ ይፈልጉ (ለምሳሌ: Banner, Cyan, Acrylic)..."
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 pl-9 pr-8 text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#00B4D8]"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            {/* Scrollable Material Cards */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-lg border border-slate-800 bg-[#090B0F] p-1.5">
              {filteredMaterials.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  በዚህ ማጣሪያ ስር የተገኘ እቃ የለም። ማጣሪያውን ይቀይሩ።
                </div>
              ) : (
                filteredMaterials.map((m) => {
                  const isSelected = m.id === materialId;
                  const parentStock = parentByMaterialId.get(m.id);
                  const pkgCount = parentStock?.totalStockQuantity ?? 0;
                  const pkgUnit = parentStock?.unitType ?? m.packageUnit ?? "UNITS";
                  const colorConfig = m.inkColor ? INK_COLOR_SWATCHES[m.inkColor.toUpperCase()] : undefined;

                  return (
                    <div
                      key={m.id}
                      onClick={() => handleMaterialSelect(m.id)}
                      className={cn(
                        "flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-all cursor-pointer text-xs",
                        isSelected
                          ? "border-[#00B4D8] bg-[#00B4D8]/10 shadow-sm"
                          : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/50"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Ink color swatch dot or Package icon */}
                        {colorConfig ? (
                          <span
                            className={cn(
                              "w-4 h-4 rounded-full border flex-none shadow-sm",
                              colorConfig.bg,
                              colorConfig.border
                            )}
                            title={colorConfig.label}
                          />
                        ) : (
                          <Package size={15} className="text-[#00B4D8] flex-none" />
                        )}

                        <div className="min-w-0">
                          <strong className="text-white font-bold block truncate">{m.name}</strong>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="truncate">{m.category}</span>
                            {m.specification ? (
                              <>
                                <span>·</span>
                                <span className="truncate text-slate-300">
                                  {m.specification}
                                  {m.specificationValue ? `: ${m.specificationValue}` : ""}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Stock Level Badge */}
                      <div className="text-right flex-none">
                        <span className="font-mono text-xs font-bold text-white block">
                          {pkgCount} {pkgUnit}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatQuantity(m.quantity, (m.baseUnit ?? m.unit) as Unit)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 5. Selected Material Summary Card */}
          {selectedMaterial ? (
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#00B4D8] font-bold">
                    የተመረጠ እቃ (Selected Material)
                  </span>
                  <h4 className="text-sm font-bold text-white mt-0.5">{selectedMaterial.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>ምድብ: <strong className="text-slate-200 font-normal">{selectedMaterial.category}</strong></span>
                    {selectedMaterial.storageLocation ? (
                      <span>· መገኛ: <strong className="text-slate-200 font-normal">{selectedMaterial.storageLocation}</strong></span>
                    ) : null}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">በስቶክ ላይ ያለ</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {availablePackages} {packageUnitLabel}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 block">
                    ({formatQuantity(availableBaseStock, selectedBaseUnit)})
                  </span>
                </div>
              </div>

              {/* Conversion hint */}
              {selectedMaterial.conversionRatio ? (
                <div className="text-[11px] text-slate-400 font-mono border-t border-slate-800 pt-1.5 flex items-center justify-between">
                  <span>የመለኪያ ንጽጽር (Ratio):</span>
                  <span className="text-slate-200">
                    1 {selectedMaterial.purchaseUnit ?? "unit"} = {selectedMaterial.conversionRatio} {selectedBaseUnit}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* 6. Quantity & Unit Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-white mb-1.5">
                የሚገባ / የሚወጣ መጠን (Quantity) *
              </label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.000"
                className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm font-mono text-white placeholder:text-slate-500 outline-none focus:border-[#00B4D8]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white mb-1.5">
                የመለኪያ አይነት (Entry Unit) *
              </label>
              <select
                value={inputUnit}
                onChange={(e) => setInputUnit(e.target.value as InputUnit)}
                className="h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-white outline-none focus:border-[#00B4D8]"
              >
                {availableInputUnits.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 7. Live Normalized Base Quantity Preview */}
          {selectedMaterial && quantityNum > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#00B4D8]/10 border border-[#00B4D8]/20">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Sparkles size={16} className="text-[#00B4D8]" />
                <span>የተሰላ ጠቅላላ መጠን (Normalized Base Stock):</span>
              </div>
              <span className="font-mono text-sm font-extrabold text-[#00B4D8]">
                {formatQuantity(converted, selectedBaseUnit)}
              </span>
            </div>
          )}

          {/* 8. Stock-Out Boundary Warning */}
          {isStockOutExceeded ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/25 p-3 text-xs text-rose-200 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-rose-400 mt-0.5 flex-none" />
              <div>
                <strong className="text-rose-300 font-bold block text-sm">የክምችት እጥረት (Insufficient Stock)</strong>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  ማውጣት የተፈለገው መጠን ({formatQuantity(converted, selectedBaseUnit)}) በዋና ስቶክ ውስጥ ካለው ክምችት ({formatQuantity(availableBaseStock, selectedBaseUnit)}) ይበልጣል። እባክዎን መጠኑን ይቀንሱ።
                </p>
              </div>
            </div>
          ) : null}

          {/* 9. Reference / Audit Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              የማስታወሻ መግለጫ (Reference Note / Supplier / Reason)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="የአቅራቢ ስም፣ ደረሰኝ ቁጥር፣ ወይም የስቶክ ማውጫ ምክንያት..."
              className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-[#00B4D8]"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>
      ) : (
        /* Step 2: Confirmation & Impact Review */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400 font-mono">የእንቅስቃሴ አይነት (Direction)</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase font-mono border",
                  direction === "in"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                )}
              >
                {direction === "in" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                {direction === "in" ? "እቃ ማስገቢያ (Stock In)" : "እቃ ማውጫ (Stock Out)"}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400 font-mono">ጥሬ እቃ (Material)</span>
              <span className="text-sm font-bold text-white">{selectedMaterial?.name}</span>
            </div>

            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs text-slate-400 font-mono">የተመዘገበ መጠን (Movement)</span>
              <div className="text-right">
                <span className="font-mono text-sm font-bold text-white">
                  {quantityNum} {inputUnit}
                </span>
                <span className="font-mono text-xs text-[#00B4D8] block">
                  ({formatQuantity(converted, selectedBaseUnit)})
                </span>
              </div>
            </div>

            {/* Projected Stock Balance Impact */}
            <div className="rounded-lg bg-black/40 border border-slate-800 p-3 space-y-1.5">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">
                በስቶክ ላይ የሚኖረው ለውጥ (Projected Stock Impact):
              </span>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">የአሁኑ ክምችት (Current):</span>
                <span className="text-slate-200">
                  {formatQuantity(availableBaseStock, selectedBaseUnit)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono font-bold">
                <span className={direction === "in" ? "text-emerald-400" : "text-rose-400"}>
                  {direction === "in" ? "+ መጨመር (+)" : "- መቀነስ (-)"}:
                </span>
                <span className={direction === "in" ? "text-emerald-400" : "text-rose-400"}>
                  {direction === "in" ? "+" : "-"} {formatQuantity(converted, selectedBaseUnit)}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-1.5 flex items-center justify-between text-xs font-mono font-extrabold">
                <span className="text-white">አዲሱ ክምችት (New Balance):</span>
                <span className="text-[#00B4D8]">
                  {formatQuantity(
                    direction === "in"
                      ? availableBaseStock + converted
                      : Math.max(0, availableBaseStock - converted),
                    selectedBaseUnit
                  )}
                </span>
              </div>
            </div>

            {note ? (
              <div className="pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400 block font-mono text-[10px]">ማስታወሻ (Reference):</span>
                <p className="text-slate-200 mt-0.5">{note}</p>
              </div>
            ) : null}
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/20 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  );
}
