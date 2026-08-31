"use client";

import { useState } from "react";
import { Printer, Scissors } from "lucide-react";
import type { WorkspaceProps } from "./workspace-shell";
import { OperatorWorkspaceShell } from "./workspace-shell";

export function PrinterOperatorWorkspace({ machine, job, onComplete, onRecordProduction, onOffcut, onScrap }: WorkspaceProps) {
  const [area, setArea] = useState(job?.quantity ?? 0);
  const [passes, setPasses] = useState("6-pass");
  const [inkCheck, setInkCheck] = useState(false);
  return (
    <OperatorWorkspaceShell
      machine={machine}
      job={job}
      mode="printer"
      title="Large-format print control"
      subtitle="Banner print-area workflow with pass-profile, ink readiness, and trim remainder checks."
      onComplete={onComplete}
      onRecordProduction={onRecordProduction}
      onOffcut={onOffcut}
      onScrap={onScrap}
    >
      <span className="panel-kicker">PRINT RUN SETUP</span>
      <h3>Media and ink readiness</h3>
      <div className="operator-form-grid">
        <label>Print area (m²)<input type="number" value={area} onChange={(event) => setArea(Number(event.target.value))} /></label>
        <label>Pass profile<select value={passes} onChange={(event) => setPasses(event.target.value)}><option>4-pass</option><option>6-pass</option><option>8-pass</option></select></label>
      </div>
      <label className="control-check">
        <input type="checkbox" checked={inkCheck} onChange={(event) => setInkCheck(event.target.checked)} /> Ink levels and nozzle check confirmed
      </label>
      <div className="control-readout"><Printer size={17} /><span>Media feed estimate</span><b>{(area / 3.2).toFixed(1)} m</b></div>
    </OperatorWorkspaceShell>
  );
}
