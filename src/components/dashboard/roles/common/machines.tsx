"use client";

import { Command, Eye, Printer, Scissors, Settings, Trash2, Wrench } from "lucide-react";
import type { JobCard, Machine, MachineStatus, Role } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { roleLabels } from "@/lib/operations-types";
import type { View } from "@/types/dashboard-types";
import { cn } from "@/lib/utils";

export function MachinesView({
  machines,
  jobs,
  role,
  canCreateMachine,
  canCreateOffcut,
  canCreateScrap,
  canComplete,
  canUpdateMachine,
  canDeleteMachine,
  onCreate,
  onOffcut,
  onScrap,
  onComplete,
  onRecordProduction,
  onAssignNextJob,
  onSettings,
  onStatusChange,
  onView,
  isPending,
}: {
  machines: Machine[];
  jobs: JobCard[];
  role: Role;
  canCreateMachine: boolean;
  canCreateOffcut: boolean;
  canCreateScrap: boolean;
  canComplete: boolean;
  canUpdateMachine: boolean;
  canDeleteMachine: boolean;
  onCreate: () => void;
  onOffcut: (machineId?: string) => void;
  onScrap: (machineId?: string) => void;
  onComplete: (id: string) => void;
  onRecordProduction: (id: string, inputQuantity: number, outputQuantity: number, wasteQuantity: number) => void;
  onAssignNextJob: (machineId: string) => void;
  onSettings: (machine: Machine) => void;
  onStatusChange?: (machineId: string, status: MachineStatus) => void;
  onView: (view: View) => void;
  isPending: (key: string) => boolean;
}) {

  const context: Record<Role, { action: string; detail: string; unit: string }> = {
    owner: { action: "Oversee operations", detail: "Owner control room", unit: "All units" },
    manager: { action: "Coordinate operations", detail: "Manager control room", unit: "All units" },
    admin: { action: "View machine plan", detail: "Monitor every production lane and active allocation.", unit: "Enterprise view" },
    storekeeper: { action: "Issue material", detail: "Confirm issued quantity against the job card and unit rule.", unit: "Store issue mode" },
    receptionist: { action: "Register customer order", detail: "Take walk-in orders and coordinate design/pricing.", unit: "Reception desk" },
    cashier: { action: "Verify payment", detail: "Verify received customer payments and issue production job cards.", unit: "Cashier desk" },
    designer: { action: "Prepare design artwork", detail: "Design and export production-ready artwork files.", unit: "Design studio" },
    laser_operator: { action: "Measure acrylic offcut", detail: "Record usable acrylic or foam sections in square meters.", unit: "Sheet area m\u00B2" },
    cnc_operator: { action: "Confirm board cut", detail: "Track wood or aluminium sheet output against the assigned job.", unit: "Board area m\u00B2" },
    crystek_operator: { action: "Advance vinyl roll", detail: "Capture roll consumption and plotter output in running meters.", unit: "Roll length m" },
    crystal_jet_operator: { action: "Start print meter", detail: "Record banner usage and print area before final inspection.", unit: "Print area m\u00B2" },
    ricoh_uv_operator: { action: "Run UV print job", detail: "Record UV print output and substrate consumption.", unit: "Print area m\u00B2" },
    dtf_operator: { action: "Load DTF film", detail: "Track DTF transfer print output and film usage.", unit: "Print area m\u00B2" },
  };
  const focus = context[role];
  const primaryMachine = machines[0];
  const isManagement = role === "owner" || role === "manager" || role === "admin" || role === "storekeeper";
  const queuedJobsByMachine = new Map<string, JobCard[]>();
  for (const job of jobs) {
    if (job.status === "Queued") {
      const list = queuedJobsByMachine.get(job.machineId) ?? [];
      list.push(job);
      queuedJobsByMachine.set(job.machineId, list);
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      {isManagement ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="bg-white border border-line rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-navy mb-1">{machines.length}</div>
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">ጠቅላላ</div>
          </div>
          <div className="bg-green/5 border border-green/20 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green mb-1">
              {machines.filter((m) => m.status === "Running").length}
            </div>
            <div className="text-xs font-semibold text-green uppercase tracking-wider">በስራ ላይ</div>
          </div>
          <div className="bg-cyan/5 border border-cyan/20 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-cyan-dark mb-1">
              {machines.filter((m) => m.status === "Available").length}
            </div>
            <div className="text-xs font-semibold text-cyan-dark uppercase tracking-wider">ዝግጁ</div>
          </div>
          <div className="bg-gold/5 border border-gold/20 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gold mb-1">
              {machines.filter((m) => m.status === "Maintenance").length}
            </div>
            <div className="text-xs font-semibold text-gold uppercase tracking-wider">በጥገና ላይ</div>
          </div>
          <div className="bg-coral/5 border border-coral/20 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-coral mb-1">
              {machines.filter((m) => m.status === "Unavailable").length}
            </div>
            <div className="text-xs font-semibold text-coral uppercase tracking-wider">የማይሰራ/የሌለ</div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">የአሠራር ሁኔታ</span>
              <div className="text-lg font-bold text-navy mt-1">{focus.unit}</div>
              <p className="text-sm text-gray-600 mt-1">{focus.action}</p>
            </div>
            {canCreateOffcut && (
              <button 
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border border-line bg-white text-navy transition-colors hover:border-cyan hover:bg-cyan/5"
                onClick={() => onOffcut(primaryMachine.id)}
              >
                {role === "crystek_operator" ? "የቪኒል ቀሪ ይመዝግቡ" : "የሚጠቅም ቀሪ ይመዝግቡ"}
              </button>
            )}
          </div>
        </div>
      )}
      {/* Machine Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {machines.map((machine) => {
          const job = jobs.find((entry) => entry.code === machine.activeJob);
          const nextJobs = queuedJobsByMachine.get(machine.id);
          const nextJob = nextJobs?.[0];
          const cardTone = machine.status === "Running"
            ? "border-emerald-400/35 bg-emerald-950/35"
            : machine.status === "Available"
              ? "border-sky-400/30 bg-sky-950/30"
              : machine.status === "Maintenance"
                ? "border-amber-400/35 bg-amber-950/30"
                : "border-rose-400/35 bg-rose-950/30";
          
          return (
            <div key={machine.id} className={cn("rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md", cardTone)}>
              {/* Machine Header */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className={cn(
                    "flex h-9 w-9 flex-none items-center justify-center rounded-lg transition-colors",
                    machine.status === "Running" 
                      ? "bg-green/10 text-green animate-pulse" 
                      : machine.status === "Available"
                      ? "bg-cyan/10 text-cyan"
                      : machine.status === "Maintenance"
                      ? "bg-gold/10 text-gold"
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {machine.type.includes("Printer") ? (
                      <Printer size={19} />
                    ) : machine.type.includes("Laser") ? (
                      <Scissors size={19} />
                    ) : (
                      <Command size={19} />
                    )}
                  </div>
                  <div>
                    <h3 className="truncate text-sm font-semibold text-slate-100">{machine.name}</h3>
                    <p className="truncate text-xs text-slate-400">
                      {machine.code} · {machine.manufacturer || "ሞዴል አልተመደበም"}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-none items-center gap-1.5">
                  {onStatusChange ? (
                    <select
                      value={machine.status}
                      onChange={(event) => onStatusChange(machine.id, event.target.value as MachineStatus)}
                      className="h-8 rounded-lg border border-slate-600 bg-slate-950 px-2 text-xs font-medium text-slate-100 [color-scheme:dark]"
                      aria-label={`Update ${machine.name} status`}
                    >
                      <option className="bg-slate-950 text-slate-100">Running</option>
                      <option className="bg-slate-950 text-slate-100">Available</option>
                      <option className="bg-slate-950 text-slate-100">Maintenance</option>
                      <option className="bg-slate-950 text-slate-100">Unavailable</option>
                    </select>
                  ) : null}
                  <button
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-slate-200 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
                    onClick={() => onSettings(machine)}
                    aria-label="Machine settings"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>

              {/* Machine Specs */}
              {(machine.model || machine.capability) && (
                <div className="mb-3 text-[11px] text-slate-300">
                  {machine.model || "Model pending"}
                  {machine.capability && ` · ${machine.capability}`}
                </div>
              )}

              {/* Job Information */}
              <div className="mb-3 rounded-lg border border-slate-700/80 bg-slate-950/75 p-3 text-slate-100">
                {job ? (
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">
                      ንቁ የሥራ ካርድ
                    </span>
                    <div className="font-mono font-bold text-slate-100">{job.code}</div>
                    <div className="text-sm text-slate-300">{job.title}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">
                        {formatQuantity(job.quantity, job.unit)}
                      </span>
                      <span className="text-xs text-slate-400">በቀን {job.due}</span>
                    </div>
                    {job.orderOverdue && (
                      <div className="flex items-center gap-1.5 text-xs text-coral font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-coral"></div>
                        የደንበኛ ትዕዛዝ ጊዜ ያለፈበት
                      </div>
                    )}
                  </div>
                ) : nextJob ? (
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono font-bold tracking-wider text-gold uppercase">
                      ቀጣይ ተረኛ
                    </span>
                    <div className="font-mono font-bold text-slate-100">{nextJob.code}</div>
                    <div className="text-sm text-slate-300">{nextJob.client} · {nextJob.title}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">
                        {formatQuantity(nextJob.quantity, nextJob.unit)}
                      </span>
                      <span className="text-xs text-slate-400">በቀን {nextJob.due}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <span className="text-xs font-mono font-bold tracking-wider text-gray-500 uppercase">
                      ስራ ለመቀበል ዝግጁ
                    </span>
                    <div className="font-semibold text-slate-100">ስራ የለውም</div>
                    <div className="text-sm text-slate-300">
                      አዲስ ጆብ ካርድ ለመቀበል ዝግጁ ነው።
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {job && canComplete ? (
                  <button 
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2",
                      isPending(`complete-job-${job.id}`)
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-green text-white hover:bg-green/90"
                    )}
                    disabled={isPending(`complete-job-${job.id}`)}
                    onClick={() => onComplete(job.id)}
                  >
                    {isPending(`complete-job-${job.id}`) ? "በመጨረስ ላይ…" : "ስራ ጨርስ"}
                  </button>
                ) : !job && isManagement && nextJob ? (
                  <button 
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2",
                      isPending(`assign-job-${machine.id}`)
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-navy text-white hover:bg-navy-2"
                    )}
                    disabled={isPending(`assign-job-${machine.id}`)}
                    onClick={() => onAssignNextJob(machine.id)}
                  >
                    <Wrench size={13} />
                    {isPending(`assign-job-${machine.id}`) ? "በመመደብ ላይ…" : `${nextJob.code} ይምከር`}
                  </button>
                ) : !job && isManagement ? (
                  <button 
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-navy transition-colors hover:border-cyan hover:bg-cyan/5"
                    onClick={() => onView("orders")}
                  >
                    ትዕዛዞችን እይ
                  </button>
                ) : !job && !isManagement ? (
                  <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-navy transition-colors hover:border-cyan hover:bg-cyan/5">
                    {focus.action}
                  </button>
                ) : null}
                
                {canCreateOffcut && (
                  <button 
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
                     onClick={() => onOffcut(machine.id)}
                  >
                    ቀሪ ይመዝግቡ
                  </button>
                )}

                <span className={cn(
                  "ml-auto inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  {
                    "bg-green/10 text-green": machine.status === "Running",
                    "bg-cyan/10 text-cyan": machine.status === "Available",
                    "bg-gold/10 text-gold": machine.status === "Maintenance",
                    "bg-coral/10 text-coral": machine.status === "Unavailable",
                  }
                )}>
                  {machine.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
