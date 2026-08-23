"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { MachineStatus, Role, Unit } from "@/lib/operations-types";
import { roleLabels } from "@/lib/operations-types";
import { unitOptions } from "../nav-config";
import { ModalShell } from "./modal-shell";

export type NewMachineInput = {
  name: string;
  code: string;
  type: string;
  operatorRole: Role;
  materialUnit: Unit;
  status: MachineStatus;
};

const operatorRoles: Role[] = ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"];

export function MachineModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (input: NewMachineInput) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("Laser cutter");
  const [operatorRole, setOperatorRole] = useState<Role>("laser_operator");
  const [materialUnit, setMaterialUnit] = useState<Unit>("m²");
  const [status, setStatus] = useState<MachineStatus>("Available");

  return (
    <ModalShell title="Add production machine" subtitle="Attach an unlimited number of machines to a dedicated operator workflow." onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name: name || "New machine",
            code: code || "NEW-01",
            type: type || "Production machine",
            operatorRole,
            materialUnit,
            status,
          });
        }}
      >
        <label>Machine name<input autoFocus required placeholder="e.g. UV Flatbed 2513" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Machine code<input required placeholder="e.g. UV-01" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>
        <label>Machine type<input required placeholder="e.g. UV flatbed printer" value={type} onChange={(event) => setType(event.target.value)} /></label>
        <div className="two-field">
          <label>
            Assigned operator
            <select value={operatorRole} onChange={(event) => setOperatorRole(event.target.value as Role)}>
              {operatorRoles.map((option) => <option value={option} key={option}>{roleLabels[option].en}</option>)}
            </select>
          </label>
          <label>
            Consumption unit
            <select value={materialUnit} onChange={(event) => setMaterialUnit(event.target.value as Unit)}>
              {unitOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as MachineStatus)}><option>Running</option><option>Available</option><option>Maintenance</option></select></label>
        <button className="button primary full" type="submit">Add machine <Plus size={16} /></button>
      </form>
    </ModalShell>
  );
}
