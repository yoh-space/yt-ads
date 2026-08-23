"use client";

import { useState } from "react";
import { Scissors } from "lucide-react";
import type { WorkspaceProps } from "./workspace-shell";
import { OperatorWorkspaceShell } from "./workspace-shell";

export function PlotterOperatorWorkspace({ machine, job, onComplete, onOffcut, onScrap }: WorkspaceProps) {
  const [length, setLength] = useState(job?.quantity ?? 0);
  const [pressure, setPressure] = useState("18");
  const [weedTest, setWeedTest] = useState(false);
  return (
    <OperatorWorkspaceShell
      machine={machine}
      job={job}
      mode="plotter"
      title="Vinyl plotter control"
      subtitle="Running-meter workflow for sticker and vinyl cutting, weeding, and roll remainder tracking."
      onComplete={onComplete}
      onOffcut={onOffcut}
      onScrap={onScrap}
    >
      <span className="panel-kicker">PLOTTER RUN SETUP</span>
      <h3>Roll and contour settings</h3>
      <div className="operator-form-grid">
        <label>Vinyl length (m)<input type="number" value={length} onChange={(event) => setLength(Number(event.target.value))} /></label>
        <label>Contour pressure<input value={pressure} onChange={(event) => setPressure(event.target.value)} /></label>
      </div>
      <label className="control-check">
        <input type="checkbox" checked={weedTest} onChange={(event) => setWeedTest(event.target.checked)} /> Weed test passed before full run
      </label>
      <div className="control-readout"><Scissors size={17} /><span>Estimated roll remainder</span><b>{Math.max(0, 50 - length).toFixed(1)} m</b></div>
    </OperatorWorkspaceShell>
  );
}
