"use client";

import { useState } from "react";
import { ChevronDown, Save } from "lucide-react";
import type { Machine, Role, Unit } from "@/lib/operations-types";
import { roleLabels } from "@/lib/operations-types";
import { baseUnitOptions } from "../nav-config";
import { ModalShell } from "./modal-shell";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

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

const fieldClasses =
  "w-full h-[37px] px-[10px] rounded-md border border-border bg-background text-foreground text-[11px] outline-none placeholder:text-muted-foreground transition-all " +
  "focus:border-cyan focus:shadow-[0_0_0_3px_rgba(25,196,210,0.1)]";

const labelClasses = "block mb-1.5 text-[11px] font-semibold text-muted-foreground";

function SectionHeader({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-dark uppercase">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

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
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-machine-form">
            Save changes <Save size={14} />
          </Button>
        </>
      }
    >
      <form
        id="edit-machine-form"
        className="space-y-5"
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
        <div className="space-y-3">
          <SectionHeader>Identity</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClasses}>Machine name</span>
              <input autoFocus required value={name} onChange={(event) => setName(event.target.value)} className={fieldClasses} />
            </label>
            <label className="block">
              <span className={labelClasses}>Machine code</span>
              <input required value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className={fieldClasses} />
            </label>
          </div>
          <label className="block">
            <span className={labelClasses}>Machine type</span>
            <input required value={type} onChange={(event) => setType(event.target.value)} className={fieldClasses} />
          </label>
        </div>

        <div className="space-y-3">
          <SectionHeader>Hardware details</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClasses}>Manufacturer</span>
              <input placeholder="e.g. Crystal" value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} className={fieldClasses} />
            </label>
            <label className="block">
              <span className={labelClasses}>Exact model</span>
              <input placeholder="e.g. Crystal 1325" value={model} onChange={(event) => setModel(event.target.value)} className={fieldClasses} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClasses}>Capability</span>
              <input placeholder="e.g. 1.20 x 2.44m" value={capability} onChange={(event) => setCapability(event.target.value)} className={fieldClasses} />
            </label>
            <label className="block">
              <span className={labelClasses}>Operating notes</span>
              <input placeholder="Optional notes" value={notes} onChange={(event) => setNotes(event.target.value)} className={fieldClasses} />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <SectionHeader>Workflow assignment</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClasses}>Assigned operator</span>
              <div className="relative">
                <select
                  value={operatorRole}
                  onChange={(event) => setOperatorRole(event.target.value as Role)}
                  className={cn(fieldClasses, "cursor-pointer appearance-none pr-8 [color-scheme:dark]")}
                >
                  {operatorRoles.map((option) => <option value={option} key={option}>{roleLabels[option].en}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </label>
            <label className="block">
              <span className={labelClasses}>Consumption unit</span>
              <div className="relative">
                <select
                  value={materialUnit}
                  onChange={(event) => setMaterialUnit(event.target.value as Unit)}
                  className={cn(fieldClasses, "cursor-pointer appearance-none pr-8 [color-scheme:dark]")}
                >
                  {baseUnitOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              </div>
            </label>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}