"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/owner/owner-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SectionLabel, MetricValue } from "@/components/ui/typography";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { CircleDollarSign, Wallet, Hourglass, CreditCard } from "lucide-react";

const etb = (value: number) => `ETB ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function OwnerRevenuePage() {
  const revenue = useQuery(api.owner.revenue.getRevenueSummary);

  if (revenue === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Revenue…" />
      </div>
    );
  }

  const paidPercent = revenue.paidOrderCount > 0
    ? Math.round((revenue.paidOrderCount / (revenue.paidOrderCount + revenue.pendingPaymentCount)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Revenue & Profit · ገቢ እና ትርፍ"
        title="Revenue"
        subtitle="Money in, payments waiting, and credit given out."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CircleDollarSign size={16} />}
          label="Total Paid Revenue"
          subtitle="የተከፈለ ገቢ"
          value={etb(revenue.totalRevenue)}
          description={`${revenue.paidOrderCount} paid orders in total.`}
          variant="sales"
        />
        <StatCard
          icon={<Wallet size={16} />}
          label="Paid Today"
          subtitle="ዛሬ የተከፈለ"
          value={etb(revenue.todayPaid)}
          description={`From ${revenue.todayOrderCount} orders created today.`}
          variant="profit"
        />
        <StatCard
          icon={<Hourglass size={16} />}
          label="Awaiting Payment"
          subtitle="ክፍያ በመጠባበቅ ላይ"
          value={etb(revenue.pendingPaymentTotal)}
          description={`${revenue.pendingPaymentCount} orders are awaiting payment.`}
          variant="cost"
        />
        <StatCard
          icon={<CreditCard size={16} />}
          label="Outstanding Credit"
          subtitle="ያልተከፈለ ብድር"
          value={etb(revenue.outstandingCredit)}
          description="Approved credit yet to be collected."
          variant="alert"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Payment Health"
            subtitle="የክፍያ ሁኔታ"
            kicker="Collections"
            icon={<Wallet size={16} />}
          />
          <div className="p-[17px] space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <SectionLabel tone="muted">Paid share of all orders</SectionLabel>
                <MetricValue size="sm">{paidPercent}%</MetricValue>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
                <div className="h-full rounded-full bg-gradient-to-r from-green to-cyan" style={{ width: `${paidPercent}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                <SectionLabel tone="muted">Paid orders</SectionLabel>
                <MetricValue size="md">{revenue.paidOrderCount}</MetricValue>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
                <SectionLabel tone="muted">Awaiting payment</SectionLabel>
                <MetricValue size="md">{revenue.pendingPaymentCount}</MetricValue>
              </div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Breakdown"
            subtitle="ዝርዝር"
            kicker="Summary"
            icon={<CircleDollarSign size={16} />}
          />
          <div className="p-[17px] space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Total paid revenue</span>
              <MetricValue size="sm">{etb(revenue.totalRevenue)}</MetricValue>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Paid today</span>
              <MetricValue size="sm">{etb(revenue.todayPaid)}</MetricValue>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Awaiting payment</span>
              <MetricValue size="sm" tone="negative">{etb(revenue.pendingPaymentTotal)}</MetricValue>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">Outstanding credit</span>
              <MetricValue size="sm" tone="negative">{etb(revenue.outstandingCredit)}</MetricValue>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}