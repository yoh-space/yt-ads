"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Scissors, Trash2, Wrench } from "lucide-react";
import type { JobCard, Machine } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { statusTone } from "../helpers";

export type WorkspaceProps = {
  machine: Machine;
  job?: JobCard;
  onComplete: (id: string) => void;
  onOffcut: () => void;
  onScrap: () => void;
};

export function OperatorWorkspaceShell({
  machine,
  job,
  mode,
  title,
  subtitle,
  children,
  onComplete,
  onOffcut,
  onScrap,
}: WorkspaceProps & {
  mode: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className={`operator-workspace ${mode}`}>
      <div className="workspace-topline">
        <span className="panel-kicker">DEDICATED OPERATOR WORKSPACE</span>
        <span className={`status-pill ${statusTone(machine.status)}`}>{machine.status}</span>
      </div>
      <div className="workspace-title">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="machine-identity">
          <Wrench size={17} />
          <span>
            <b>{machine.name}</b>
            <small>{machine.code} · {machine.materialUnit} tracking</small>
          </span>
        </div>
      </div>
      <div className="workspace-grid">
        <article className="operator-job-panel">
          <span className="panel-kicker">CURRENT JOB CARD</span>
          {job ? (
            <>
              <strong>{job.code}</strong>
              <h3>{job.title}</h3>
              <p>{job.client}</p>
              <div className="job-quantity">
                <b>{formatQuantity(job.quantity, job.unit)}</b>
                <span>planned material usage</span>
              </div>
              <button className="button primary full" onClick={() => onComplete(job.id)}>
                Complete production run <ArrowUpRight size={16} />
              </button>
            </>
          ) : (
            <div className="empty-state">No job is assigned to this machine.</div>
          )}
        </article>
        <article className="operator-control-panel">{children}</article>
      </div>
      <div className="workspace-foot-actions">
        <button className="button secondary" onClick={onOffcut}><Scissors size={16} />Log usable remainder</button>
        <button className="button tertiary" onClick={onScrap}><Trash2 size={16} />Log unusable scrap</button>
      </div>
    </section>
  );
}
