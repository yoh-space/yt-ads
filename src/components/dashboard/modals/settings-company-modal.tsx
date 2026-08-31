"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Building2, Save } from "lucide-react";
import { ModalShell } from "./modal-shell";

export function CompanySettingsModal({ onClose }: { onClose: () => void }) {
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
      const message = "Company branding updated.";
      setMessage(message);
      toast.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update company settings.";
      setMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Company Profile" subtitle="Manage workspace branding and company information." onClose={onClose}>
      <div className="modal-form">
        <section className="settings-section">
          <div className="settings-section-head">
            <Building2 size={17} />
            <div>
              <strong>Company branding</strong>
              <span>Owner-only workspace settings.</span>
            </div>
          </div>
          <form onSubmit={saveCompany}>
            <label>
              Company name
              <input required value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
            </label>
            <label>
              Logo URL
              <input placeholder="Optional logo image URL" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} />
            </label>
            <button className="button primary" type="submit" disabled={busy}>
              <Save size={15} />
              Save company settings
            </button>
          </form>
        </section>
        {message ? <p className="form-message">{message}</p> : null}
      </div>
    </ModalShell>
  );
}
