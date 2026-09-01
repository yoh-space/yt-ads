"use client";

import {
  AlertTriangle,
  Box,
  CircleAlert,
  ClipboardList,
  Command,
  Factory,
  MoreHorizontal,
  MoveUpRight,
  Printer,
  Scissors,
  TrendingUp,
  Wallet,
  Coins,
} from "lucide-react";
import type { CustomerOrder, JobCard, Machine, Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { statusTone } from "../helpers";
import type { View } from "../nav-config";
import { Button, StatCard, Panel, PanelHeader, StatusPill } from "@/components/ui";
import { cn } from "@/lib/utils";

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

function formatEtb(value: number): string {
  return `${ETB_FORMAT.format(Math.round(value))} ETB`;
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
  return (
    <>
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
      ) : (
        <section className="grid grid-cols-4 gap-[14px] mb-[18px]" aria-label="Operational overview cards">
          <StatCard
            variant="sales"
            icon={<ClipboardList size={20} />}
            label="ዛሬ የተመዘገቡ ትዕዛዞች · TODAY'S ORDERS"
            value={String(orderStats.todaysOrders)}
            description="ዛሬ የመጡ የደንበኛ ትዕዛዞች ብዛት"
            metadata={`${orderStats.queueOrders} queued · ${orderStats.activeProductionOrders} in production today`}
          />

          <StatCard
            variant="cost"
            icon={<Factory size={20} />}
            label="ንቁ ማሽኖች · ACTIVE MACHINES"
            value={String(machines.filter((m) => m.status === "Running").length)}
            description="በአሁኑ ጊዜ በስራ ላይ ያሉ ማሽኖች"
            metadata={`${machines.length} total registered machines`}
          />

          <StatCard
            variant="profit"
            icon={<Scissors size={20} />}
            label="ንቁ የሥራ ካርዶች · ACTIVE JOBS"
            value={String(jobs.filter((job) => job.status !== "Completed").length)}
            description="ሊጠናቀቁ ያሉ የሥራ ካርዶች"
            metadata={`${jobs.filter((job) => job.status === "In production").length} in production now`}
          />

          <StatCard
            variant="alert"
            icon={<AlertTriangle size={20} />}
            label="ዝቅተኛ ክምችት · LOW STOCK"
            value={String(lowStock.length)}
            description="ከመደበኛ ደረጃ በታች ያሉ እቃዎች"
            metadata="Reorder levels apply · no financial values shown for this role"
          />
        </section>
      )}

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
            <div className="grid grid-cols-[minmax(190px,1.8fr)_0.7fr_1.25fr_0.85fr_30px] gap-[9px] items-center px-[17px] py-2 text-[#92a2ab] bg-[#f8fafb] font-mono text-[9px] tracking-[0.3px]">
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
                    className="grid grid-cols-[minmax(190px,1.8fr)_0.7fr_1.25fr_0.85fr_30px] gap-[9px] items-center px-[17px] py-[11px] border-t border-[#edf2f4] text-[#5b7280] text-[10px]"
                  >
                    <div className="flex flex-col gap-[3px]">
                      <b className="text-[#294b5f] font-mono font-bold text-[10px]">{job.code}</b>
                      <span className="text-[#80939e] text-[9px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {job.client} · {job.title}
                      </span>
                    </div>
                    <span>{machine?.code}</span>
                    <span>{material?.name}</span>
                    <StatusPill variant={statusTone(job.status)}>{job.status}</StatusPill>
                    <button
                      className="grid place-items-center w-[34px] h-[34px] border-0 rounded-[7px] bg-transparent text-[#48606f] transition-[0.18s] hover:bg-[#e4f1f4] hover:text-navy"
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
                  className="grid grid-cols-[25px_minmax(100px,1fr)_80px_28px] gap-2 items-center py-[9px] border-b border-[#edf2f4] last:border-b-0"
                >
                  <div className={cn(
                    "grid place-items-center w-[25px] h-[25px] rounded-md text-[#078399] bg-[#e2f8fa]",
                    {
                      "text-[#a97009] bg-[#fff5df]": material.accent === "gold",
                      "text-[#725bbc] bg-[#eee9ff]": material.accent === "violet", 
                      "text-[#3a74ca] bg-[#e8f1ff]": material.accent === "blue",
                      "text-[#398e70] bg-[#e7f7ef]": material.accent === "green",
                    }
                  )}>
                    <Box size={15} />
                  </div>
                  <div className="min-w-0">
                    <strong className="block text-[10px] text-[#405d6c] whitespace-nowrap overflow-hidden text-ellipsis">
                      {material.name}
                    </strong>
                    <span className="block mt-[3px] text-[#92a2ab] text-[11px]">
                      {formatQuantity(material.quantity, material.unit)} on hand · {formatQuantity(consumed, material.unit)} used 30d
                    </span>
                  </div>
                  <div className="h-[10px] rounded-md bg-[#edf2f4] overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#83cbd2] to-[#2b8a9c] transition-[width] duration-300"
                      style={{ width: `${utilWidth}%` }}
                    />
                  </div>
                  <span className="text-[#66808e] font-mono text-[11px]">{utilizationPct}%</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>
      {/* Machine Workflow & Alerts - Main Grid */}
      <section className="grid grid-cols-[1.55fr_1fr] gap-[14px]">
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
            <div className="flex flex-col items-center p-[9px_4px] border border-[#e4edf1] rounded-[7px] bg-[#f8fafb] text-center">
              <strong className="text-[#294b5b] font-bold text-lg leading-none tracking-[-0.5px]">{machines.length}</strong>
              <span className="mt-[3px] text-[#82949e] text-[9px] font-semibold uppercase tracking-[0.3px]">Total</span>
            </div>
            <div className="flex flex-col items-center p-[9px_4px] border border-[#b8eaef] rounded-[7px] bg-[#edf9fa] text-center">
              <strong className="text-[#08798b] font-bold text-lg leading-none tracking-[-0.5px]">
                {machines.filter((m) => m.status === "Running").length}
              </strong>
              <span className="mt-[3px] text-[#82949e] text-[9px] font-semibold uppercase tracking-[0.3px]">Running</span>
            </div>
            <div className="flex flex-col items-center p-[9px_4px] border border-[#c5e6d8] rounded-[7px] bg-[#eef8f3] text-center">
              <strong className="text-[#2f916d] font-bold text-lg leading-none tracking-[-0.5px]">
                {machines.filter((m) => m.status === "Available").length}
              </strong>
              <span className="mt-[3px] text-[#82949e] text-[9px] font-semibold uppercase tracking-[0.3px]">Available</span>
            </div>
            <div className="flex flex-col items-center p-[9px_4px] border border-[#f0d5c8] rounded-[7px] bg-[#fdf2ee] text-center">
              <strong className="text-[#c86256] font-bold text-lg leading-none tracking-[-0.5px]">
                {machines.filter((m) => m.status === "Maintenance").length}
              </strong>
              <span className="mt-[3px] text-[#82949e] text-[9px] font-semibold uppercase tracking-[0.3px]">Maintenance</span>
            </div>
            <div className="flex flex-col items-center p-[9px_4px] border border-[#e8d0d0] rounded-[7px] bg-[#faf5f5] text-center">
              <strong className="text-[#b84440] font-bold text-lg leading-none tracking-[-0.5px]">
                {machines.filter((m) => m.status === "Unavailable").length}
              </strong>
              <span className="mt-[3px] text-[#82949e] text-[9px] font-semibold uppercase tracking-[0.3px]">Unavailable</span>
            </div>
          </div>
          
          {/* Machine List */}
          <div className="px-[17px] pb-2">
            {machines.map((machine) => (
              <div key={machine.id} className="grid grid-cols-[30px_minmax(0,1fr)_auto_auto] gap-[9px] items-center py-2 border-b border-[#edf2f4] last:border-b-0">
                <div className={cn(
                  "grid place-items-center w-7 h-7 rounded-md bg-[#eff5f7] text-[#607c8e]",
                  {
                    "text-[#08798b] bg-[#e0f8fa]": machine.status === "Running"
                  }
                )}>
                  {machine.type.includes("Laser") ? <Scissors size={16} /> : machine.type.includes("Printer") ? <Printer size={16} /> : <Command size={16} />}
                </div>
                <div className="flex flex-col gap-[1px] min-w-0">
                  <div className="flex items-baseline gap-[6px]">
                    <strong className="text-[#29495b] text-[11px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {machine.name}
                    </strong>
                    <span className="text-[#91a1ab] font-mono text-[9px]">{machine.code}</span>
                  </div>
                  <span className="text-[#82949e] text-[9px]">{machine.type}</span>
                </div>
                <StatusPill variant={statusTone(machine.status)}>{machine.status}</StatusPill>
                <span className="text-[#82949e] font-mono text-[9px] text-right whitespace-nowrap">
                  {machine.activeJob || "—"}
                </span>
              </div>
            ))}
          </div>
        </Panel>

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
              <div key={material.id} className="flex gap-[9px] items-center py-[10px] border-b border-[#edf2f4] last:border-b-0">
                <span className="flex-none grid place-items-center w-[27px] h-[27px] rounded-[7px] text-[#c66f4c] bg-[#fff1e8]">
                  <AlertTriangle size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block text-[#3c5868] text-[10px]">{material.name}</strong>
                  <span className="block mt-[3px] text-[#899ba5] text-[9px] leading-[1.3]">
                    {formatQuantity(material.quantity, material.unit)} remains · reorder at {formatQuantity(material.reorderAt, material.unit)}
                  </span>
                </div>
                <Button variant="text" onClick={() => onView("inventory")}>
                  Review
                </Button>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="text-center py-[23px] text-[#99aab3] text-[11px]">
                አሁን ላይ የተገኘ የክምችት ማስጠንቀቂያ የለም
              </div>
            )}
          </div>
        </Panel>
      </section>
    </>
  );
}