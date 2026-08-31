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
  onOffcut: () => void;
  onScrap: () => void;
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
      <OperatorWorkspace
        machine={primaryMachine}
        job={primaryJob}
        onComplete={onComplete}
        onRecordProduction={onRecordProduction}
        onOffcut={onOffcut}
        onScrap={onScrap}
      />
    );
  }

  return (
    <section className="machines-view">
      <div className="operator-banner">
        <div>
          <span className="panel-kicker">{isManagement ? "MACHINE WORKFLOW" : "OPERATOR CONSOLE"}</span>
          <p>{focus.detail}</p>
        </div>
        <div className="banner-actions">
          {canCreateScrap ? <button className="button secondary" onClick={onScrap}><Trash2 size={16} />Log scrap</button> : null}
          {canCreateOffcut ? <button className="button primary" onClick={onOffcut}><Scissors size={16} />Log offcut</button> : null}
        </div>
      </div>
      {isManagement ? (
        <div className="mw-status-strip">
          <div className="mw-status-card">
            <strong>{machines.length}</strong>
            <span>Total</span>
          </div>
          <div className="mw-status-card running">
            <strong>{machines.filter((m) => m.status === "Running").length}</strong>
            <span>Running</span>
          </div>
          <div className="mw-status-card available">
            <strong>{machines.filter((m) => m.status === "Available").length}</strong>
            <span>Available</span>
          </div>
          <div className="mw-status-card maintenance">
            <strong>{machines.filter((m) => m.status === "Maintenance").length}</strong>
            <span>Maintenance</span>
          </div>
          <div className="mw-status-card unavailable">
            <strong>{machines.filter((m) => m.status === "Unavailable").length}</strong>
            <span>Unavailable</span>
          </div>
        </div>
      ) : (
        <div className="operator-focus">
          <span>UNIT MODE</span>
          <strong>{focus.unit}</strong>
          <p>{focus.action}</p>
          {canCreateOffcut ? <button className="button secondary small" onClick={onOffcut}>
            {role === "plotter_operator" ? "Log vinyl remainder" : "Log usable offcut"}
          </button> : null}
        </div>
      )}
      <div className="machine-card-grid">
        {machines.map((machine) => {
          const job = jobs.find((entry) => entry.code === machine.activeJob);
          return (
            <article className="machine-card" key={machine.id}>
              <div className="machine-card-top">
                <span className={`equipment-glyph ${machine.status === "Running" ? "run" : ""}`}>
                  {machine.type.includes("Printer") ? <Printer size={22} /> : machine.type.includes("Laser") ? <Scissors size={22} /> : <Command size={22} />}
                </span>
                <div className="machine-card-top-right">
                  <span className={`status-pill ${statusTone(machine.status)}`}>{machine.status}</span>
                  <button
                    className="mc-expand-btn"
                    onClick={() => onSettings(machine)}
                    aria-label="Machine settings"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </div>
              <h3>{machine.name}</h3>
              <p>{machine.code} &middot; {machine.manufacturer || "Manufacturer not set"}</p>
              {machine.model || machine.capability ? <small className="machine-specs">{machine.model || "Model pending"}{machine.capability ? ` \u00B7 ${machine.capability}` : ""}</small> : null}

              <div className="machine-job-box">
                {job ? (
                  <>
                    <small>ACTIVE JOB CARD</small>
                    <strong>{job.code}</strong>
                    <span>{job.title}</span>
                    <div><b>{formatQuantity(job.quantity, job.unit)}</b><em>Due {job.due}</em></div>
                    {job.orderOverdue ? <small className="danger-text">Customer order overdue</small> : null}
                  </>
                ) : (() => {
                  const nextJobs = queuedJobsByMachine.get(machine.id);
                  const nextJob = nextJobs?.[0];
                  return nextJob ? (
                    <>
                      <small>NEXT IN QUEUE</small>
                      <strong>{nextJob.code}</strong>
                      <span>{nextJob.client} · {nextJob.title}</span>
                      <div><b>{formatQuantity(nextJob.quantity, nextJob.unit)}</b><em>Due {nextJob.due}</em></div>
                    </>
                  ) : (
                    <>
                      <small>READY FOR ASSIGNMENT</small>
                      <strong>No active job</strong>
                      <span>Machine is available for the next card.</span>
                    </>
                  );
                })()}
              </div>

              {/* Primary action row */}
              <div className="machine-card-actions">
                {job ? (
                  canComplete ? <button className={`button primary small${isPending(`complete-job-${job.id}`) ? " pending" : ""}`} disabled={isPending(`complete-job-${job.id}`)} onClick={() => onComplete(job.id)}>{isPending(`complete-job-${job.id}`) ? "Completing..." : "Complete job"}</button> : null
                ) : (
                  (() => {
                    const nextJobs = queuedJobsByMachine.get(machine.id);
                    const nextJob = nextJobs?.[0];
                    if (isManagement && nextJob) {
                      return <button className={`button primary small${isPending(`assign-job-${machine.id}`) ? " pending" : ""}`} disabled={isPending(`assign-job-${machine.id}`)} onClick={() => onAssignNextJob(machine.id)}><Wrench size={13} />{isPending(`assign-job-${machine.id}`) ? "Assigning…" : `Assign ${nextJob.code}`}</button>;
                    }
                    if (isManagement) {
                      return <button className="button secondary small" onClick={() => onView("orders")}>View orders</button>;
                    }
                    return <button className="button secondary small">{focus.action}</button>;
                  })()
                )}
                {canCreateOffcut ? <button className="button tertiary small" onClick={onOffcut}>Log offcut</button> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
