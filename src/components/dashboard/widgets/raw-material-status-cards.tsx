import type { LucideIcon } from "lucide-react";
import { Boxes, Cable, FlaskConical, Package, PanelsTopLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type RawMaterialCategoryId = "roll" | "sheets" | "canisters" | "packages" | "coil";
export type RawMaterialTone = "cyan" | "gold" | "violet" | "blue" | "green";

export interface StockItem {
  name: string;
  quantity: number;
  unit: string;
  lowStock?: boolean;
}

export interface RawMaterialCategory {
  id: RawMaterialCategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
  total: number;
  totalUnit: string;
  items: StockItem[];
  tone: RawMaterialTone;
}

export interface InventoryCategoryCardProps {
  categoryLabel: string;
  categoryDescription: string;
  icon: LucideIcon;
  total: number;
  totalUnit: string;
  items: StockItem[];
  tone?: RawMaterialTone;
}

const toneStyles: Record<RawMaterialTone, { icon: string; accent: string; badge: string }> = {
  cyan: {
    icon: "bg-cyan/15 text-cyan-dark",
    accent: "bg-cyan",
    badge: "border-cyan/25 bg-cyan/10 text-cyan-dark",
  },
  gold: {
    icon: "bg-gold/15 text-gold",
    accent: "bg-gold",
    badge: "border-gold/25 bg-gold/10 text-gold",
  },
  violet: {
    icon: "bg-violet/15 text-violet",
    accent: "bg-violet",
    badge: "border-violet/25 bg-violet/10 text-violet",
  },
  blue: {
    icon: "bg-blue/15 text-blue",
    accent: "bg-blue",
    badge: "border-blue/25 bg-blue/10 text-blue",
  },
  green: {
    icon: "bg-green/15 text-green",
    accent: "bg-green",
    badge: "border-green/25 bg-green/10 text-green",
  },
};

export function InventoryCategoryCard({
  categoryLabel,
  categoryDescription,
  icon: Icon,
  total,
  totalUnit,
  items,
  tone = "cyan",
}: InventoryCategoryCardProps) {
  const styles = toneStyles[tone];
  const hasLowStock = items.some((item) => item.lowStock);

  return (
    <article className="relative flex min-h-[214px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-custom">
      <div className={cn("absolute inset-x-0 bottom-0 h-1", hasLowStock ? "bg-danger" : styles.accent)} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", styles.icon)}>
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold text-foreground">{categoryLabel}</h3>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{categoryDescription}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide",
            hasLowStock ? "border-danger/30 bg-danger/10 text-danger" : "border-success/30 bg-success/10 text-success",
          )}
        >
          {hasLowStock ? "Low stock" : "Healthy"}
        </span>
      </div>

      <div className="mt-5">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">On hand</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">
          {total} <span className="text-sm font-semibold text-muted-foreground">{totalUnit}</span>
        </p>
      </div>

      <div className="mt-auto flex flex-wrap gap-1.5 pt-4" aria-label={`${categoryLabel} stock breakdown`}>
        {items.map((item) => (
          <span
            key={item.name}
            className={cn(
              "rounded-full border px-2 py-1 text-[10px] leading-tight",
              item.lowStock ? "border-danger/30 bg-danger/10 text-danger" : styles.badge,
            )}
          >
            {item.name}: {item.quantity}{item.unit}
          </span>
        ))}
      </div>
    </article>
  );
}

export const rawMaterialCategories: RawMaterialCategory[] = [
  {
    id: "roll",
    label: "Roll",
    description: "Roll materials",
    icon: PanelsTopLeft,
    total: 14,
    totalUnit: "rolls",
    tone: "cyan",
    items: [
      { name: "Banner", quantity: 4, unit: "" },
      { name: "Sticker", quantity: 8, unit: "" },
      { name: "Canvas", quantity: 2, unit: "" },
    ],
  },
  {
    id: "sheets",
    label: "Sheets",
    description: "Boards and sheets",
    icon: Boxes,
    total: 25,
    totalUnit: "sheets",
    tone: "gold",
    items: [
      { name: "Foam", quantity: 15, unit: "" },
      { name: "Mica", quantity: 10, unit: "" },
    ],
  },
  {
    id: "canisters",
    label: "Canisters",
    description: "Ink and solvents",
    icon: FlaskConical,
    total: 18,
    totalUnit: "canisters",
    tone: "violet",
    items: [
      { name: "INKS", quantity: 12, unit: "" },
      { name: "Solvents", quantity: 6, unit: "" },
    ],
  },
  {
    id: "packages",
    label: "Packages / Pieces",
    description: "Hardware and parts",
    icon: Package,
    total: 150,
    totalUnit: "pcs",
    tone: "blue",
    items: [{ name: "LED Lights", quantity: 150, unit: " pcs" }],
  },
  {
    id: "coil",
    label: "Coil / Meter",
    description: "Wire and cable",
    icon: Cable,
    total: 80,
    totalUnit: "m",
    tone: "green",
    items: [{ name: "Electric Wire", quantity: 80, unit: "m" }],
  },
];

export function RawMaterialStatusGrid({ categories = rawMaterialCategories }: { categories?: RawMaterialCategory[] }) {
  return (
    <section aria-labelledby="raw-material-status-title" className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">

        <p className="text-[11px] text-muted-foreground">Main Stock materials.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {categories.map((category) => (
          <InventoryCategoryCard
            key={category.id}
            categoryLabel={category.label}
            categoryDescription={category.description}
            icon={category.icon}
            total={category.total}
            totalUnit={category.totalUnit}
            items={category.items}
            tone={category.tone}
          />
        ))}
      </div>
    </section>
  );
}
