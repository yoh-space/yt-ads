"use client";

import { Command, Plus, Printer, Scissors, Trash2, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import type { JobCard, Machine, Role } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { roleLabels } from "@/lib/operations-types";
import { statusTone } from "../helpers";
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
  onCreate,
  onOffcut,
  onScrap,
  onComplete,
  onRecordProduction,
}: {
  machines: Machine[];
  jobs: JobCard[];
  role: Role;
  onCreate: () => void;
  onOffcut: () => void;
  onScrap: () => void;
  onComplete: (id: string) => void;
  onRecordProduction: (id: string, inputQuantity: number, outputQuantity: number, wasteQuantity: number) => void;
}) {
  const context: Record<Role, { action: string; detail: string; unit: string }> = {
    admin: { action: "View machine plan", detail: "Monitor every production lane and active allocation.", unit: "Enterprise view" },
    storekeeper: { action: "Issue material", detail: "Confirm issued quantity against the job card and unit rule.", unit: "Store issue mode" },
    laser_operator: { action: "Measure acrylic offcut", detail: "Record usable acrylic or MDF sections in square meters.", unit: "Sheet area · m²" },
    cnc_operator: { action: "Confirm board cut", detail: "Track wood or aluminium sheet output against the assigned job.", unit: "Board area · m²" },
    plotter_operator: { action: "Advance vinyl roll", detail: "Capture roll consumption and plotter output in running meters.", unit: "Roll length · m" },
    printer_operator: { action: "Start print meter", detail: "Record banner usage and print area before final inspection.", unit: "Print area · m²" },
  };
  const focus = context[role];
  const primaryMachine = machines[0];
  const primaryJob = primaryMachine ? jobs.find((job) => job.code === primaryMachine.activeJob) : undefined;
  const OperatorWorkspace = operatorViews[role];

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
          <span className="panel-kicker">{role === "admin" || role === "storekeeper" ? "MACHINE WORKFLOW" : "OPERATOR CONSOLE"}</span>
          <h2>{role === "admin" || role === "storekeeper" ? "የማሽን ቁጥጥር ማዕከል" : `${roleLabels[role].am} የሥራ ማዕከል`}</h2>
          <p>{focus.detail}</p>
        </div>
        <div>
          <button className="button secondary" onClick={onScrap}><Trash2 size={16} />Log scrap</button>
          <button className="button primary" onClick={onCreate}><Plus size={16} />Add machine</button>
        </div>
      </div>
      <div className="operator-focus">
        <span>UNIT MODE</span>
        <strong>{focus.unit}</strong>
        <p>{focus.action}</p>
        <button className="button secondary small" onClick={onOffcut}>
          {role === "plotter_operator" ? "Log vinyl remainder" : "Log usable offcut"}
        </button>
      </div>
      <div className="machine-card-grid">
        {machines.map((machine) => {
          const job = jobs.find((entry) => entry.code === machine.activeJob);
          return (
            <article className="machine-card" key={machine.id}>
              <div className="machine-card-top">
                <span className={`equipment-glyph ${machine.status === "Running" ? "run" : ""}`}>
                  {machine.type.includes("Printer") ? <Printer size={22} /> : machine.type.includes("Laser") ? <Scissors size={22} /> : <Command size={22} />}
                </span>
                <span className={`status-pill ${statusTone(machine.status)}`}>{machine.status}</span>
              </div>
              <h3>{machine.name}</h3>
              <p>{machine.code} · {machine.type}</p>
              <div className="machine-job-box">
                {job ? (
                  <>
                    <small>ACTIVE JOB CARD</small>
                    <strong>{job.code}</strong>
                    <span>{job.title}</span>
                    <div><b>{formatQuantity(job.quantity, job.unit)}</b><em>Due {job.due}</em></div>
                  </>
                ) : (
                  <>
                    <small>READY FOR ASSIGNMENT</small>
                    <strong>No active job</strong>
                    <span>Machine is available for the next card.</span>
                  </>
                )}
              </div>
              <div className="machine-card-actions">
                {job ? (
                  <button className="button primary small" onClick={() => onComplete(job.id)}>Complete job</button>
                ) : (
                  <button className="button secondary small">{focus.action}</button>
                )}
                <button className="button tertiary small" onClick={onOffcut}>Log offcut</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
