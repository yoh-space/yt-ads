"use client";

import { useEffect, useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { Role } from "@/lib/operations-types";
import { roleLabels } from "@/lib/operations-types";
import { Check, Clock3, Edit3, Shield, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Member = {
  id: Id<"users">;
  authUserId: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  assignedMachineIds: Id<"machines">[];
};
type Machine = { id: Id<"machines">; name: string; code: string; operatorRole: Role };

const roleOptions = Object.keys(roleLabels) as Role[];

export function StaffDetailDrawer({
  member,
  machines,
  currentAuthUserId,
  onSave,
  onClose,
}: {
  member: Member | null;
  machines: Machine[];
  currentAuthUserId?: string;
  onSave: (userId: Id<"users">, values: { role: Role; active: boolean; machineIds: Id<"machines">[] }) => Promise<void>;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<Role>("storekeeper");
  const [active, setActive] = useState(true);
  const [machineIds, setMachineIds] = useState<Id<"machines">[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!member) return;
    setEditing(false);
    setRole(member.role);
    setActive(member.active);
    setMachineIds(member.assignedMachineIds);
    setMessage("");
  }, [member]);

  useEffect(() => {
    if (!member) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === "Escape") requestClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  const operatorRole = role.endsWith("_operator");
  const availableMachines = useMemo(() => machines.filter((machine) => machine.operatorRole === role), [machines, role]);
  const dirty = Boolean(member && (role !== member.role || active !== member.active || machineIds.join(",") !== member.assignedMachineIds.join(",")));
  const isSelf = member?.authUserId === currentAuthUserId;

  function requestClose() {
    if (dirty && !window.confirm("You have unsaved changes. Do you want to discard them?")) return;
    onClose();
  }

  function toggleMachine(machineId: Id<"machines">) {
    setMachineIds((current) => current.includes(machineId) ? current.filter((id) => id !== machineId) : [...current, machineId]);
  }

  async function save() {
    if (!member) return;
    setBusy(true); setMessage("");
    try { await onSave(member.id, { role, active, machineIds: operatorRole ? machineIds : [] }); setEditing(false); onClose(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save staff changes."); }
    finally { setBusy(false); }
  }

  if (!member) return null;
  const initials = member.name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${member.name} profile`}>
    <button type="button" aria-label="Close staff profile" className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm" onClick={requestClose} />
    <aside className="animate-slide-in-right relative flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl">
      <header className="shrink-0 border-b border-border/60 px-5 py-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-sm font-bold text-white">{initials}</span><div><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Staff profile</p><h2 className="mt-1 text-lg font-bold text-foreground">{member.name}</h2><span className="mt-1 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">{roleLabels[member.role]?.en ?? member.role}</span></div></div><div className="flex items-center gap-2"><button type="button" onClick={() => setEditing((value) => !value)} className={cn("inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[10px] font-semibold", editing ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}><Edit3 size={12} /> {editing ? "Viewing" : "Edit profile"}</button><button type="button" onClick={requestClose} aria-label="Close staff profile" className="grid h-8 w-8 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:text-foreground"><X size={15} /></button></div></div></header>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {!editing ? <>
          <section className="grid gap-4 rounded-xl border border-border/60 bg-background/30 p-4 sm:grid-cols-2"><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Full name</p><p className="mt-1 text-sm font-semibold text-foreground">{member.name}</p></div><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Email</p><p className="mt-1 break-all text-xs text-foreground">{member.email}</p></div><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Role</p><p className="mt-1 text-sm font-semibold text-foreground">{roleLabels[member.role]?.en ?? member.role}</p></div><div><p className="text-[9px] uppercase tracking-wider text-muted-foreground">Account status</p><p className={cn("mt-1 inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold", member.active ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger")}>{member.active ? "Active" : "Suspended"}</p></div></section>
          <section className="rounded-xl border border-border/60 bg-background/30 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground"><Shield size={14} className="text-primary" /> Machine access</div>{member.assignedMachineIds.length ? <div className="flex flex-wrap gap-2">{member.assignedMachineIds.map((machineId) => { const machine = machines.find((item) => item.id === machineId); return <span key={machineId} className="rounded-full border border-border px-2 py-1 text-[10px] text-foreground">{machine?.name ?? machineId}</span>; })}</div> : <p className="text-[11px] text-muted-foreground">No specific machines selected. Role scope applies to active machines.</p>}</section>
          <section className="rounded-xl border border-border/60 bg-background/30 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground"><Clock3 size={14} className="text-primary" /> Login audit</div><p className="text-[11px] text-muted-foreground">Login history is not currently captured in the application audit stream.</p></section>
        </> : <section className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">Changes apply immediately to this staff account and the directory will update without a page reload.</div>
          <label className="block text-xs text-muted-foreground">Assigned role<select value={role} disabled={isSelf || (member.role === "owner" && !isSelf)} onChange={(event) => { setRole(event.target.value as Role); if (!event.target.value.endsWith("_operator")) setMachineIds([]); }} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground"><option value="owner">Owner</option>{roleOptions.filter((option) => option !== "owner").map((option) => <option key={option} value={option}>{roleLabels[option].en}</option>)}</select></label>
          {operatorRole ? <div><p className="mb-2 text-xs text-muted-foreground">Assigned machines</p><div className="grid gap-2 sm:grid-cols-2">{availableMachines.map((machine) => <label key={machine.id} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-[11px] text-foreground"><input type="checkbox" checked={machineIds.includes(machine.id)} onChange={() => toggleMachine(machine.id)} />{machine.name} <span className="text-muted-foreground">({machine.code})</span></label>)}</div><p className="mt-2 text-[10px] text-muted-foreground">Leave all unchecked to allow the operator role to use every active machine.</p></div> : <p className="rounded-lg border border-border/60 bg-background/30 p-3 text-[11px] text-muted-foreground">Machine assignment is available for machine operator roles only.</p>}
          <label className="flex items-center justify-between rounded-xl border border-border/60 bg-background/30 px-4 py-3 text-xs text-foreground"><span><strong className="block">Account status</strong><span className="text-[10px] text-muted-foreground">Suspended accounts cannot sign in.</span></span><button type="button" role="switch" aria-checked={active} onClick={() => setActive((value) => !value)} className={cn("relative h-6 w-11 rounded-full transition-colors", active ? "bg-success" : "bg-muted")}><span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", active ? "left-6" : "left-1")} /></button></label>
        </section>}
        {message ? <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-[11px] text-danger">{message}</p> : null}
      </div>
      <footer className="shrink-0 space-y-3 border-t border-border/60 px-5 py-4">{editing ? <div className="flex gap-2"><button type="button" onClick={() => { setRole(member.role); setActive(member.active); setMachineIds(member.assignedMachineIds); setEditing(false); }} className="flex-1 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">Cancel</button><button type="button" disabled={busy || isSelf} onClick={() => void save()} className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button></div> : <div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled className="rounded-md border border-border px-3 py-2 text-[10px] font-semibold text-muted-foreground/50" title="Requires Better Auth admin impersonation support">Impersonate user</button><button type="button" disabled className="rounded-md border border-border px-3 py-2 text-[10px] font-semibold text-muted-foreground/50" title="Requires configured email delivery">Reset password / invite</button></div>}<p className="text-center text-[9px] uppercase tracking-[0.16em] text-muted-foreground/60">{isSelf ? "Your own role cannot be changed here" : "Owner directory controls"}</p></footer>
    </aside>
  </div>;
}
