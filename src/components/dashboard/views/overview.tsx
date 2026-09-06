"use client";

import {
  AlertTriangle,
  Box,
  CheckCircle2,
  CircleAlert,
  Clock,
  Command,
  CreditCard,
  MoreHorizontal,
  MoveUpRight,
  Printer,
  Scissors,
  ShoppingBag,
  TrendingUp,
  Wallet,
  Coins,
} from "lucide-react";
import type { CustomerOrder, JobCard, Machine, Material, Role } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { statusTone } from "../helpers";
import type { View } from "@/types/dashboard-types";
import { StockoutAlertWidget } from "./stockout-alert-widget";
import {
  Button,
  StatCard,
  Panel,
  PanelHeader,
  StatusPill,
  MetricChart,
  MicroHistogram,
  SegmentedProgress,
  StatusNode,
  SectionLabel,
  MetricValue,
} from "@/components/ui";
import { cn } from "@/lib/utils";

function machineUptime(status: Machine["status"]): number {
  if (status === "Running") return 100;
  if (status === "Available") return 97;
  if (status === "Maintenance") return 58;
  return 12;
}

function uptimeTone(pct: number): "emerald" | "cyan" | "amber" | "rose" {
  if (pct >= 90) return "emerald";
  if (pct >= 70) return "cyan";
  if (pct >= 50) return "amber";
  return "rose";
}

function nodeTone(status: Machine["status"]): "active" | "idle" | "warning" | "down" {
  if (status === "Running") return "active";
  if (status === "Available") return "idle";
  if (status === "Maintenance") return "warning";
  return "down";
}

export type FinancialMetrics = {
  todaysSales: number;
  todaysMaterialCost: number;
  todaysNetProfit: number;
  auditedStockLoss: number;
  todaysOrderCount: number;
  todaysJobCount: number;
  auditedShortageCount: number;
  generatedAt: number;
};

const ETB_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export type Kpis = {
  todaysOrdersCount: number;
  yesterdayOrdersCount: number;
  inProductionCount: number;
  pendingPaymentCount: number;
  pendingPaymentTotal: number;
  todaysCompletedCount: number;
  yesterdayCompletedCount: number;
  lowStockAlertCount: number;
  expiringSoonCount: number;
  generatedAt: number;
};

function formatEtb(value: number): string {
  return `${ETB_FORMAT.format(Math.round(value))} ETB`;
}

function trendLabel(current: number, previous: number): string {
  if (previous <= 0) return current > 0 ? "new vs yesterday" : "no change vs yesterday";
  const delta = current - previous;
  const pct = Math.round((delta / previous) * 100);
  if (delta > 0) return `+${pct}% vs yesterday`;
  if (delta < 0) return `${pct}% vs yesterday`;
  return "flat vs yesterday";
}

