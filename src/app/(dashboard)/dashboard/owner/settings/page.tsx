"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { SecurityPanel } from "@/components/dashboard/roles/admin/settings/panels/security-panel";
import {
  AlertTriangle,
  Building2,
  BellRing,
  Check,
  Clock3,
  FileBarChart,
  LockKeyhole,
  Save,
  Settings2,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SystemResetPanel } from "@/components/dashboard/roles/admin/settings/panels/system-reset-panel";

type Tab =
  | "profile"
  | "security"
  | "reports"
  | "notifications"
  | "payments"
  | "preferences"
  | "system-reset";
type PreferenceKey = "inventory" | "approvals" | "reconciliation" | "financial";
type Channel = "In-App" | "Email" | "Telegram";
type Draft = {
  companyName: string;
  industry: string;
  taxId: string;
  phone: string;
  address: string;
  timezone: string;
  logoUrl: string;
  reportAutomationEnabled: boolean;
  reportFrequency: string;
  reportRecipients: string[];
  reportDeliveryTime: string;
  notifications: Record<
    `${PreferenceKey}${"InApp" | "Email" | "Telegram"}`,
    boolean
  >;
  payments: {
    cbe: { accountName: string; accountNumber: string; enabled: boolean };
    boa: { accountName: string; accountNumber: string; enabled: boolean };
    telebirr: { displayName: string; merchantId: string; enabled: boolean };
    cbeBirr: { displayName: string; merchantId: string; enabled: boolean };
  };
};

const tabs: Array<{ id: Tab; label: string; icon: typeof Building2 }> = [
  { id: "profile", label: "Company Profile", icon: Building2 },
  { id: "security", label: "Account & Security", icon: LockKeyhole },
  { id: "notifications", label: "Notifications & Alerts", icon: BellRing },
  { id: "payments", label: "Customer Payments", icon: Check },
  { id: "preferences", label: "System Preferences", icon: Settings2 },
  { id: "system-reset", label: "System Data Reset", icon: AlertTriangle },
];
const preferenceRows: Array<{
  key: PreferenceKey;
  label: string;
  description: string;
}> = [
  {
    key: "inventory",
    label: "Inventory & stock alerts",
    description: "Low stock, expiry, and unlinked usage anomalies.",
  },
  {
    key: "approvals",
    label: "Approval requests",
    description: "Manager stock-outs and high-value discount overrides.",
  },
  {
    key: "reconciliation",
    label: "Reconciliation discrepancies",
    description: "Unresolved shortages and variance clearance alerts.",
  },
  {
    key: "financial",
    label: "Financial milestones",
    description: "Sales targets and overdue order flags.",
  },
];
const channels: Channel[] = ["In-App", "Email", "Telegram"];
const emptyNotifications = {
  inventoryInApp: true,
  inventoryEmail: false,
  inventoryTelegram: false,
  approvalsInApp: true,
  approvalsEmail: true,
  approvalsTelegram: false,
  reconciliationInApp: true,
  reconciliationEmail: true,
  reconciliationTelegram: false,
  financialInApp: true,
  financialEmail: false,
  financialTelegram: false,
};

function makeDraft(
  company: NonNullable<
    ReturnType<typeof useQuery<typeof api.users.getCompanySettings>>
  >
): Draft {
  const preferences = company?.notificationPreferences ?? emptyNotifications;
  const configured = company?.paymentInstructions;
  return {
    companyName: company?.companyName ?? "",
    industry: company?.industry ?? "",
    taxId: company?.taxId ?? "",
    phone: company?.phone ?? "",
    address: company?.address ?? "",
    timezone: company?.timezone ?? "Africa/Addis_Ababa",
    logoUrl: company?.logoUrl ?? "",
    reportAutomationEnabled: company?.reportAutomationEnabled ?? false,
    reportFrequency: company?.reportFrequency ?? "weekly",
    reportRecipients: company?.reportRecipients ?? [],
    reportDeliveryTime: company?.reportDeliveryTime ?? "18:00",
    notifications: { ...emptyNotifications, ...preferences },
    payments: {
      cbe: configured?.cbe ?? {
        accountName: "",
        accountNumber: "",
        enabled: false,
      },
      boa: configured?.boa ?? {
        accountName: "",
        accountNumber: "",
        enabled: false,
      },
      telebirr: configured?.telebirr ?? {
        displayName: "",
        merchantId: "",
        enabled: false,
      },
      cbeBirr: configured?.cbeBirr ?? {
        displayName: "",
        merchantId: "",
        enabled: false,
      },
    },
  };
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
          checked ? "left-6" : "left-1"
        )}
      />
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}

