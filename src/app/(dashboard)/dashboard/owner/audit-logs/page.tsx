"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { Activity, AlertTriangle, CalendarDays, ChevronDown, Download, FileText, Filter, History, Search, ShieldAlert, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Preset = "all" | "today" | "yesterday" | "7d" | "30d" | "month";
const categories = ["all", "Stock Movement", "Job Processing", "Reconciliation", "Order Management", "System Configuration", "Exception Overrides"];

function dateBounds(preset: Preset, from: string, to: string) {
  if (preset === "all") return {};
  if (preset === "today" || preset === "yesterday" || preset === "7d" || preset === "30d" || preset === "month") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (preset === "yesterday") start.setDate(start.getDate() - 1);
    if (preset === "7d") start.setDate(start.getDate() - 6);
    if (preset === "30d") start.setDate(start.getDate() - 29);
    if (preset === "month") start.setDate(1);
    const end = preset === "yesterday" ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { from: start.getTime(), to: end.getTime() };
  }
  return {
    from: from ? new Date(`${from}T00:00:00`).getTime() : undefined,
    to: to ? new Date(`${to}T23:59:59.999`).getTime() : undefined,
  };
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Maps internal camelCase field names to owner-friendly labels. */
const FIELD_LABELS: Record<string, string> = {
  // ETB valuation rates
  etbPerSquareMetre: "ETB rate per m² (area materials)",
  etbPerLitre: "ETB rate per litre (ink)",
  etbPerPiece: "ETB rate per piece (hardware)",
  etbPerMetre: "ETB rate per metre (linear materials)",
  etbPerSheet: "ETB rate per sheet (rigid boards)",
  // Ink & waste
  inkMlPerSquareMetre: "Ink consumption (mL per m²)",
  maxAllowedWastePercent: "Maximum allowed waste (%)",
  minOffcutAreaSquareMetre: "Minimum offcut size to track (m²)",
  defaultScrapAllowancePercent: "Default scrap allowance (%)",
  defaultMarginSquareMetres: "Default bleed/trim margin (m²)",
  standardWasteMargin: "Standard waste margin for job cards (%)",
  maxAllowedScrapLimit: "Maximum approved scrap ceiling (%)",
  materialScrapAllowances: "Per-material scrap allowances",
  // Stock controls
  requireAdminPinForExceptions: "Require admin PIN for exception stock-outs",
  maxDirectStockOutEtb: "Direct stock-out approval threshold (ETB)",
  // Orders
  orderExpirationHours: "Order expiration window (hours)",
  // Reorder alerts
  defaultReorderLevel: "Default reorder level",
  reorderAlertsEnabled: "Low-stock alerts enabled",
  reorderAlertCooldownHours: "Alert cooldown between notifications (hours)",
  // Conversions & overrides
  unitConversionDefaults: "Purchase unit conversion defaults",
  materialOverrides: "Per-material ETB price overrides",
  // Resolved entity names (from backend ID resolution)
  material: "Material",
  machine: "Machine",
  jobCard: "Job Card",
  order: "Customer Order",
  recordedBy: "Recorded by",
  operator: "Operator",
  countedBy: "Counted by",
  reviewedBy: "Reviewed by",
  performedBy: "Performed by",
  updatedBy: "Updated by",
  approvedBy: "Approved by",
  paymentConfirmedBy: "Payment confirmed by",
  // Stock movement fields
  eventType: "Event type",
  baseQuantity: "Quantity (base unit)",
  baseUnit: "Base unit",
  quantity: "Quantity",
  unit: "Unit",
  note: "Note",
  custody: "Custody",
  balanceEffect: "Balance effect",
  createdAt: "Recorded at",
  // Job fields
  code: "Job code",
  client: "Client",
  title: "Title",
  status: "Status",
  due: "Due date",
  priority: "Priority",
  // Production log
  inputQuantity: "Input quantity",
  outputQuantity: "Output quantity",
  wasteQuantity: "Waste quantity",
  // Order fields
  clientName: "Client name",
  phone: "Phone",
  serviceType: "Service type",
  dimensions: "Dimensions",
  amount: "Amount (ETB)",
  paymentStatus: "Payment status",
  // Reconciliation
  systemQuantity: "System quantity",
  countedQuantity: "Counted quantity",
  variance: "Variance",
  etbValue: "ETB value",
  monetaryLoss: "Estimated monetary loss (ETB)",
  // Config change
  configKey: "Configuration profile",
  changedFields: "Settings updated",
  reason: "Reason",
};

