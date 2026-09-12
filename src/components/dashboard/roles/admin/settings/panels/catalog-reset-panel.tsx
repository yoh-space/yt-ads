"use client";

import { useState } from "react";
import { AlertTriangle, DatabaseZap, ShieldAlert } from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/shared/ui";
import { FormMessage, FormSection } from "../chrome/form";

const CONFIRMATION_KEY = "PURGE_YT_2026";

/**
 * Owner-only control that wipes all operational data and re-seeds the exact
 * 23 raw-material catalog categories with every variant. Reusable: can be
 * invoked repeatedly to reset the database to the canonical catalog state.
 */
export function CatalogResetPanel() {
  const purgeAndReseedCatalog = useMutation(api.admin.purgeAndReseedCatalog);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmationKey, setConfirmationKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  async function executeReset() {
    if (confirmationKey !== CONFIRMATION_KEY) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await purgeAndReseedCatalog({ confirmKey: confirmationKey });
      setConfirmationOpen(false);
      setConfirmationKey("");
      toast.success(`Catalog reseeded: ${result.insertedCount} materials inserted`);
      setMessage({ text: `Catalog reseeded successfully. ${result.insertedCount} materials inserted.`, tone: "success" });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Unable to reseed catalog.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-coral/40 bg-card">
      <FormSection icon={<ShieldAlert size={17} />} tone="coral" title="Danger zone: catalog purge & reseed" note="Owner only · reusable operation">
        <div className="space-y-4">
          <div className="rounded-lg border border-coral/40 bg-coral/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 flex-none text-coral" size={20} />
              <p className="m-0 text-sm font-semibold leading-6 text-coral">
                DANGER ZONE: Catalog Purge & Reseed. This action will permanently erase all operational data (materials, job cards, orders, inventory, requests, stock movements, and more) and re-seed the exact 23 raw-material catalog categories with all variants.
              </p>
            </div>
          </div>
          <p className="m-0 text-sm text-muted-foreground">
            This is a reusable reset: it can be invoked at any time to restore the database to the canonical 23-category catalog. All production history, customer records, and inventory balances will be permanently deleted.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button className="bg-coral text-white hover:bg-coral/90" type="button" onClick={() => setConfirmationOpen(true)}>
              <DatabaseZap size={15} />
              Purge & Reseed Catalog
            </Button>
            {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
          </div>
        </div>
      </FormSection>

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="catalog-reset-dialog-title">
          <div className="w-full max-w-lg rounded-xl border border-coral/50 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-coral/15 text-coral"><AlertTriangle size={20} /></span>
              <div>
                <h2 id="catalog-reset-dialog-title" className="m-0 text-lg font-bold text-foreground">Confirm catalog purge & reseed</h2>
                <p className="mt-1 text-sm text-muted-foreground">This cannot be undone. All operational data will be deleted and replaced with the 23-category catalog.</p>
              </div>
            </div>
            <label className="block text-sm font-semibold text-foreground" htmlFor="catalog-reset-confirmation-key">
              Type <code className="rounded bg-secondary px-1.5 py-0.5 text-coral">{CONFIRMATION_KEY}</code> to continue.
            </label>
            <input
              id="catalog-reset-confirmation-key"
              autoFocus
              value={confirmationKey}
              onChange={(event) => setConfirmationKey(event.target.value)}
              className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              aria-describedby="catalog-reset-confirmation-help"
            />
            <p id="catalog-reset-confirmation-help" className="mt-2 text-xs text-muted-foreground">The confirmation is case-sensitive.</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" type="button" disabled={busy} onClick={() => { setConfirmationOpen(false); setConfirmationKey(""); }}>Cancel</Button>
              <Button className="bg-coral text-white hover:bg-coral/90" type="button" disabled={busy || confirmationKey !== CONFIRMATION_KEY} onClick={() => void executeReset()}>
                {busy ? "Reseeding…" : "Permanently purge & reseed"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}