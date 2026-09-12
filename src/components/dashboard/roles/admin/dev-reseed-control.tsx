"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, DatabaseZap, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/shared/ui";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";

const PURGE_KEY = "PURGE_YT_2026";

export function DevReseedControl() {
  const purgeAndReseed = useMutation(api.admin.materials.purgeAndReseedCatalog);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmKey, setConfirmKey] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [lastResult, setLastResult] = useState<{ count: number; timestamp: number } | null>(null);

  async function handleReseed() {
    if (confirmKey !== PURGE_KEY) {
      toast.error("Please enter the exact confirmation key: " + PURGE_KEY);
      return;
    }
    setIsPending(true);
    try {
      const res = await purgeAndReseed({ confirmKey });
      setLastResult({ count: res.insertedCount, timestamp: Date.now() });
      toast.success(`Catalog purged and reseeded with ${res.insertedCount} items!`);
      setModalOpen(false);
      setConfirmKey("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to purge and reseed database.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Panel className="border-cyan/40 bg-gradient-to-br from-card to-cyan-950/10">
      <PanelHeader
        title="Developer / Admin Database Tools"
        subtitle="Purge legacy operational data and reseed the authoritative 23-category raw material master catalog."
        kicker="Dev & Maintenance Tools"
        icon={<DatabaseZap size={16} className="text-cyan" />}
      />
      <div className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles size={15} className="text-cyan" /> Purge & Reseed Exact 23 Raw Material Catalog
            </h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Wipes legacy test records and repopulates the database with the complete 23 master material categories (all 85 owner-defined variants) with exact dimensions, units, and machine compatibility. Takes &lt; 1 second.
            </p>
            {lastResult ? (
              <div className="mt-2 flex items-center gap-2 text-xs font-medium text-emerald-400">
                <CheckCircle2 size={14} /> Reseeded {lastResult.count} materials at{" "}
                {new Date(lastResult.timestamp).toLocaleTimeString()}
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            onClick={() => {
              setConfirmKey(PURGE_KEY);
              setModalOpen(true);
            }}
            className="flex-none bg-cyan hover:bg-cyan/90 text-background font-bold text-xs gap-2 shadow-lg shadow-cyan/20"
          >
            <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
            Purge & Reseed Catalog
          </Button>
        </div>

        {modalOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-xl border border-cyan/40 bg-card p-6 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-cyan/15 text-cyan">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Confirm Database Purge & Reseed</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    This will wipe legacy materials, stock, and request logs, and reseed the exact 23 master categories (85 items).
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-foreground">
                  Confirmation Key (Preset: <code className="text-cyan font-mono">{PURGE_KEY}</code>)
                </label>
                <input
                  type="text"
                  value={confirmKey}
                  onChange={(e) => setConfirmKey(e.target.value)}
                  placeholder={PURGE_KEY}
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-xs font-mono text-foreground outline-none focus:border-cyan"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  type="button"
                  disabled={isPending}
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isPending || confirmKey !== PURGE_KEY}
                  onClick={() => void handleReseed()}
                  className="bg-cyan hover:bg-cyan/90 text-background font-bold text-xs gap-1.5"
                >
                  {isPending ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Reseeding…
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} /> Execute Reseed
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
