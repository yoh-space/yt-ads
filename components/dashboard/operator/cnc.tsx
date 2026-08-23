"use client";

import { useState } from "react";
import { Command, Scissors } from "lucide-react";
import type { WorkspaceProps } from "./workspace-shell";
import { OperatorWorkspaceShell } from "./workspace-shell";

export function CncOperatorWorkspace({ machine, job, onComplete, onRecordProduction, onOffcut, onScrap }: WorkspaceProps) {
  const [boardArea, setBoardArea] = useState(job?.quantity ?? 0);
  const [tool, setTool] = useState("6mm end mill");
  const [passDepth, setPassDepth] = useState("3mm");
  return (
    <OperatorWorkspaceShell
      machine={machine}
      job={job}
      mode="cnc"
      title="CNC router control"
      subtitle="Board cutting workspace for wood and aluminium sheet operations."
      onComplete={onComplete}
      onRecordProduction={onRecordProduction}
      onOffcut={onOffcut}
      onScrap={onScrap}
    >
      <span className="panel-kicker">CNC CUT PARAMETERS</span>
      <h3>Board preparation</h3>
      <div className="operator-form-grid">
        <label>Board area (m²)<input type="number" value={boardArea} onChange={(event) => setBoardArea(Number(event.target.value))} /></label>
        <label>Tool profile<select value={tool} onChange={(event) => setTool(event.target.value)}><option>6mm end mill</option><option>3mm end mill</option><option>V-bit 90°</option></select></label>
      </div>
      <label>Pass depth<select value={passDepth} onChange={(event) => setPassDepth(event.target.value)}><option>3mm</option><option>6mm</option><option>9mm</option></select></label>
      <div className="control-readout"><Command size={17} /><span>Calculated routing passes</span><b>{Math.max(1, Math.ceil(boardArea / 2.5))}</b></div>
    </OperatorWorkspaceShell>
  );
}