export default function OwnerSettingsPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const company = useQuery(api.users.getCompanySettings);
  const updateCompany = useMutation(api.users.updateCompanySettings);
  const [tab, setTab] = useState<Tab>("profile");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");

  useEffect(() => {
    if (company && !draft) {
      const initial = makeDraft(company);
      setDraft(initial);
      setSaved(initial);
    }
  }, [company, draft]);
  const dirty = Boolean(
    draft && saved && JSON.stringify(draft) !== JSON.stringify(saved)
  );
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(current => (current ? { ...current, [key]: value } : current));
    setMessage("");
  };
  const addRecipient = () => {
    const email = recipientInput.trim();
    if (
      !email ||
      !email.includes("@") ||
      draft?.reportRecipients.includes(email)
    )
      return;
    update("reportRecipients", [...(draft?.reportRecipients ?? []), email]);
    setRecipientInput("");
  };
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setMessage("");
    try {
      await updateCompany({
        companyName: draft.companyName,
        logoUrl: draft.logoUrl || undefined,
        industry: draft.industry,
        address: draft.address,
        phone: draft.phone,
        taxId: draft.taxId,
        timezone: draft.timezone,
        reportAutomationEnabled: draft.reportAutomationEnabled,
        reportFrequency: draft.reportFrequency,
        reportRecipients: draft.reportRecipients,
        reportDeliveryTime: draft.reportDeliveryTime,
        notificationPreferences: { ...draft.notifications },
        paymentInstructions: draft.payments,
      });
      setSaved(draft);
      setMessage("Settings saved successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save settings."
      );
    } finally {
      setBusy(false);
    }
  };
  const discard = () => {
    if (saved) setDraft(saved);
    setMessage("Changes discarded.");
  };
  const selectedTab = useMemo(() => tabs.find(item => item.id === tab)!, [tab]);

  if (profile === undefined || company === undefined || draft === null)
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Settings…" />
      </div>
    );
  if (!profile || profile.role !== "owner")
    return (
      <div className="p-8 text-sm text-danger">
        Owner access is required for workspace settings.
      </div>
    );

  return (
    <div className="space-y-6 pb-20">
      <OwnerPageHeader
        kicker="Settings · ማስተካከያ"
        title="Workspace Control Center"
      />
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <nav className="h-fit rounded-xl border border-border bg-card p-2 lg:sticky lg:top-4">
          <p className="px-3 pb-2 pt-2 text-[9px] font-mono uppercase tracking-[0.16em] text-muted-foreground">
            Workspace settings
          </p>
          {tabs.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-xs font-semibold transition-colors",
                  tab === item.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                )}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <main className="min-w-0 space-y-4">
          <Panel>
            <PanelHeader
              title={selectedTab.label}
              subtitle="Owner-only workspace configuration"
              kicker="Control center"
              icon={<selectedTab.icon size={16} />}
            />
            {tab === "profile" ? (
              <div className="space-y-5 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Company name"
                    value={draft.companyName}
                    onChange={value => update("companyName", value)}
                  />
                  <Field
                    label="Industry type"
                    value={draft.industry}
                    onChange={value => update("industry", value)}
                    placeholder="Printing and advertising"
                  />
                  <Field
                    label="Tax ID / TIN"
                    value={draft.taxId}
                    onChange={value => update("taxId", value)}
                  />
                  <Field
                    label="Phone number"
                    value={draft.phone}
                    onChange={value => update("phone", value)}
                  />
                  <Field
                    label="Physical address"
                    value={draft.address}
                    onChange={value => update("address", value)}
                  />
                  <Field
                    label="Timezone"
                    value={draft.timezone}
                    onChange={value => update("timezone", value)}
                  />
                </div>
                <div className="rounded-xl border border-dashed border-border bg-background/30 p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-xl border border-border bg-muted/20">
                      {draft.logoUrl ? (
                        <img
                          src={draft.logoUrl}
                          alt="Company logo preview"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Building2
                          size={24}
                          className="text-muted-foreground"
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Company logo
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        PNG, SVG, or JPEG. Used on reports.
                      </p>
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground">
                        <Upload size={13} /> Upload logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml"
                          className="hidden"
                          onChange={event => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () =>
                              update("logoUrl", String(reader.result));
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  {draft.logoUrl ? (
                    <button
                      type="button"
                      onClick={() => update("logoUrl", "")}
                      className="mt-3 text-[10px] text-danger"
                    >
                      Remove logo
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {tab === "security" ? (
              <div className="p-1">
                <SecurityPanel isOwner />
              </div>
            ) : null}
            {tab === "reports" ? (
              <div className="space-y-5 p-5">
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/30 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Automated report dispatch
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Send scheduled PDF or CSV reports to configured
                      recipients.
                    </p>
                  </div>
                  <Toggle
                    checked={draft.reportAutomationEnabled}
                    onChange={value => update("reportAutomationEnabled", value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs text-muted-foreground">
                    Delivery frequency
                    <select
                      value={draft.reportFrequency}
                      onChange={event =>
                        update("reportFrequency", event.target.value)
                      }
                      className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground"
                    >
                      <option value="daily">Daily summary</option>
                      <option value="weekly">Weekly executive digest</option>
                      <option value="monthly">
                        Monthly financial statement
                      </option>
                    </select>
                  </label>
                  <Field
                    label="Preferred delivery time"
                    type="time"
                    value={draft.reportDeliveryTime}
                    onChange={value => update("reportDeliveryTime", value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Recipient emails
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 rounded-md border border-border bg-background p-2">
                    {draft.reportRecipients.map(email => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() =>
                            update(
                              "reportRecipients",
                              draft.reportRecipients.filter(
                                item => item !== email
                              )
                            )
                          }
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      value={recipientInput}
                      onChange={event => setRecipientInput(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addRecipient();
                        }
                      }}
                      onBlur={addRecipient}
                      placeholder="Add email and press Enter"
                      className="min-w-48 flex-1 bg-transparent px-1 py-1 text-xs text-foreground outline-none"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Reports are configured here; delivery requires a configured
                    mail connector.
                  </p>
                </div>
              </div>
            ) : null}
            {tab === "payments" ? (
              <div className="space-y-4 p-5">
                <p className="text-xs text-muted-foreground">
                  These customer-facing instructions are snapshotted when a
                  quote is committed. Enable at least one channel.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      [
                        "cbe",
                        "Commercial Bank of Ethiopia",
                        "Account name",
                        "Account number",
                      ],
                      [
                        "boa",
                        "Bank of Abyssinia",
                        "Account name",
                        "Account number",
                      ],
                      [
                        "telebirr",
                        "Telebirr",
                        "Display name",
                        "Merchant ID / mobile number",
                      ],
                      [
                        "cbeBirr",
                        "CBE Birr",
                        "Display name",
                        "Merchant ID / mobile number",
                      ],
                    ] as const
                  ).map(([key, label, nameLabel, idLabel]) => {
                    const value = draft.payments[key];
                    return (
                      <div
                        key={key}
                        className="rounded-lg border border-border p-4"
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            {label}
                          </span>
                          <Toggle
                            checked={value.enabled}
                            onChange={enabled =>
                              update("payments", {
                                ...draft.payments,
                                [key]: { ...value, enabled },
                              })
                            }
                          />
                        </div>
                        <Field
                          label={nameLabel}
                          value={
                            "accountName" in value
                              ? value.accountName
                              : value.displayName
                          }
                          onChange={text =>
                            update("payments", {
                              ...draft.payments,
                              [key]:
                                "accountName" in value
                                  ? { ...value, accountName: text }
                                  : { ...value, displayName: text },
                            })
                          }
                        />
                        <div className="mt-3">
                          <Field
                            label={idLabel}
                            value={
                              "accountNumber" in value
                                ? value.accountNumber
                                : value.merchantId
                            }
                            onChange={text =>
                              update("payments", {
                                ...draft.payments,
                                [key]:
                                  "accountNumber" in value
                                    ? { ...value, accountNumber: text }
                                    : { ...value, merchantId: text },
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {tab === "preferences" ? (
              <div className="space-y-4 p-5">
                <div className="rounded-xl border border-border/60 bg-background/30 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Settings2 size={15} className="text-primary" /> System
                    defaults
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Workspace timezone
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {draft.timezone}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                        Security context
                      </p>
                      <p className="mt-1 text-xs font-semibold text-success">
                        Owner-only configuration
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-[11px] text-muted-foreground">
                  <ShieldCheck size={14} className="mb-2 text-primary" />
                  Operational thresholds, reorder policy, and valuation rates
                  are managed from the Operational Configuration workspace.
                </div>
              </div>
            ) : null}
            {tab === "system-reset" ? (
              <div className="p-5">
                <SystemResetPanel />
              </div>
            ) : null}
          </Panel>
        </main>
      </div>
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur transition-transform print:hidden",
          dirty ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            {message || "You have unsaved workspace changes."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discard}
              className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Save size={13} />
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
