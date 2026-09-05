"use client";

import { useState } from "react";
import { DatabaseZap } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui";
import { FormMessage, FormSection } from "../chrome/form";
import { messageToneFromText } from "./security-utils";

export function MigrationPanel() {
  const runMigration = useMutation(api.migrations.runPackageMetadataMigration);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startMigration() {
    setBusy(true);
    setMessage("");
    try {
      const result = await runMigration({});
      setMessage(result.skipped
        ? "Package metadata migration has already run."
        : "Package metadata migration scheduled. Refresh inventory after it completes.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to schedule package metadata migration.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <FormSection icon={<DatabaseZap size={17} />} tone="blue" title="Data migration" note="Owner/admin only · one-time operation">
        <div className="space-y-4">
          <p className="m-0 text-sm text-gray-600">
            Backfill missing physical package units, labels, and package sizes from existing purchase units and conversion ratios. Existing inventory history is preserved.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" type="button" disabled={busy} onClick={() => void startMigration()}>
              <DatabaseZap size={15} />
              {busy ? "Scheduling migration…" : "Run package metadata migration"}
            </Button>
            {message ? <FormMessage tone={messageToneFromText(message)}>{message}</FormMessage> : null}
          </div>
        </div>
      </FormSection>
    </div>
  );
}
