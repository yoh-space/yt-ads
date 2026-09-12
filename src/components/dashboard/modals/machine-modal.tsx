"use client";

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import type { MachineStatus, Role, Unit } from "@/lib/operations-types";
import { roleLabels } from "@/lib/operations-types";
import { baseUnitOptions } from "@/components/dashboard/shell/nav-config";
import { ModalShell } from "./modal-shell";
import { Button } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

export type NewMachineInput = {
  name: string;
  code: string;
  type: string;
  manufacturer?: string;
  model?: string;
  capability?: string;
  notes?: string;
  operatorRole: Role;
  materialUnit: Unit;
  status: MachineStatus;
};

const operatorRoles: Role[] = ["laser_operator", "cnc_operator", "crystek_operator", "crystal_jet_operator"];

const fieldClasses =
  "w-full h-[37px] px-[10px] rounded-md border border-border bg-background text-foreground text-[11px] outline-none placeholder:text-muted-foreground transition-all " +
  "focus:border-cyan focus:shadow-[0_0_0_3px_rgba(25,196,210,0.1)]";

const labelClasses = "block mb-1.5 text-[11px] font-semibold text-muted-foreground";

const statusOptions: MachineStatus[] = ["Running", "Available", "Maintenance"];

const statusDot: Record<MachineStatus, string> = {
  Running: "bg-green",
  Available: "bg-cyan",
  Maintenance: "bg-gold",
  Unavailable: "bg-coral",
};

function SectionHeader({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-dark uppercase">{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

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
  const [manufacturer, setManufacturer] = useState("Crystal");
  const [model, setModel] = useState("");
  const [capability, setCapability] = useState("");
  const [notes, setNotes] = useState("");
  const [operatorRole, setOperatorRole] = useState<Role>("laser_operator");
  const [materialUnit, setMaterialUnit] = useState<Unit>("m²");
  const [status, setStatus] = useState<MachineStatus>("Available");

  return (
    <ModalShell
      title="Add production machine" subtitle="Attach an unlimited number of machines to a dedicated operator workflow." onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-machine-form">
            Add machine <Plus size={14} />
          </Button>
        </>
      }
    >
      <form
        id="new-machine-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            name: name || "New machine",
            code: code || "NEW-01",
            type: type || "Production machine",
            manufacturer: manufacturer || undefined,
            model: model || undefined,
            capability: capability || undefined,
            notes: notes || undefined,
            operatorRole,
            materialUnit,
            status,
          });
        }}
      >
        <div className="space-y-3">
          <SectionHeader>Identity</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClasses}>Machine name</span>
              <input autoFocus required placeholder="e.g. UV Flatbed 2513" value={name} onChange={(event) => setName(event.target.value)} className={fieldClasses} />
            </label>
            <label className="block">
              <span className={labelClasses}>Machine code</span>
              <input required placeholder="e.g. UV-01" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className={fieldClasses} />
            </label>
          </div>
          <label className="block">
            <span className={labelClasses}>Machine type</span>
            <input required placeholder="e.g. UV flatbed printer" value={type} onChange={(event) => setType(event.target.value)} className={fieldClasses} />
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
              <input placeholder="e.g. 1.20 × 2.44m" value={capability} onChange={(event) => setCapability(event.target.value)} className={fieldClasses} />
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

        <div className="space-y-3">
          <SectionHeader>Machine status</SectionHeader>
          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-background p-1">
            {statusOptions.map((option) => (
              <button
                type="button"
                key={option}
                onClick={() => setStatus(option)}
                aria-pressed={status === option}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-semibold transition-all",
                  status === option
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusDot[option])} />
                {option}
              </button>
            ))}
          </div>
        </div>
      </form>
    </ModalShell>
  );
}