/** Convert a value to a display string the owner can read. */
function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key === "createdAt" || key === "updatedAt" || key === "reviewedAt" || key === "approvedAt" || key === "paymentConfirmedAt") {
    const ts = Number(value);
    return isNaN(ts) ? String(value) : formatTimestamp(ts);
  }
  if (key === "changedFields" && Array.isArray(value)) {
    return (value as string[]).join(", ");
  }
  if (key === "materialOverrides" && Array.isArray(value)) {
    return (value as Array<{ materialName: string; etbValue: number }>)
      .map((o) => `${o.materialName}: ETB ${o.etbValue}`)
      .join("; ");
  }
  if (key === "unitConversionDefaults" && Array.isArray(value)) {
    return (value as Array<{ materialName: string; conversionRatio: number; purchaseUnit: string; baseUnit: string }>)
      .map((r) => `${r.materialName}: 1 ${r.purchaseUnit} = ${r.conversionRatio} ${r.baseUnit}`)
      .join("; ");
  }
  if (key === "materialScrapAllowances" && Array.isArray(value)) {
    return (value as Array<{ allowancePercent: number }>)
      .map((a) => `${a.allowancePercent}%`)
      .join(", ");
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Converts a camelCase key to a capitalised readable label as a fallback. */
function humaniseKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();
}

