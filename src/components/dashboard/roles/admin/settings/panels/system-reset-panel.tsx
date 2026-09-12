"use client";

import { useState } from "react";
import { AlertTriangle, DatabaseZap, ShieldAlert } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/shared/ui";
import { FormMessage, FormSection } from "../chrome/form";

const CONFIRMATION_KEY = "RESET-SYSTEM-DATA";

export function SystemResetPanel() {
  const status = useQuery(api.resetSystemData.getResetStatus, {});
  const resetSystemData = useMutation(api.resetSystemData.resetSystemData);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationKey, setConfirmationKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  if (status?.dataResetExecuted === true) return null;

  async function executeReset() {
    if (confirmationKey !== CONFIRMATION_KEY) return;
    setBusy(true);
    setMessage(null);
    try {
      await resetSystemData({ confirmationKey });
      setConfirmationOpen(false);
      setConfirmationKey("");
      toast.success("System successfully reset to fresh state");
      setMessage({ text: "System successfully reset to fresh state.", tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Unable to reset system data.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-coral/40 bg-card">
      <FormSection icon={<ShieldAlert size={17} />} tone="coral" title="Danger zone: full system data reset" note="Owner only · irreversible · wipes everything except non-operator staff">
        <div className="space-y-4">
          <div className="rounded-lg border border-coral/40 bg-coral/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 flex-none text-coral" size={20} />
              <p className="m-0 text-sm font-semibold leading-6 text-coral">
                DANGER ZONE: Full System Reset. This action will permanently erase ALL data — orders, inventory logs, customers, machine configs, material catalog, operational configuration, and operator staff profiles. This cannot be undone.
              </p>
            </div>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            <strong>Preserved:</strong> owner, manager, admin, storekeeper, and receptionist staff profiles, company settings, and system config.
          </p>
          <p className="m-0 text-sm text-muted-foreground">
            <strong>Wiped:</strong> all materials, machines, capabilities, service definitions, service routes, ink rules, material links, BOM, operator roles &amp; assignments, job cards, orders, stock movements, production logs, reconciliations, offcuts, scraps, notifications, and Telegram sessions.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="bg-coral text-white hover:bg-coral/90" type="button" onClick={() => setConfirmationOpen(true)}>
              <DatabaseZap size={15} />
              Reset All System Data
            </Button>
            {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
          </div>
        </div>
      </FormSection>

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
          <div className="w-full max-w-lg rounded-xl border border-coral/50 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-coral/15 text-coral"><AlertTriangle size={20} /></span>
              <div>
                <h2 id="reset-dialog-title" className="m-0 text-lg font-bold text-foreground">Confirm permanent system reset</h2>
                <p className="mt-1 text-sm text-muted-foreground">This cannot be undone. All operational and customer data will be deleted.</p>
              </div>
            </div>
            <label className="block text-sm font-semibold text-foreground" htmlFor="reset-confirmation-key">
              Type <code className="rounded bg-secondary px-1.5 py-0.5 text-coral">{CONFIRMATION_KEY}</code> to continue.
            </label>
            <input
              id="reset-confirmation-key"
              autoFocus
              value={confirmationKey}
              onChange={(event) => setConfirmationKey(event.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              aria-describedby="reset-confirmation-help"
            />
            <p id="reset-confirmation-help" className="mt-2 text-xs text-muted-foreground">The confirmation is case-sensitive.</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" type="button" disabled={busy} onClick={() => { setConfirmationOpen(false); setConfirmationKey(""); }}>Cancel</Button>
              <Button className="bg-coral text-white hover:bg-coral/90" type="button" disabled={busy || confirmationKey !== CONFIRMATION_KEY} onClick={() => void executeReset()}>
                {busy ? "Resetting…" : "Permanently reset data"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
