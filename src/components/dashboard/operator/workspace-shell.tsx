"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, Scissors, Trash2, Wrench } from "lucide-react";
import type { JobCard, Machine } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { NumericInput } from "@/components/ui";
import { statusTone } from "../helpers";

export type WorkspaceProps = {
  machine: Machine;
  job?: JobCard;
  onComplete: (id: string) => void;
  onRecordProduction: (id: string, inputQuantity: number, outputQuantity: number, wasteQuantity: number) => void;
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
  onRecordProduction,
  onOffcut,
  onScrap,
}: WorkspaceProps & {
  mode: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const [inputQuantity, setInputQuantity] = useState(String(job?.quantity ?? ""));
  const [outputQuantity, setOutputQuantity] = useState(String(job?.quantity ?? ""));
  const [wasteQuantity, setWasteQuantity] = useState("");
  const [productionInputsValid, setProductionInputsValid] = useState({ input: true, output: true, waste: true });
  const hasProductionValidationError = !productionInputsValid.input || !productionInputsValid.output || !productionInputsValid.waste;

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
              {job.orderOverdue ? <div className="operator-overdue"><span>OVERDUE CUSTOMER ORDER</span><strong>Contact the manager before completing handoff</strong></div> : null}
              <div className="job-quantity">
                <b>{formatQuantity(job.quantity, job.unit)}</b>
                <span>planned material usage</span>
              </div>
              <div className="operator-form-grid">
                <label>Material input ({job.unit})<NumericInput required min={0.1} step="0.1" value={inputQuantity} onChange={setInputQuantity} onValidityChange={(isValid) => setProductionInputsValid((current) => ({ ...current, input: isValid }))} /></label>
                <label>Good output ({job.unit})<NumericInput required min={0} step="0.1" value={outputQuantity} onChange={setOutputQuantity} onValidityChange={(isValid) => setProductionInputsValid((current) => ({ ...current, output: isValid }))} /></label>
              </div>
              <label>Waste ({job.unit})<NumericInput required min={0} step="0.1" value={wasteQuantity} onChange={setWasteQuantity} onValidityChange={(isValid) => setProductionInputsValid((current) => ({ ...current, waste: isValid }))} /></label>
              <button
                className="button secondary full"
                disabled={hasProductionValidationError || !inputQuantity.trim() || !outputQuantity.trim() || !wasteQuantity.trim()}
                onClick={() => onRecordProduction(job.id, Number(inputQuantity), Number(outputQuantity), Number(wasteQuantity))}
              >
                Save production log <ArrowUpRight size={16} />
              </button>
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
