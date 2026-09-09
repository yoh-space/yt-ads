"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Building2, Save } from "lucide-react";
import { Button, Input } from "@/components/shared/ui";
import { FieldLabel, FormMessage, FormSection } from "../chrome/form";
import { messageToneFromText } from "./security-utils";

/**
 * Owner-only workspace branding (name + logo URL) persisted via
 * `users.updateCompanySettings` and reflected in the dashboard sidebar/header.
 */
export function CompanyPanel() {
  const company = useQuery(api.users.getCompanySettings);
  const updateCompanySettings = useMutation(api.users.updateCompanySettings);
  const [companyName, setCompanyName] = useState(company?.companyName ?? "");
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!company) return;
    setCompanyName(company.companyName);
    setLogoUrl(company.logoUrl ?? "");
  }, [company]);

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await updateCompanySettings({ companyName, logoUrl: logoUrl.trim() || undefined });
      setMessage("Company branding updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update company settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      <FormSection icon={<Building2 size={17} />} tone="blue" title="Company branding" note="Owner-only workspace settings.">
        <form onSubmit={saveCompany} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Company name</FieldLabel>
              <Input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Logo URL</FieldLabel>
              <Input
                placeholder="Optional logo image URL"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>
          </div>
          {logoUrl.trim() ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-navy/20 px-4 py-3">
              <span className="grid h-11 w-11 flex-none place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-border">
                <img src={logoUrl} alt="Company logo preview" className="h-full w-full object-cover" />
              </span>
              <div>
                <strong className="block text-sm font-semibold text-foreground">Logo preview</strong>
                <small className="block text-xs text-muted-foreground">
                  Applied to the dashboard sidebar and header.
                </small>
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={busy}>
              <Save size={15} />
              Save company settings
            </Button>
            {message ? (
              <FormMessage tone={messageToneFromText(message)}>{message}</FormMessage>
            ) : null}
          </div>
        </form>
      </FormSection>
    </div>
  );
}