/** Renders the resolved event payload as owner-friendly labelled rows. */
function PayloadRows({ resolvedPayload }: { resolvedPayload: Record<string, unknown> }) {
  const entries = Object.entries(resolvedPayload);
  if (entries.length === 0) return <p className="text-xs text-muted-foreground italic">No additional details.</p>;

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-border/50 bg-background/20 px-3 py-2">
          <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{FIELD_LABELS[key] ?? humaniseKey(key)}</dt>
          <dd className="mt-1 text-[11px] font-medium text-foreground break-words">{formatValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Readable labels for the "associated records" keys. */
const ASSOCIATED_LABELS: Record<string, string> = {
  orderId: "Customer Order",
  jobCardId: "Job Card",
  machineId: "Machine",
  materialId: "Material",
};

function EventDrawer({ event, onClose }: { event: any; onClose: () => void }) {
  if (!event) return null;

  const resolved: Record<string, unknown> = event.resolvedPayload ?? {};
  const hasAssociated = Object.values(event.associated ?? {}).some(Boolean);

  // Resolved entity names to show in "Linked records"
  const linkedNames: Record<string, string> = {};
  if (resolved.material) linkedNames["Material"] = String(resolved.material);
  if (resolved.machine) linkedNames["Machine"] = String(resolved.machine);
  if (resolved.jobCard) linkedNames["Job Card"] = String(resolved.jobCard);
  if (resolved.order) linkedNames["Customer Order"] = String(resolved.order);

  // For config changes, the changedFields array is already humanised by the backend
  const changedFieldsSummary: string | null =
    event.category === "System Configuration" && Array.isArray(resolved.changedFields) && resolved.changedFields.length > 0
      ? (resolved.changedFields as string[]).join(", ")
      : null;

  // Build the detail rows — exclude resolved entity names already shown in "Linked records"
  const EXCLUDE_FROM_DETAILS = new Set(["material", "machine", "jobCard", "order"]);
  const detailPayload = Object.fromEntries(
    Object.entries(resolved).filter(([k]) => !EXCLUDE_FROM_DETAILS.has(k))
  );

  return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Audit event details">
    <button type="button" aria-label="Close audit details" className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm" onClick={onClose} />
    <aside className="animate-slide-in-right relative flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
      <header className="flex items-start justify-between border-b border-border/60 px-5 py-4"><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Audit event</p><h2 className="mt-1 text-lg font-bold text-foreground">{event.action}</h2><p className="mt-1 text-[11px] text-muted-foreground">{formatTimestamp(event.at)}</p></div><button type="button" onClick={onClose} aria-label="Close audit details" className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground"><X size={15} /></button></header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex flex-wrap gap-2"><span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">{event.category}</span><span className={cn("rounded-full border px-2 py-1 text-[9px] font-semibold", event.severity === "critical" ? "border-danger/30 bg-danger/10 text-danger" : event.severity === "warning" ? "border-gold/30 bg-gold/10 text-gold" : "border-success/30 bg-success/10 text-success")}>{event.severity}</span></div>
        <section className="grid gap-4 rounded-xl border border-border/60 bg-background/30 p-4 sm:grid-cols-2"><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Performed by</p><p className="mt-1 text-sm font-semibold text-foreground">{event.actorName}</p><p className="text-[10px] text-muted-foreground capitalize">{event.actorRole.replaceAll("_", " ")}</p></div><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Date &amp; time</p><p className="mt-1 text-sm font-semibold text-foreground">{formatTimestamp(event.at)}</p></div></section>
        <section><h3 className="mb-2 text-xs font-semibold text-foreground">What happened</h3><div className="rounded-xl border border-border/60 bg-background/30 p-4"><p className="text-sm font-medium text-foreground">{event.summary}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{event.detail}</p>{changedFieldsSummary && <p className="mt-3 text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">Settings updated:</span> {changedFieldsSummary}</p>}</div></section>
        {(hasAssociated || Object.keys(linkedNames).length > 0) && <section><h3 className="mb-2 text-xs font-semibold text-foreground">Linked records</h3><div className="grid gap-2 sm:grid-cols-2">{Object.entries(linkedNames).map(([label, name]) => <div key={label} className="rounded-lg border border-border/50 bg-background/20 px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-[11px] font-medium text-foreground">{name}</p></div>)}{hasAssociated && Object.keys(linkedNames).length === 0 && Object.entries(event.associated ?? {}).filter(([, v]) => v).map(([key]) => <div key={key} className="rounded-lg border border-border/50 bg-background/20 px-3 py-2"><p className="text-[9px] uppercase tracking-wider text-muted-foreground">{ASSOCIATED_LABELS[key] ?? humaniseKey(key)}</p><p className="mt-1 text-[10px] text-muted-foreground italic">Reference recorded</p></div>)}</div></section>}
        <section><h3 className="mb-2 text-xs font-semibold text-foreground">Event details</h3><PayloadRows resolvedPayload={detailPayload} /></section>
      </div>
      <footer className="border-t border-border/60 px-5 py-3"><p className="text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">Read-only owner audit view</p></footer>
    </aside>
  </div>;
}

export default function OwnerAuditLogsPage() {
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [category, setCategory] = useState("all");
  const [actor, setActor] = useState("all");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const bounds = useMemo(() => dateBounds(preset, from, to), [preset, from, to]);
  const result = useQuery(api.owner.audit.getAuditSummary, { ...bounds, category, actor, search: search.trim() || undefined, offset, limit: 40 });
  const activeCount = [preset !== "all", category !== "all", actor !== "all", Boolean(search.trim())].filter(Boolean).length;
  const clearFilters = () => { setPreset("all"); setFrom(""); setTo(""); setCategory("all"); setActor("all"); setSearch(""); setOffset(0); };
  const exportCsv = () => {
    if (!result?.events.length) return;
    const header = ["Timestamp", "Category", "Action", "Actor", "Role", "Summary", "Detail", "Severity"];
    const rows = result.events.map((event) => [formatTimestamp(event.at), event.category, event.action, event.actorName, event.actorRole, event.summary, event.detail, event.severity]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const printPdf = () => window.print();

  if (result === undefined) return <div className="flex h-[70vh] items-center justify-center"><InventoryLoader label="Loading Audit Logs…" /></div>;
  return <div className="space-y-6 print:bg-white">
    <OwnerPageHeader kicker="Audit Logs · የእንቅስቃሴ መዝገብ" title="Audit Logs" subtitle={`${result.total} matching events · Filter and inspect system activity.`} />
    <Panel>
      <PanelHeader title="Search and filters" subtitle="Find activity by time, domain, user, or event details." kicker={activeCount ? `${activeCount} active` : "All activity"} icon={<Filter size={16} />} />
      <div className="space-y-3 border-b border-border/60 p-4">
        <div className="flex flex-wrap gap-2">{(["all", "today", "yesterday", "7d", "30d", "month"] as Preset[]).map((item) => <button key={item} type="button" onClick={() => { setPreset(item); setOffset(0); }} className={cn("rounded-full border px-3 py-1.5 text-[10px] font-semibold", preset === item ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{({ all: "All time", today: "Today", yesterday: "Yesterday", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month" } as Record<Preset, string>)[item]}</button>)}</div>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]">
          <label className="text-[10px] text-muted-foreground">From<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPreset("custom" as Preset); setOffset(0); }} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" /></label>
          <label className="text-[10px] text-muted-foreground">To<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPreset("custom" as Preset); setOffset(0); }} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" /></label>
          <label className="text-[10px] text-muted-foreground">Category<select value={category} onChange={(event) => { setCategory(event.target.value); setOffset(0); }} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground">{categories.map((item) => <option key={item} value={item}>{item === "all" ? "All actions" : item}</option>)}</select></label>
          <label className="text-[10px] text-muted-foreground">User / role<select value={actor} onChange={(event) => { setActor(event.target.value); setOffset(0); }} className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"><option value="all">All users</option>{(result.roles ?? []).map((role) => <option key={`role-${role}`} value={`role:${role}`}>All {role.replaceAll("_", " ")}s</option>)}{(result.users ?? []).map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select></label>
          <button type="button" onClick={clearFilters} className="mt-4 inline-flex h-9 items-center justify-center gap-1 rounded-md border border-border px-3 text-[10px] font-semibold text-muted-foreground hover:text-foreground"><X size={12} /> Clear</button>
        </div>
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0); }} placeholder="Search materials, job IDs, actors, event types, or reason tags…" className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs text-foreground outline-none focus:border-primary" /></div>
      </div>
    </Panel>

    <Panel>
      <PanelHeader title="Activity timeline" subtitle="Latest activity first. Select an entry for full metadata." kicker={`${result.events.length} shown`} icon={<History size={16} />} />
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3"><p className="text-[11px] text-muted-foreground">{activeCount ? `${activeCount} filters active` : "No filters applied"}</p><div className="flex gap-2"><button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"><Download size={12} /> CSV</button><button type="button" onClick={printPdf} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground"><FileText size={12} /> PDF / Print</button></div></div>
      {result.events.length === 0 ? <p className="p-8 text-center text-xs text-muted-foreground">No activity matches these filters.</p> : <ol className="divide-y divide-border/60">{result.events.map((event) => <li key={event.id}><button type="button" onClick={() => setSelected(event)} className="flex w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/10"><span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", event.severity === "critical" ? "bg-danger/10 text-danger" : event.severity === "warning" ? "bg-gold/10 text-gold" : "bg-primary/10 text-primary")}>{event.severity === "critical" ? <ShieldAlert size={14} /> : event.severity === "warning" ? <AlertTriangle size={14} /> : <Activity size={14} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">{event.category}</span><span className="text-[11px] font-semibold text-foreground">{event.action}</span><time className="ml-auto font-mono text-[9px] tabular-nums text-muted-foreground">{formatTimestamp(event.at)}</time></div><p className="mt-2 text-[12px] font-medium text-foreground">{event.summary}</p><p className="mt-1 text-[11px] text-muted-foreground">{event.detail}</p><p className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><UserRound size={11} /> By: {event.actorName} ({event.actorRole})</p></div></button></li>)}</ol>}
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3"><p className="text-[10px] text-muted-foreground">Showing {result.events.length ? offset + 1 : 0}–{offset + result.events.length} of {result.total}</p><div className="flex gap-2"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 40))} className="rounded-md border border-border px-3 py-1.5 text-[10px] disabled:opacity-40">Previous</button><button type="button" disabled={!result.hasMore} onClick={() => setOffset(offset + 40)} className="rounded-md border border-border px-3 py-1.5 text-[10px] disabled:opacity-40">Next</button></div></div>
    </Panel>
    <EventDrawer event={selected} onClose={() => setSelected(null)} />
  </div>;
}
