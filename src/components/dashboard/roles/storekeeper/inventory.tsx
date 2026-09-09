"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  CircleAlert,
  Droplets,
  Factory,
  Gauge,
  LayoutGrid,
  LockKeyhole,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Warehouse,
} from "lucide-react";
import { InventoryLoader } from "../../widgets/inventory-loader";
import { useDashboardModal } from "../../modals/modal-context";
import { cn } from "@/lib/utils";

type InventoryView = "main" | "substock";
type PackageFilter = "ALL" | "ROLL" | "SHEET" | "LITER";
type BadgeTone = "success" | "warning" | "neutral" | "info";

const OPERATOR_ROLES = ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"];

function packageLabel(unitType: string) {
  if (unitType === "ROLL") return "ROLLS";
  if (unitType === "SHEET") return "SHEETS";
  if (unitType === "LITER") return "CANISTERS";
  return "UNITS";
}

function baseUnitLabel(unit: string) {
  return unit === "m²" ? "m²" : unit;
}

function stockValue(quantity: number, unit: string) {
  return `${Number(quantity.toFixed(1))} ${baseUnitLabel(unit)}`;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ACTIVE: "ንቁ (Active)",
    IDLE: "ስራ ላይ ያልሆነ (Idle)",
    "RECONCILIATION REQUIRED": "ማረጋገጫ ያስፈልገዋል (Verify)",
    "LOW STOCK": "ክምችት አነስቷል (Low stock)",
    AVAILABLE: "ይገኛል (Available)",
  };
  return map[status] ?? status;
}

function TokenBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em]",
        tone === "success" && "border-status-success/40 bg-status-success-bg text-status-success",
        tone === "warning" && "border-status-warning/40 bg-status-warning-bg text-status-warning",
        tone === "info" && "border-brand-primary/40 bg-brand-primary-bg text-brand-primary-light",
        tone === "neutral" && "border-border-token bg-surface-elevated text-text-secondary",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "success" && "bg-status-success",
          tone === "warning" && "bg-status-warning",
          tone === "info" && "bg-brand-primary-light",
          tone === "neutral" && "bg-text-dim",
        )}
      />
      {children}
    </span>
  );
}

function KpiCard({
  label,
  value,
  unit,
  detail,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: string;
  unit: string;
  detail: string;
  icon: typeof Boxes;
  tone?: "brand" | "success" | "warning";
}) {
  return (
    <article className="rounded-2xl border border-border-token bg-surface p-5 shadow-brand-glow/0 transition hover:border-brand-primary/30 hover:shadow-brand-glow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-jakarta text-xs font-semibold text-text-secondary">{label}</p>
          <div className="mt-4 flex items-baseline gap-2">
            <strong className="font-jakarta text-3xl font-extrabold tracking-tight text-text-primary">{value}</strong>
            <span
              className={cn(
                "font-mono text-[10px] font-bold uppercase tracking-wider",
                tone === "brand" && "text-brand-primary-light",
                tone === "success" && "text-status-success",
                tone === "warning" && "text-status-warning",
              )}
            >
              {unit}
            </span>
          </div>
        </div>
        <span
          className={cn(
            "grid h-10 w-10 place-items-center rounded-xl border",
            tone === "brand" && "border-brand-primary/30 bg-brand-primary-bg text-brand-primary-light",
            tone === "success" && "border-status-success/30 bg-status-success-bg text-status-success",
            tone === "warning" && "border-status-warning/30 bg-status-warning-bg text-status-warning",
          )}
        >
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-4 truncate border-t border-border-token pt-3 font-mono text-[10px] text-text-dim">{detail}</p>
    </article>
  );
}

