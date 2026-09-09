"use client";

import { useMemo } from "react";
import { Layers, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  groupParentInventoryByCategory,
  computeMainStoreSummary,
  type ParentInventoryItem,
  type CategoryGroup,
} from "@/lib/inventory-category-groups";

// ─── Sub-components ───────────────────────────────────────────────────────────

const toneMap: Record<
  CategoryGroup["tone"],
  { icon: string; accent: string; badge: string; bar: string }
> = {
  cyan: {
    icon: "bg-cyan/15 text-cyan-dark",
    accent: "bg-cyan",
    badge: "border-cyan/25 bg-cyan/10 text-cyan-dark",
    bar: "bg-cyan",
  },
  gold: {
    icon: "bg-gold/15 text-gold",
    accent: "bg-gold",
    badge: "border-gold/25 bg-gold/10 text-gold",
    bar: "bg-gold",
  },
  violet: {
    icon: "bg-violet/15 text-violet",
    accent: "bg-violet",
    badge: "border-violet/25 bg-violet/10 text-violet",
    bar: "bg-violet",
  },
  blue: {
    icon: "bg-blue/15 text-blue",
    accent: "bg-blue",
    badge: "border-blue/25 bg-blue/10 text-blue",
    bar: "bg-blue",
  },
  green: {
    icon: "bg-green/15 text-green",
    accent: "bg-green",
    badge: "border-green/25 bg-green/10 text-green",
    bar: "bg-green",
  },
  slate: {
    icon: "bg-muted/40 text-muted-foreground",
    accent: "bg-muted-foreground/60",
    badge: "border-border bg-muted/30 text-muted-foreground",
    bar: "bg-muted-foreground/60",
  },
};

function CategoryCard({ group }: { group: CategoryGroup }) {
  const styles = toneMap[group.tone];
  const Icon = group.icon;
  const lowStockItems = group.items.filter((i) => i.lowStock);

  return (
    <article
      className={cn(
        "relative flex min-h-[210px] flex-col overflow-hidden rounded-xl",
        "border border-border/60 bg-card shadow-custom",
        group.hasLowStock && "border-danger/40",
      )}
      aria-label={`${group.label} category`}
    >
      {/* Bottom accent bar */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 h-[3px]",
          group.hasLowStock ? "bg-danger" : styles.accent,
        )}
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
                styles.icon,
              )}
              aria-hidden="true"
            >
              <Icon size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold text-foreground">
                {group.label}
              </h3>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {group.amharicLabel} · {group.description}
              </p>
            </div>
          </div>

          {/* Health badge */}
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide",
              group.hasLowStock
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-success/30 bg-success/10 text-success",
            )}
          >
            {group.hasLowStock ? "Low stock" : "Healthy"}
          </span>
        </div>

        {/* Total count */}
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            On hand
          </p>
          {group.totalUnits === 0 ? (
            <p className="mt-1 text-2xl font-bold text-muted-foreground/50">Empty</p>
          ) : (
            <p className="mt-1 text-3xl font-extrabold tracking-tight text-foreground">
              {group.totalUnits.toLocaleString()}{" "}
              <span className="text-sm font-semibold text-muted-foreground">
                {group.unitLabel}
              </span>
            </p>
          )}
        </div>

        {/* Item breakdown badges */}
        <div
          className="mt-auto flex flex-wrap gap-1.5 pt-1"
          aria-label={`${group.label} breakdown`}
        >
          {group.items.length === 0 ? (
            <span className="text-[11px] text-muted-foreground/50 italic">
              No items tracked
            </span>
          ) : (
            group.items.map((item) => (
              <span
                key={item.name}
                title={item.name}
                className={cn(
                  "max-w-[180px] truncate rounded-full border px-2 py-[3px] text-[10px] leading-tight",
                  item.lowStock
                    ? "border-danger/30 bg-danger/10 text-danger"
                    : styles.badge,
                )}
              >
                {item.name}: {item.quantity} {item.unit}
              </span>
            ))
          )}
          {lowStockItems.length > 0 && (
            <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-[3px] text-[9px] font-bold uppercase tracking-wide text-danger">
              {lowStockItems.length} low
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({
  totalTracked,
  totalRollBaseM2,
  totalSheetBaseM2,
  totalInkLitres,
}: ReturnType<typeof computeMainStoreSummary>) {
  const stats = [
    { label: "Tracked materials", value: totalTracked.toString(), icon: null },
    {
      label: "Roll base area",
      value: `${totalRollBaseM2.toLocaleString()} m²`,
      icon: <ScrollText size={12} className="text-cyan-dark" aria-hidden="true" />,
    },
    {
      label: "Sheet base area",
      value: `${totalSheetBaseM2.toLocaleString()} m²`,
      icon: <Layers size={12} className="text-gold" aria-hidden="true" />,
    },
    {
      label: "Ink / solvent",
      value: `${totalInkLitres.toLocaleString()} L`,
      icon: null,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/50 bg-card px-4 py-3">
      {stats.map((stat) => (
        <div key={stat.label} className="flex items-center gap-1.5">
          {stat.icon}
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {stat.label}:
          </span>
          <span className="font-mono text-[11px] font-bold text-foreground">
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface OwnerInventoryCategoryGridProps {
  items: ParentInventoryItem[];
}

export function OwnerInventoryCategoryGrid({ items }: OwnerInventoryCategoryGridProps) {
  const groups = useMemo(() => groupParentInventoryByCategory(items), [items]);
  const summary = useMemo(() => computeMainStoreSummary(items), [items]);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <SummaryBar {...summary} />

      {/* Category cards grid */}
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        role="list"
        aria-label="Main store inventory categories"
      >
        {groups.map((group) => (
          <div key={group.id} role="listitem">
            <CategoryCard group={group} />
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border/60 bg-card">
          <p className="text-sm text-muted-foreground">
            No central store inventory to display.
          </p>
        </div>
      )}
    </div>
  );
}
