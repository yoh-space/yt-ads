"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import type { Machine, MachineStatus, Role, Unit } from "@/lib/operations-types";
import { roleLabels } from "@/lib/operations-types";
import { baseUnitOptions } from "../nav-config";
import { ModalShell } from "./modal-shell";
import { Button } from "@/components/ui";

export type MachineEditInput = {
  name?: string;
  code?: string;
  type?: string;
  manufacturer?: string;
  model?: string;
  capability?: string;
  notes?: string;
  operatorRole?: Role;
  materialUnit?: Unit;
};

const operatorRoles: Role[] = ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"];

export function MachineEditModal({
  machine,
  onClose,
  onSave,
}: {
  machine: Machine;
  onClose: () => void;
  onSave: (input: MachineEditInput) => void;
}) {
  const [name, setName] = useState(machine.name);
  const [code, setCode] = useState(machine.code);
  const [type, setType] = useState(machine.type);
  const [manufacturer, setManufacturer] = useState(machine.manufacturer ?? "");
  const [model, setModel] = useState(machine.model ?? "");
  const [capability, setCapability] = useState(machine.capability ?? "");
  const [notes, setNotes] = useState(machine.notes ?? "");
  const [operatorRole, setOperatorRole] = useState<Role>(machine.operatorRole);
  const [materialUnit, setMaterialUnit] = useState<Unit>(machine.materialUnit);

  return (
    <ModalShell
      title={`Edit ${machine.name}`} subtitle="Update machine configuration and operator assignment." onClose={onClose}
      footer={
        <Button type="submit" form="edit-machine-form">
          Save changes <Save size={16} />
        </Button>
      }
    >
      <form
        id="edit-machine-form"
        className="modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name: name.trim() || machine.name,
            code: code.trim().toUpperCase() || machine.code,
            type: type.trim() || machine.type,
            manufacturer: manufacturer.trim() || undefined,
            model: model.trim() || undefined,
            capability: capability.trim() || undefined,
            notes: notes.trim() || undefined,
            operatorRole,
            materialUnit,
          });
        }}
      >
        <label>Machine name<input autoFocus required value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Machine code<input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>
        <label>Machine type<input required value={type} onChange={(event) => setType(event.target.value)} /></label>
        <div className="two-field">
          <label>Manufacturer<input placeholder="e.g. Crystal" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} /></label>
          <label>Exact model<input placeholder="e.g. Crystal 1325" value={model} onChange={(event) => setModel(event.target.value)} /></label>
        </div>
        <div className="two-field">
          <label>Capability<input placeholder="e.g. 1.20 x 2.44m" value={capability} onChange={(event) => setCapability(event.target.value)} /></label>
          <label>Operating notes<input placeholder="Optional notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
        </div>
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
              {baseUnitOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </form>
    </ModalShell>
  );
}