export function Overview({
  materials,
  machines,
  jobs,
  orders,
  orderStats,
  materialPulse,
  lowStock,
  stockValue,
  waste,
  reconciliationVariances,
  financialMetrics,
  kpis,
  role,
  onView,
  onFilterJobs,
  onComplete,
}: {
  materials: Material[];
  machines: Machine[];
  jobs: JobCard[];
  orders: CustomerOrder[];
  orderStats: { todaysOrders: number; completedOrders: number; queueOrders: number; activeProductionOrders: number };
  materialPulse: { materialId: string; consumedLast30Days: number; utilizationPct: number }[];
  lowStock: Material[];
  stockValue: number;
  waste: number;
  reconciliationVariances: Array<{ variance: number; monetaryLoss: number }>;
  financialMetrics: FinancialMetrics | null;
  kpis?: Kpis;
  role: Role;
  onView: (view: View) => void;
  onFilterJobs: (status: JobCard["status"] | "open") => void;
  onComplete: (id: string) => void;
}) {
  const todaysSales = financialMetrics?.todaysSales ?? 0;
  const todaysMaterialCost = financialMetrics?.todaysMaterialCost ?? 0;
  const todaysNetProfit = financialMetrics?.todaysNetProfit ?? 0;
  const auditedStockLoss = financialMetrics?.auditedStockLoss ?? 0;
  const todaysOrderCount = financialMetrics?.todaysOrderCount ?? orderStats.todaysOrders;
  const todaysJobCount = financialMetrics?.todaysJobCount ?? 0;
  const auditedShortageCount = financialMetrics?.auditedShortageCount ?? 0;
  const profitNegative = todaysNetProfit < 0;
  const lossPositive = auditedStockLoss > 0;

  const queuedCount = jobs.filter((job) => job.status === "Queued").length;
  const inPrintCount = jobs.filter((job) => job.status === "In production").length;
  const completedTodayCount = kpis?.todaysCompletedCount ?? 0;
  const queueStages = [
    { label: "Queued", value: queuedCount },
    { label: "In Print", value: inPrintCount, active: inPrintCount > 0 },
    { label: "Done Today", value: completedTodayCount, active: inPrintCount === 0 && completedTodayCount > 0 },
  ];
  const quotaDenominator = queuedCount + inPrintCount + completedTodayCount;
  const quotaPace = quotaDenominator > 0 ? (completedTodayCount / quotaDenominator) * 100 : 0;
  const fleetUptime = machines.length
    ? machines.reduce((total, machine) => total + machineUptime(machine.status), 0) / machines.length
    : 0;

  return (
    <>
      {/* Financial Status Overview (owner only) */}
      {financialMetrics ? (
        <section className="grid grid-cols-4 gap-[14px] mb-[18px]" aria-label="Financial oversight executive cards">
          <StatCard
            variant="sales"
            icon={<Wallet size={20} />}
            label="የዛሬ ጠቅላላ ሽያጭ · TODAY'S TOTAL SALES"
            value={formatEtb(todaysSales)}
            description="የዛሬ የተመዘገቡ የደንበኛ ትዕዛዞች አጠቃላይ የገንዘብ እሴት (ETB)"
            metadata={`${todaysOrderCount} order${todaysOrderCount === 1 ? "" : "s"} created today · live revenue feed`}
          />

          <StatCard
            variant="cost"
            icon={<Coins size={20} />}
            label="የወጣ ጥሬ ዕቃ ወጪ · PRODUCTION MATERIAL COST"
            value={formatEtb(todaysMaterialCost)}
            description="ዛሬ ለሥራ ካርዶች የተሰጠ ጥሬ ዕቃ ወጪ (በመሠረታዊ ዋጋ)"
            metadata={`${todaysJobCount} job card${todaysJobCount === 1 ? "" : "s"} processed today · ETB per base unit`}
          />

          <StatCard
            variant="profit"
            icon={<TrendingUp size={20} />}
            label="የተጣራ የትርፍ ግምት · ESTIMATED NET PROFIT"
            value={profitNegative ? `-${formatEtb(Math.abs(todaysNetProfit))}` : formatEtb(todaysNetProfit)}
            description="ሽያጭ − የጥሬ ዕቃ ወጪ · የቀን ዋና የፋይናንስ አፈጻጸም አመልካች"
            metadata={`Sales ${formatEtb(todaysSales)} − Material ${formatEtb(todaysMaterialCost)}`}
            isNegative={profitNegative}
          />

          <StatCard
            variant="alert"
            icon={<AlertTriangle size={20} />}
            label="በብክነት የጎደለ ሀብት · AUDITED STOCK LOSS"
            value={lossPositive ? `-${formatEtb(auditedStockLoss)}` : "0 ETB"}
            description="ከቅርብ ጊዜ የክምችት ኦዲት (ሪኮንሲሌሽን) የተገኘ አጠቃላይ የገንዘብ ኪሣራ"
            metadata={`${auditedShortageCount} material${auditedShortageCount === 1 ? "" : "s"} with negative count variance`}
            isAlert={lossPositive}
            isNegative={lossPositive}
          />
        </section>
      ) : null}

      {/* Operational KPI Grid (real-time insights) */}
      {kpis ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-[18px]" aria-label="Operational KPI cards">
          <StatCard
            interactive
            onClick={() => onView("orders")}
            icon={<ShoppingBag size={20} />}
            label="TODAY'S NEW ORDERS"
            value={String(kpis.todaysOrdersCount)}
            description="ንቁ የትዕዛዝ ፍሰት እየተመዘገበ"
            metadata={trendLabel(kpis.todaysOrdersCount, kpis.yesterdayOrdersCount)}
          />

          <StatCard
            interactive
            onClick={() => onView("orders")}
            variant="cost"
            icon={<Printer size={20} />}
            label="IN PRODUCTION"
            value={String(kpis.inProductionCount)}
            description="በኦፕሬተር ማሽኖች ላይ በመስራት ላይ ያሉ ትዕዛዞች"
            metadata={`${orderStats.activeProductionOrders} active on machines now`}
          />

          {role === "owner" ? (
            <StatCard
              interactive
              onClick={() => onView("orders")}
              variant="cost"
              icon={<CreditCard size={20} />}
              label="PENDING PAYMENT / CREDIT"
              value={String(kpis.pendingPaymentCount)}
              description="ክፍያ የሚጠብቁ ወይም የጸደቀ ብዕር ያላቸው ትዕዛዞች"
              metadata={`${formatEtb(kpis.pendingPaymentTotal)} outstanding`}
            />
          ) : null}

          <StatCard
            interactive
            onClick={() => onView("orders")}
            variant="profit"
            icon={<CheckCircle2 size={20} />}
            label="TODAY'S COMPLETED"
            value={String(kpis.todaysCompletedCount)}
            description="ዛሬ የተጠናቀቁ ትዕዛዞች"
            metadata={trendLabel(kpis.todaysCompletedCount, kpis.yesterdayCompletedCount)}
          />

          <StatCard
            interactive
            onClick={() => onView("inventory")}
            variant="alert"
            icon={<AlertTriangle size={20} />}
            label="LOW STOCK ALERT"
            value={String(kpis.lowStockAlertCount)}
            description="ከደረጃ በታች ያሉ የክምችት ዕቃዎች (parent & operator stock)"
            metadata={`${lowStock.length} materials at reorder level`}
            isAlert={kpis.lowStockAlertCount > 0}
          />

          <StatCard
            interactive
            onClick={() => onView("orders")}
            variant="alert"
            icon={<Clock size={20} />}
            label="EXPIRING SOON"
            value={String(kpis.expiringSoonCount)}
            description="የክፍያ ጊዜያቸው እየተቃረበ ያሉ ትዕዛዞች"
            metadata="Within the next 24 hours"
            isAlert={kpis.expiringSoonCount > 0}
          />
        </section>
      ) : null}

      {/* Press Floor Telemetry Widgets */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[14px]" aria-label="Press floor telemetry widgets">
        <MetricChart
          label="ACTIVE PRODUCTION QUEUE"
          live
          footer={`${queuedCount + inPrintCount} cards in flow · ${completedTodayCount} cleared today`}
        >
          <MicroHistogram data={queueStages} height={64} />
        </MetricChart>

        <MetricChart
          label="OUTPUT VOLUME"
          value={`${quotaPace.toFixed(1)}%`}
          sublabel="Daily Quota Pace"
          accent="emerald"
          footer={`${completedTodayCount}/${quotaDenominator} units against quota`}
        >
          <div className="flex flex-col gap-[7px]">
            <SegmentedProgress value={quotaPace} tone="emerald" segments={20} />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Quota fill</span>
              <MetricValue size="sm" tone="positive">{`${quotaPace.toFixed(1)}%`}</MetricValue>
            </div>
          </div>
        </MetricChart>

        <MetricChart
          label="MACHINE FLEET UPTIME"
          value={`${fleetUptime.toFixed(0)}%`}
          sublabel="Fleet average"
          accent="cyan"
          footer={`${machines.filter((m) => m.status === "Running").length}/${machines.length} machines running`}
        >
          <div className="flex flex-col gap-[10px]">
            {machines.map((machine) => {
              const uptime = machineUptime(machine.status);
              const tone = uptimeTone(uptime);
              return (
                <div key={machine.id} className="flex items-center gap-[10px]">
                  <StatusNode tone={nodeTone(machine.status)} pulse={machine.status === "Running"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11px] font-semibold text-foreground truncate">{machine.name}</span>
                      <span className="font-mono text-[10px] font-bold tabular-nums text-foreground">{uptime}%</span>
                    </div>
                    <SegmentedProgress
                      value={uptime}
                      tone={tone}
                      height="thin"
                      segments={12}
                      className="mt-[4px]"
                    />
                  </div>
                </div>
              );
            })}
            {machines.length === 0 ? (
              <SectionLabel tone="muted">No machines registered</SectionLabel>
            ) : null}
          </div>
        </MetricChart>
      </section>

      {/* Real-time Stockout Forecast & Depletion Radar */}
      <section className="mb-[14px]">
        <StockoutAlertWidget
          canViewFinancial={role === "owner"}
          onNavigateToInventory={() => onView("inventory")}
        />
      </section>

      {/* Job Board & Material Pulse - Bottom Grid */}
      <section className="grid grid-cols-[1.55fr_1fr] gap-[14px] mb-[14px]">
        <Panel>
          <PanelHeader
            kicker="JOB BOARD"
            title="ንቁ የሥራ ካርዶች"
            subtitle="Current production queue"
            action={
              <Button variant="text" onClick={() => onView("jobs")}>
                Open job board <MoveUpRight size={15} />
              </Button>
            }
          />
          <div className="overflow-x-auto">
            <div className="grid grid-cols-[minmax(190px,1.8fr)_0.7fr_1.25fr_0.85fr_30px] gap-[9px] items-center px-[17px] py-2 text-muted-foreground bg-[#0b1220] font-mono text-[9px] font-semibold uppercase tracking-[0.16em]">
              <span>JOB / CLIENT</span>
              <span>MACHINE</span>
              <span>MATERIAL</span>
              <span>STATUS</span>
              <span />
            </div>
            {jobs
              .filter((job) => job.status !== "Completed")
              .slice(0, 4)
              .map((job) => {
                const machine = machines.find((item) => item.id === job.machineId);
                const material = materials.find((item) => item.id === job.materialId);
                return (
                  <div
                    key={job.id}
                    className="grid grid-cols-[minmax(190px,1.8fr)_0.7fr_1.25fr_0.85fr_30px] gap-[9px] items-center px-[17px] py-[11px] border-t border-[#16202f] text-muted-foreground text-[10px]"
                  >
                    <div className="flex flex-col gap-[3px]">
                      <b className="text-foreground font-mono font-bold text-[10px] tracking-[0.08em]">{job.code}</b>
                      <span className="text-muted-foreground text-[9px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {job.client} · {job.title}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums">{machine?.code}</span>
                    <span>{material?.name}</span>
                    <StatusPill variant={statusTone(job.status)}>{job.status}</StatusPill>
                    <button
                      className="grid place-items-center w-[34px] h-[34px] border-0 rounded-[7px] bg-transparent text-muted-foreground transition-[0.18s] hover:bg-[#16202f] hover:text-foreground"
                      onClick={() => job.status === "In production" && onComplete(job.id)}
                      aria-label="Complete job"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </div>
                );
              })}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            kicker="MATERIAL PULSE"
            title="ከፍተኛ መጠቀም ላይ ያሉ እቃዎች"
            subtitle="Material utilization"
            action={
              <Button variant="text" onClick={() => onView("inventory")}>
                Inventory <MoveUpRight size={15} />
              </Button>
            }
          />
          <div className="px-[17px] py-[7px]">
            {materials.slice(0, 4).map((material) => {
              const pulse = materialPulse.find((entry) => entry.materialId === material.id);
              const utilizationPct = pulse?.utilizationPct ?? 0;
              const utilWidth = Math.min(100, Math.max(0, utilizationPct));
              const consumed = pulse?.consumedLast30Days ?? 0;
              return (
                <div
                  key={material.id}
                  className="grid grid-cols-[25px_minmax(100px,1fr)_80px_28px] gap-2 items-center py-[9px] border-b border-[#16202f] last:border-b-0"
                >
                  <div className={cn(
                    "grid place-items-center w-[25px] h-[25px] rounded-md bg-cyan/15 text-cyan",
                    {
                      "bg-gold/18 text-gold": material.accent === "gold",
                      "bg-violet/18 text-violet": material.accent === "violet",
                      "bg-blue/18 text-blue": material.accent === "blue",
                      "bg-green/18 text-green": material.accent === "green",
                    }
                  )}>
                    <Box size={15} />
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-[10px] text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                      {material.name}
                    </strong>
                    <span className="block mt-[3px] text-muted-foreground text-[11px]">
                      {formatQuantity(material.quantity, material.unit)} on hand · {formatQuantity(consumed, material.unit)} used 30d
                    </span>
                  </div>
                  <div className="h-[10px] rounded-full bg-[#0b1220] border border-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#00B4D8] to-[#38B000] shadow-[0_0_8px_rgba(0,180,216,0.5)] transition-[width] duration-300"
                      style={{ width: `${utilWidth}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums">{utilizationPct}%</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
      {/* Machine Workflow & Alerts - Main Grid */}
      <section className={cn("grid gap-[14px]", role === "owner" ? "grid-cols-1" : "grid-cols-[1.55fr_1fr]")}>
        {role === "owner" ? null : (
          <Panel>
            <PanelHeader
              kicker="MACHINE WORKFLOW"
              title="የማሽን የሥራ ሁኔታ"
              subtitle="Machine workflow status"
              action={
                <Button variant="text" onClick={() => onView("machines")}>
                  View all <MoveUpRight size={14} />
                </Button>
              }
            />
          {/* Machine Status Strip */}
          <div className="grid grid-cols-5 gap-2 px-[17px] pt-1 pb-[10px]">
            <div className="flex flex-col items-center p-[9px_4px] border border-[#1e293b] rounded-[7px] bg-[#0b1220] text-center">
              <strong className="text-foreground font-bold text-lg leading-none tracking-[-0.5px] font-mono tabular-nums">{machines.length}</strong>
              <span className="mt-[3px] text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.3px] font-mono">Total</span>
            </div>
            <div className="flex flex-col items-center p-[9px_4px] border border-cyan/30 rounded-[7px] bg-cyan/10 text-center">
              <strong className="text-cyan font-bold text-lg leading-none tracking-[-0.5px] font-mono tabular-nums">
                {machines.filter((m) => m.status === "Running").length}
              </strong>
              <span className="mt-[3px] text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.3px] font-mono">Running</span>
            </div>
            <div className="flex flex-col items-center p-[9px_4px] border border-emerald-800/60 rounded-[7px] bg-emerald-950/40 text-center">
              <strong className="text-emerald-400 font-bold text-lg leading-none tracking-[-0.5px] font-mono tabular-nums">
                {machines.filter((m) => m.status === "Available").length}
              </strong>
              <span className="mt-[3px] text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.3px] font-mono">Available</span>
            </div>
            <div className="flex flex-col items-center p-[9px_4px] border border-amber-800/60 rounded-[7px] bg-amber-950/40 text-center">
              <strong className="text-amber-400 font-bold text-lg leading-none tracking-[-0.5px] font-mono tabular-nums">
                {machines.filter((m) => m.status === "Maintenance").length}
              </strong>
              <span className="mt-[3px] text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.3px] font-mono">Maintenance</span>
            </div>
            <div className="flex flex-col items-center p-[9px_4px] border border-rose-800/60 rounded-[7px] bg-rose-950/40 text-center">
              <strong className="text-rose-400 font-bold text-lg leading-none tracking-[-0.5px] font-mono tabular-nums">
                {machines.filter((m) => m.status === "Unavailable").length}
              </strong>
              <span className="mt-[3px] text-muted-foreground text-[9px] font-semibold uppercase tracking-[0.3px] font-mono">Unavailable</span>
            </div>
          </div>
          
          {/* Machine List */}
          <div className="px-[17px] pb-2">
            {machines.map((machine) => (
              <div key={machine.id} className="grid grid-cols-[30px_minmax(0,1fr)_auto_auto] gap-[9px] items-center py-2 border-b border-[#16202f] last:border-b-0">
                <div className={cn(
                  "grid place-items-center w-7 h-7 rounded-md bg-[#0b1220] text-muted-foreground border border-[#1e293b]",
                  {
                    "text-cyan bg-cyan/15 border-cyan/30": machine.status === "Running"
                  }
                )}>
                  {machine.type.includes("Laser") ? <Scissors size={16} /> : machine.type.includes("Printer") ? <Printer size={16} /> : <Command size={16} />}
                </div>
                <div className="flex flex-col gap-[1px] min-w-0">
                  <div className="flex items-baseline gap-[6px]">
                    <strong className="text-foreground text-[11px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {machine.name}
                    </strong>
                    <span className="text-muted-foreground font-mono text-[9px] tracking-[0.08em]">{machine.code}</span>
                  </div>
                  <span className="text-muted-foreground text-[9px]">{machine.type}</span>
                </div>
                <StatusPill variant={statusTone(machine.status)}>{machine.status}</StatusPill>
                <span className="text-muted-foreground font-mono text-[9px] text-right whitespace-nowrap tabular-nums">
                  {machine.activeJob || "—"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
        )}

        <Panel>
          <PanelHeader
            kicker="ATTENTION"
            kickerVariant="coral"
            title="የቁጥጥር ማሳሰቢያዎች"
            subtitle="Discrepancies & stock alerts"
            icon={<CircleAlert size={20} />}
          />
          <div className="px-[13px] py-[6px_13px_9px]">
            {lowStock.map((material) => (
              <div key={material.id} className="flex gap-[9px] items-center py-[10px] border-b border-[#16202f] last:border-b-0">
                <span className="flex-none grid place-items-center w-[27px] h-[27px] rounded-[7px] bg-coral/15 text-danger border border-rose-800/60">
                  <AlertTriangle size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-foreground text-[10px]">{material.name}</strong>
                  <span className="block mt-[3px] text-muted-foreground text-[9px] leading-[1.3]">
                    {formatQuantity(material.quantity, material.unit)} remains · reorder at {formatQuantity(material.reorderAt, material.unit)}
                  </span>
                </div>
                <Button variant="text" onClick={() => onView("inventory")}>
                  Review
                </Button>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="text-center py-[23px] text-muted-foreground text-[11px]">
                አሁን ላይ የተገኘ የክምችት ማስጠንቀቂያ የለም
              </div>
            )}
          </div>
        </Panel>
      </section>
    </>
  );
}