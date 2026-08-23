"use client";

import { useState } from "react";
import { Scissors } from "lucide-react";
import type { WorkspaceProps } from "./workspace-shell";
import { OperatorWorkspaceShell as OperatorWorkspaceShellInner } from "./workspace-shell";

export function LaserOperatorWorkspace({ machine, job, onComplete, onRecordProduction, onOffcut, onScrap }: WorkspaceProps) {
  const [area, setArea] = useState(job?.quantity ?? 0);
  const [kerf, setKerf] = useState("0.20");
  const [safeStart, setSafeStart] = useState(false);
  return (
    <OperatorWorkspaceShellInner
      machine={machine}
      job={job}
      mode="laser"
      title="Laser cutter control"
      subtitle="Acrylic and MDF sheet workflow with area, kerf, and offcut controls."
      onComplete={onComplete}
      onRecordProduction={onRecordProduction}
      onOffcut={onOffcut}
      onScrap={onScrap}
    >
      <span className="panel-kicker">LASER RUN SETUP</span>
      <h3>Sheet cut confirmation</h3>
      <div className="operator-form-grid">
        <label>Sheet area (m²)<input type="number" value={area} onChange={(event) => setArea(Number(event.target.value))} /></label>
        <label>Kerf width (mm)<input value={kerf} onChange={(event) => setKerf(event.target.value)} /></label>
      </div>
      <label className="control-check">
        <input type="checkbox" checked={safeStart} onChange={(event) => setSafeStart(event.target.checked)} /> Safe-start and focus height verified
      </label>
      <div className="control-readout">
        <Scissors size={17} />
        <span>Expected reusable remainder</span>
        <b>{Math.max(0, area * 0.12).toFixed(2)} m²</b>
      </div>
    </OperatorWorkspaceShellInner>
  );
}

