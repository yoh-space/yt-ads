"use client";

import { Command, Eye, Printer, Scissors, Settings, Trash2, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import type { JobCard, Machine, MachineStatus, Role } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { roleLabels } from "@/lib/operations-types";
import { statusTone } from "../helpers";
import type { View } from "../nav-config";
import { LaserOperatorWorkspace } from "../operator/laser";
import { CncOperatorWorkspace } from "../operator/cnc";
import { PlotterOperatorWorkspace } from "../operator/plotter";
import { PrinterOperatorWorkspace } from "../operator/printer";
import { cn } from "@/lib/utils";
import { OperatorStockWidget } from "./operator-stock";

const operatorViews: Partial<Record<Role, ComponentType<any>>> = {
  laser_operator: LaserOperatorWorkspace,
  cnc_operator: CncOperatorWorkspace,
  plotter_operator: PlotterOperatorWorkspace,
  printer_operator: PrinterOperatorWorkspace,
};

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
  onView: (view: View) => void;
  isPending: (key: string) => boolean;
}) {

  const context: Record<Role, { action: string; detail: string; unit: string }> = {
    owner: { action: "Oversee operations", detail: "Owner control room", unit: "All units" },
    manager: { action: "Coordinate operations", detail: "Manager control room", unit: "All units" },
    admin: { action: "View machine plan", detail: "Monitor every production lane and active allocation.", unit: "Enterprise view" },
    storekeeper: { action: "Issue material", detail: "Confirm issued quantity against the job card and unit rule.", unit: "Store issue mode" },
    receptionist: { action: "Register customer order", detail: "Take walk-in orders and confirm payment at the front desk.", unit: "Reception desk" },
    laser_operator: { action: "Measure acrylic offcut", detail: "Record usable acrylic or foam sections in square meters.", unit: "Sheet area m\u00B2" },
    cnc_operator: { action: "Confirm board cut", detail: "Track wood or aluminium sheet output against the assigned job.", unit: "Board area m\u00B2" },
    plotter_operator: { action: "Advance vinyl roll", detail: "Capture roll consumption and plotter output in running meters.", unit: "Roll length m" },
    printer_operator: { action: "Start print meter", detail: "Record banner usage and print area before final inspection.", unit: "Print area m\u00B2" },
  };
  const focus = context[role];
  const primaryMachine = machines[0];
  const primaryJob = primaryMachine ? jobs.find((job) => job.code === primaryMachine.activeJob) : undefined;
  const OperatorWorkspace = operatorViews[role];
  const isManagement = role === "owner" || role === "manager" || role === "admin" || role === "storekeeper";
  const queuedJobsByMachine = new Map<string, JobCard[]>();
  for (const job of jobs) {
    if (job.status === "Queued") {
      const list = queuedJobsByMachine.get(job.machineId) ?? [];
      list.push(job);
      queuedJobsByMachine.set(job.machineId, list);
    }
  }

  if (OperatorWorkspace && primaryMachine) {
    return (
      <div className="space-y-6">
        <OperatorWorkspace
          machine={primaryMachine}
          job={primaryJob}
          onComplete={onComplete}
          onRecordProduction={onRecordProduction}
          onOffcut={() => onOffcut(primaryMachine.id)}
          onScrap={() => onScrap(primaryMachine.id)}
        />
        <OperatorStockWidget machineId={primaryMachine.id} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Operator/Management Banner */}
      <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">
              {isManagement ? "MACHINE WORKFLOW" : "OPERATOR CONSOLE"}
            </span>
            <h2 className="text-lg font-bold text-navy mt-1">
              {roleLabels[role].en}
            </h2>
            <p className="text-sm text-gray-600 mt-1">{focus.detail}</p>
          </div>
          <div className="flex items-center gap-3">
            {canCreateScrap && (
              <button 
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-navy transition-colors hover:border-cyan hover:bg-cyan/5 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
                onClick={() => onScrap()}
              >
                <Trash2 size={16} />
                Log scrap
              </button>
            )}
            {canCreateOffcut && (
              <button 
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-navy text-white shadow-sm transition-colors hover:bg-navy-2 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
                onClick={() => onOffcut()}
              >
                <Scissors size={16} />
                Log offcut
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Status Overview */}
      {isManagement ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="bg-white border border-line rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-navy mb-1">{machines.length}</div>
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</div>
          </div>
          <div className="bg-green/5 border border-green/20 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green mb-1">
              {machines.filter((m) => m.status === "Running").length}
            </div>
            <div className="text-xs font-semibold text-green uppercase tracking-wider">Running</div>
          </div>
          <div className="bg-cyan/5 border border-cyan/20 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-cyan-dark mb-1">
              {machines.filter((m) => m.status === "Available").length}
            </div>
            <div className="text-xs font-semibold text-cyan-dark uppercase tracking-wider">Available</div>
          </div>
          <div className="bg-gold/5 border border-gold/20 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-gold mb-1">
              {machines.filter((m) => m.status === "Maintenance").length}
            </div>
            <div className="text-xs font-semibold text-gold uppercase tracking-wider">Maintenance</div>
          </div>
          <div className="bg-coral/5 border border-coral/20 rounded-lg p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-coral mb-1">
              {machines.filter((m) => m.status === "Unavailable").length}
            </div>
            <div className="text-xs font-semibold text-coral uppercase tracking-wider">Unavailable</div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">UNIT MODE</span>
              <div className="text-lg font-bold text-navy mt-1">{focus.unit}</div>
              <p className="text-sm text-gray-600 mt-1">{focus.action}</p>
            </div>
            {canCreateOffcut && (
              <button 
                className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md border border-line bg-white text-navy transition-colors hover:border-cyan hover:bg-cyan/5"
                onClick={() => onOffcut(primaryMachine.id)}
              >
                {role === "plotter_operator" ? "Log vinyl remainder" : "Log usable offcut"}
              </button>
            )}
          </div>
        </div>
      )}
      {/* Machine Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {machines.map((machine) => {
          const job = jobs.find((entry) => entry.code === machine.activeJob);
          const nextJobs = queuedJobsByMachine.get(machine.id);
          const nextJob = nextJobs?.[0];
          
          return (
            <div key={machine.id} className="bg-white border border-line rounded-lg p-6 hover:shadow-md transition-shadow">
              {/* Machine Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                    machine.status === "Running" 
                      ? "bg-green/10 text-green animate-pulse" 
                      : machine.status === "Available"
                      ? "bg-cyan/10 text-cyan"
                      : machine.status === "Maintenance"
                      ? "bg-gold/10 text-gold"
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {machine.type.includes("Printer") ? (
                      <Printer size={22} />
                    ) : machine.type.includes("Laser") ? (
                      <Scissors size={22} />
                    ) : (
                      <Command size={22} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy">{machine.name}</h3>
                    <p className="text-sm text-gray-600">
                      {machine.code} · {machine.manufacturer || "Manufacturer not set"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                    {
                      "bg-green/10 text-green": machine.status === "Running",
                      "bg-cyan/10 text-cyan": machine.status === "Available", 
                      "bg-gold/10 text-gold": machine.status === "Maintenance",
                      "bg-coral/10 text-coral": machine.status === "Unavailable"
                    }
                  )}>
                    {machine.status}
                  </span>
                  <button
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
                    onClick={() => onSettings(machine)}
                    aria-label="Machine settings"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>

              {/* Machine Specs */}
              {(machine.model || machine.capability) && (
                <div className="mb-4 text-xs text-gray-500">
                  {machine.model || "Model pending"}
                  {machine.capability && ` · ${machine.capability}`}
                </div>
              )}

              {/* Job Information */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                {job ? (
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold tracking-wider text-cyan-dark uppercase">
                      ACTIVE JOB CARD
                    </span>
                    <div className="font-mono font-bold text-navy">{job.code}</div>
                    <div className="text-sm text-gray-700">{job.title}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-navy">
                        {formatQuantity(job.quantity, job.unit)}
                      </span>
                      <span className="text-xs text-gray-500">Due {job.due}</span>
                    </div>
                    {job.orderOverdue && (
                      <div className="flex items-center gap-1.5 text-xs text-coral font-medium">
                        <div className="w-1.5 h-1.5 rounded-full bg-coral"></div>
                        Customer order overdue
                      </div>
                    )}
                  </div>
                ) : nextJob ? (
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold tracking-wider text-gold uppercase">
                      NEXT IN QUEUE
                    </span>
                    <div className="font-mono font-bold text-navy">{nextJob.code}</div>
                    <div className="text-sm text-gray-700">{nextJob.client} · {nextJob.title}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-navy">
                        {formatQuantity(nextJob.quantity, nextJob.unit)}
                      </span>
                      <span className="text-xs text-gray-500">Due {nextJob.due}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs font-mono font-bold tracking-wider text-gray-500 uppercase">
                      READY FOR ASSIGNMENT
                    </span>
                    <div className="font-semibold text-navy">No active job</div>
                    <div className="text-sm text-gray-600">
                      Machine is available for the next card.
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {job && canComplete ? (
                  <button 
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2",
                      isPending(`complete-job-${job.id}`)
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-green text-white hover:bg-green/90"
                    )}
                    disabled={isPending(`complete-job-${job.id}`)}
                    onClick={() => onComplete(job.id)}
                  >
                    {isPending(`complete-job-${job.id}`) ? "Completing..." : "Complete job"}
                  </button>
                ) : !job && isManagement && nextJob ? (
                  <button 
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2",
                      isPending(`assign-job-${machine.id}`)
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-navy text-white hover:bg-navy-2"
                    )}
                    disabled={isPending(`assign-job-${machine.id}`)}
                    onClick={() => onAssignNextJob(machine.id)}
                  >
                    <Wrench size={13} />
                    {isPending(`assign-job-${machine.id}`) ? "Assigning…" : `Assign ${nextJob.code}`}
                  </button>
                ) : !job && isManagement ? (
                  <button 
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-navy transition-colors hover:border-cyan hover:bg-cyan/5"
                    onClick={() => onView("orders")}
                  >
                    View orders
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
                    Log offcut
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