export function InventoryManagementInterface({ initialView }: { initialView: InventoryView }) {
  const profile = useQuery(api.users.getCurrentProfile);
  const isActive = profile?.active === true;
  const canViewMain = Boolean(profile && ["owner", "manager", "admin", "storekeeper"].includes(profile.role));
  const isOperator = Boolean(profile && OPERATOR_ROLES.includes(profile.role));
  const canRequest = isOperator && profile?.active === true;
  const canReconcile = isOperator && profile?.active === true;
  const { openModal } = useDashboardModal();
  const exhaustStock = useMutation(api.inventory.exhaustOperatorStock);
  const [activeView, setActiveView] = useState<InventoryView>(canViewMain ? initialView : "substock");
  const [packageFilter, setPackageFilter] = useState<PackageFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [exhaustingId, setExhaustingId] = useState<string | null>(null);

  const parentInventory = useQuery(api.inventory.listParentInventory, canViewMain && isActive ? {} : "skip");
  const floorStock = useQuery(api.inventory.listOperatorMachineStock, isActive ? {} : "skip");
  const unclearedStock = useQuery(api.inventory.myUnclearedStock, isActive ? {} : "skip");
  const items = parentInventory ?? [];
  const stock = floorStock ?? [];

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = packageFilter === "ALL" || item.unitType === packageFilter;
      const matchesSearch = !query || [item.materialName, item.materialCategory, item.unitType, item.storageLocation]
        .join(" ")
        .toLowerCase()
        .includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [items, packageFilter, searchTerm]);

  const totals = useMemo(() => ({
    rolls: items.filter((item) => item.unitType === "ROLL").reduce((sum, item) => sum + item.totalStockQuantity, 0),
    sheets: items.filter((item) => item.unitType === "SHEET").reduce((sum, item) => sum + item.totalStockQuantity, 0),
    liters: items.filter((item) => item.unitType === "LITER").reduce((sum, item) => sum + item.totalStockQuantity, 0),
  }), [items]);

  const lowStock = useMemo(() => items.filter((item) => {
    const threshold = item.conversionFactor ? item.reorderAt / item.conversionFactor : item.reorderAt;
    return threshold > 0 && item.totalStockQuantity <= threshold;
  }), [items]);

  const machineCards = useMemo(() => {
    const groups = new Map<string, { machineId: string; machineName: string; operatorName: string; batches: typeof stock }>();
    for (const batch of stock) {
      const current = groups.get(batch.machineId) ?? {
        machineId: batch.machineId,
        machineName: batch.machineName ?? "Unassigned machine",
        operatorName: batch.operatorName ?? "Assigned operator",
        batches: [],
      };
      current.batches.push(batch);
      groups.set(batch.machineId, current);
    }
    return [...groups.values()].map((group) => {
      const primary = group.batches[0];
      const matchingUnit = group.batches.filter((batch) => batch.baseUnit === primary?.baseUnit);
      const pending = group.batches.some((batch) => batch.status === "PENDING_CLEARANCE");
      const assigned = matchingUnit.reduce((sum, batch) => sum + batch.issuedQuantity, 0);
      const consumed = matchingUnit.reduce((sum, batch) => sum + (batch.consumed ?? batch.issuedQuantity - batch.currentRemaining), 0);
      const remaining = matchingUnit.reduce((sum, batch) => sum + batch.currentRemaining, 0);
      return {
        ...group,
        primary,
        lineCount: group.batches.length,
        assigned,
        consumed,
        remaining,
        status: pending ? "RECONCILIATION REQUIRED" : remaining > 0 ? "ACTIVE" : "IDLE",
      };
    });
  }, [stock]);

  const activeMachineStock = stock.reduce((sum, batch) => sum + batch.currentRemaining, 0);
  const activeMachines = new Set(stock.filter((batch) => batch.status === "ACTIVE").map((batch) => batch.machineId)).size;
  const pendingClearances = stock.filter((batch) => batch.status === "PENDING_CLEARANCE").length;
  const loading = !profile || floorStock === undefined || (canViewMain && parentInventory === undefined);

  if (loading) {
    return <div className="flex min-h-[520px] items-center justify-center"><InventoryLoader label="Loading enterprise inventory console..." /></div>;
  }

  function handleExhaust(batchId: string) {
    setExhaustingId(batchId);
    void exhaustStock({ stockId: batchId as never }).finally(() => setExhaustingId(null));
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] space-y-8 bg-main pb-10 font-jakarta text-text-primary">
      <header className="flex flex-col gap-6 border-b border-border-token pb-7 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-4xl">
          <h1 className="mt-5 text-balance text-xl font-extrabold tracking-tight text-text-primary md:text-xl">
            የስቶክ እና ጥሬ እቃ ቁጥጥር <span className="text-brand-primary-light">(Inventory Management)</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">የዋና ስቶክ እና የማሽን ኦፕሬተሮች Floor Stock ሙሉ ሁኔታ</p>
        </div>
        <button
          type="button"
          onClick={() => openModal("stock")}
          disabled={!canViewMain}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-primary-light px-5 py-3 text-sm font-extrabold text-main shadow-brand-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} /> አዲስ እቃ አስገባ
        </button>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-border-token bg-surface p-2 sm:flex-row">
        {canViewMain ? (
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "main"}
            onClick={() => setActiveView("main")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition",
              activeView === "main" ? "bg-brand-primary text-main shadow-brand-glow" : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
            )}
          >
            <Warehouse size={16} /> ዋና ስቶክ <span className="font-normal opacity-80">(Main Store)</span>
          </button>
        ) : null}
        <button
          type="button"
          role="tab"
          aria-selected={activeView === "substock"}
          onClick={() => setActiveView("substock")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition",
            activeView === "substock" ? "bg-brand-primary text-main shadow-brand-glow" : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary",
          )}
        >
          <Factory size={16} /> የማሽን ስቶክ <span className="font-normal opacity-80">(Floor Stock)</span>
          <span className={cn("rounded-full px-2 py-0.5 font-mono text-[10px]", activeView === "substock" ? "bg-main/20" : "bg-surface-elevated text-text-secondary")}>{machineCards.length}</span>
        </button>
      </div>

      {activeView === "main" && canViewMain ? (
        <section role="tabpanel" aria-label="Main store inventory" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="ጠቅላላ የሮል ብዛት" value={Number(totals.rolls.toFixed(1)).toString()} unit="ROLLS" detail={`${items.filter((item) => item.unitType === "ROLL").length} roll materials tracked`} icon={Package} />
            <KpiCard label="ጠቅላላ የሺት ብዛት" value={Number(totals.sheets.toFixed(1)).toString()} unit="SHEETS" detail={lowStock.some((item) => item.unitType === "SHEET") ? "Monitor low stock" : "Stable level"} icon={Boxes} tone={lowStock.some((item) => item.unitType === "SHEET") ? "warning" : "success"} />
            <KpiCard label="ጠቅላላ የቀለም ብዛት" value={Number(totals.liters.toFixed(1)).toString()} unit="CANISTERS" detail={`${lowStock.filter((item) => item.unitType === "LITER").length} low stock alerts`} icon={Droplets} tone={lowStock.some((item) => item.unitType === "LITER") ? "warning" : "brand"} />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border-token bg-surface shadow-custom">
            <div className="flex flex-col gap-4 border-b border-border-token p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-brand-primary-light"><LayoutGrid size={15} /><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">Main Store Ledger</span></div>
                <h2 className="mt-2 text-lg font-extrabold text-text-primary">የዋና ስቶክ ዝርዝር</h2>
              </div>
              <div className="relative w-full lg:w-80">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" aria-hidden="true" />
                <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="የእቃ ስም ፈልግ..." className="h-10 w-full rounded-xl border border-border-token bg-main pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-dim focus:border-brand-primary" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-border-token bg-surface-elevated/60 p-4">
              {(["ALL", "ROLL", "SHEET", "LITER"] as PackageFilter[]).map((filter) => {
                const active = packageFilter === filter;
                const label = filter === "ALL" ? "ሁሉም (All Units)" : filter === "ROLL" ? "ሮሎች (Rolls)" : filter === "SHEET" ? "ሺቶች (Sheets)" : "ቀለሞች (Canisters)";
                return <button key={filter} type="button" onClick={() => setPackageFilter(filter)} className={cn("rounded-full border px-3 py-2 text-xs font-bold transition", active ? "border-brand-primary bg-brand-primary text-main" : "border-border-token bg-surface text-text-secondary hover:border-brand-primary/50 hover:text-text-primary")}>{label}</button>;
              })}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-surface-elevated font-mono text-[10px] uppercase tracking-[0.15em] text-text-secondary">
                  <tr><th className="px-5 py-4">Item Name</th><th className="px-4 py-4">Category</th><th className="px-4 py-4">Unit Type</th><th className="px-4 py-4 text-right">Stock Level</th><th className="px-5 py-4 text-right">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-border-token">
                  {filteredItems.map((item) => {
                    const threshold = item.conversionFactor ? item.reorderAt / item.conversionFactor : item.reorderAt;
                    const isLow = threshold > 0 && item.totalStockQuantity <= threshold;
                    return <tr key={item._id} className="transition hover:bg-surface-elevated/60"><td className="px-5 py-4"><p className="font-semibold text-text-primary">{item.materialName}</p><p className="mt-1 text-xs text-text-dim">{item.storageLocation}</p></td><td className="px-4 py-4 text-text-secondary">{item.materialCategory}</td><td className="px-4 py-4"><span className="rounded-lg border border-border-token bg-surface-elevated px-2.5 py-1 font-mono text-[10px] font-bold text-text-secondary">{packageLabel(item.unitType)}</span></td><td className="px-4 py-4 text-right font-mono font-bold tabular-nums text-text-primary">{Number(item.totalStockQuantity.toFixed(1))}</td><td className="px-5 py-4 text-right"><TokenBadge tone={isLow ? "warning" : "success"}>{statusLabel(isLow ? "LOW STOCK" : "AVAILABLE")}</TokenBadge></td></tr>;
                  })}
                  {filteredItems.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-text-secondary">No inventory items match this filter.</td></tr> : null}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-token px-5 py-4 text-xs text-text-secondary"><span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-status-success" /> Live physical ledger</span><span className="font-mono">{filteredItems.length} / {items.length} items</span></div>
          </div>
        </section>
      ) : null}

      {activeView === "substock" ? (
        <section role="tabpanel" aria-label="Machine floor stock" className="space-y-6">
          {pendingClearances > 0 ? <div className="flex flex-col gap-3 rounded-2xl border border-status-warning/40 bg-status-warning-bg p-4 sm:flex-row sm:items-center"><span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-status-warning text-main"><LockKeyhole size={18} /></span><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm font-extrabold text-text-primary">CLEARANCE GATE: PENDING APPROVAL</strong><TokenBadge tone="warning">{pendingClearances} UNVERIFIED LOGS</TokenBadge></div><p className="mt-1 text-xs leading-5 text-text-secondary">Floor material requests remain locked until reconciliation is reviewed.</p></div></div> : null}

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard label="Active Machine Stock" value={Number(activeMachineStock.toFixed(1)).toString()} unit={stock[0]?.baseUnit ?? "UNITS"} detail="Current in-hand balance across floor batches" icon={Gauge} />
            <KpiCard label="Active Operators" value={activeMachines.toString()} unit="MACHINES / SHIFTS" detail={`${machineCards.length} machine workspaces reporting`} icon={Activity} tone="success" />
            <KpiCard label="Pending Clearances" value={pendingClearances.toString()} unit="UNVERIFIED LOGS" detail={pendingClearances > 0 ? "Reconciliation action required" : "No pending verification"} icon={CircleAlert} tone={pendingClearances > 0 ? "warning" : "success"} />
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-brand-primary-light"><Factory size={15} /><span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">Tier 2 Production Floor</span></div><h2 className="mt-2 text-xl font-extrabold text-text-primary">የማሽን ኦፕሬተር ስቶክ (Machine Floor Stock)</h2><p className="mt-1 text-sm text-text-secondary">Live material custody at each production workstation.</p></div>{canRequest ? <button type="button" disabled={(unclearedStock ?? []).length > 0} onClick={() => openModal("request")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-primary/40 bg-brand-primary-bg px-4 py-2.5 text-xs font-bold text-brand-primary-light transition hover:bg-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} /> አዲስ ቀለም መድብ</button> : null}</div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {machineCards.map((card) => {
              const cardTone: BadgeTone = card.status === "ACTIVE" ? "success" : card.status === "RECONCILIATION REQUIRED" ? "warning" : "neutral";
              return <article key={card.machineId} className="flex min-h-[285px] flex-col rounded-2xl border border-border-token bg-surface p-5 shadow-custom transition hover:-translate-y-0.5 hover:border-brand-primary/35"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-brand-primary/30 bg-brand-primary-bg text-brand-primary-light"><Factory size={19} /></span><div className="min-w-0"><h3 className="truncate font-bold text-text-primary">{card.machineName}</h3><p className="mt-1 truncate text-xs text-text-secondary">Operator: {card.operatorName}</p></div></div><TokenBadge tone={cardTone}>{statusLabel(card.status)}</TokenBadge></div><div className="mt-6 grid grid-cols-3 divide-x divide-border-token rounded-xl border border-border-token bg-surface-elevated py-3"><div className="px-3 text-center"><p className="text-[10px] text-text-dim">Assigned</p><strong className="mt-1 block font-mono text-sm text-text-primary">{stockValue(card.assigned, card.primary?.baseUnit ?? "units")}</strong></div><div className="px-3 text-center"><p className="text-[10px] text-text-dim">Consumed</p><strong className="mt-1 block font-mono text-sm text-text-primary">{stockValue(card.consumed, card.primary?.baseUnit ?? "units")}</strong></div><div className="px-3 text-center"><p className="text-[10px] text-text-dim">In-Hand</p><strong className="mt-1 block font-mono text-sm text-brand-primary-light">{stockValue(card.remaining, card.primary?.baseUnit ?? "units")}</strong></div></div><div className="mt-auto flex items-center justify-between gap-3 pt-5"><span className="inline-flex items-center gap-1.5 text-xs text-text-secondary"><Sparkles size={13} className="text-brand-primary-light" />{card.lineCount} stock {card.lineCount === 1 ? "line" : "lines"}</span>{card.status === "RECONCILIATION REQUIRED" && canReconcile ? <button type="button" onClick={() => openModal("reconciliation")} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-main transition hover:bg-brand-primary-light">Reconcile Stock <ChevronRight size={13} /></button> : card.status === "ACTIVE" && card.primary ? <button type="button" disabled={exhaustingId === card.primary._id} onClick={() => handleExhaust(card.primary!._id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-text-secondary transition hover:text-status-warning disabled:opacity-40">Mark exhausted <ArrowUpRight size={13} /></button> : <span className="text-xs text-text-dim">No action required</span>}</div></article>;
            })}
            {machineCards.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-border-token bg-surface p-14 text-center"><Package className="mx-auto text-text-dim" size={28} /><p className="mt-3 font-semibold text-text-primary">No active machine stock</p><p className="mt-1 text-sm text-text-secondary">Issued materials will appear here when assigned to a production workstation.</p></div> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
