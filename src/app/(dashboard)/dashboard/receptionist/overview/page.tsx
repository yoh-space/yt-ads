"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowRight, ClipboardCheck, Hourglass, Inbox, ShoppingCart, Wallet } from "lucide-react";
import { WorkspacePageHeader } from "@/components/dashboard/workspace-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SectionLabel } from "@/components/ui/typography";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";

const ETB_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export default function ReceptionistOverviewPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);
  const overview = useQuery(api.receptionist.overview.getOverview);

  if (overview === undefined || !profile) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Reception Overview…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Reception Desk"
        title="Overview"
        subtitle="Today's intake, payment follow-ups, and production status at the front desk."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Inbox size={16} />}
          label="Orders Today"
          subtitle="የዛሬ ትእዛዞች"
          value={overview.todaysIntakeCount}
          description="New walk-ins and portal intake since midnight"
          variant="default"
        />
        <StatCard
          icon={<ClipboardCheck size={16} />}
          label="Pending Review"
          subtitle="ክለሳ የሚፈልጉ"
          value={overview.pendingReviewCount}
          description="Awaiting pricing at the desk"
          variant="default"
        />
        <StatCard
          icon={<Wallet size={16} />}
          label="Awaiting Payment"
          subtitle="ክፍያ በመጠበቅ ላይ"
          value={`ETB ${ETB_FORMAT.format(overview.awaitingPaymentAmount)}`}
          description={`${overview.awaitingPaymentCount} order${overview.awaitingPaymentCount === 1 ? "" : "s"} priced · awaiting payment`}
          variant="sales"
        />
        <StatCard
          icon={<Hourglass size={16} />}
          label="Overdue"
          subtitle="የጊዜያቸው ያበቁ"
          value={overview.overdueCount}
          description={`${overview.inProductionCount} currently in production`}
          variant="alert"
          isAlert={overview.overdueCount > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Recent Orders"
            subtitle="የቅርብ ጊዜ ተእዛዞች"
            kicker="Intake"
            icon={<ShoppingCart size={16} />}
          />
          <div className="p-[17px]">
            {overview.recentOrders.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No orders yet today.</p>
            ) : (
              <ul className="space-y-2">
                {overview.recentOrders.map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-[12px] text-foreground">{order.code}</span>
                      <span className="ml-2 text-[12px] text-muted-foreground">{order.clientName}</span>
                    </div>
                    <SectionLabel tone="muted">
                      {order.status.toLowerCase().replace(/_/g, " ")}
                    </SectionLabel>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Desk Actions"
            subtitle="የዴስክ ተግባራት"
            kicker="Queue"
            icon={<ArrowRight size={16} />}
          />
          <div className="flex flex-col gap-2 p-[17px]">
            <button
              onClick={() => router.push("/dashboard/receptionist/orders")}
              className="rounded-md border border-border bg-surface px-3 py-2 text-left text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Open Orders Queue <ArrowRight size={13} className="inline" />
            </button>
            <button
              onClick={() => router.push("/dashboard/receptionist/orders")}
              className="rounded-md border border-border bg-surface px-3 py-2 text-left text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Price an Order <ArrowRight size={13} className="inline" />
            </button>
            <button
              onClick={() => router.push("/dashboard/receptionist/overview")}
              className="rounded-md border border-border bg-surface px-3 py-2 text-left text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              Refresh Overview <ArrowRight size={13} className="inline" />
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}