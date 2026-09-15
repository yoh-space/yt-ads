"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileCheck2,
  FileText,
  Hourglass,
  Inbox,
  Lock,
  Palette,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  UserCheck,
  UserX,
  Wallet,
  Wrench,
} from "lucide-react";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Button } from "@/components/shared/ui/button";
import { StatusPill } from "@/components/shared/ui/status-pill";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { OrderPriceModal, OrderReviewLockModal } from "@/components/dashboard/roles/common/orders";
import {
  OrderAssignDesignModal,
  OrderReviewDesignModal,
  OrderReturnClarificationModal,
} from "@/components/dashboard/roles/receptionist/reception-modals";
import { useSafeMutation } from "@/utils/pending-store";
import type { OrderPriority } from "@/lib/operations-types";

type PriorityTab =
  | "all"
  | "newIntake"
  | "design"
  | "pricing"
  | "customerFollowUp"
  | "cashierReturned"
  | "paymentWaiting"
  | "production";

export default function ReceptionistOverviewPage() {
  const router = useRouter();
  const profile = useQuery(api.users.getCurrentProfile);
  const cockpit = useQuery(api.receptionist.cockpit.listPriorityWork);

  const { isPending, safeMutation } = useSafeMutation();

  const lockOrderForReview = useMutation(api.receptionist.cockpit.acceptOrderForReview);
  const priceOrder = useMutation(api.receptionist.orders.priceOrder);
  const setDesignRequired = useMutation(api.receptionist.cockpit.setDesignRequired);

  const [activeTab, setActiveTab] = useState<PriorityTab>("all");
  const [lockTarget, setLockTarget] = useState<any | null>(null);
  const [priceTarget, setPriceTarget] = useState<any | null>(null);
  const [assignDesignTarget, setAssignDesignTarget] = useState<any | null>(null);
  const [reviewDesignTarget, setReviewDesignTarget] = useState<{ order: any; task: any } | null>(null);
  const [clarificationTarget, setClarificationTarget] = useState<any | null>(null);

  if (cockpit === undefined || !profile) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Reception Priority Cockpit…" />
      </div>
    );
  }

  const { counts } = cockpit;

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Reception Desk"
        title="Operations & Priority Cockpit"
        action={
          <Button
            variant="primary"
            size="small"
            onClick={() => router.push("/dashboard/receptionist/orders")}
          >
            <ShoppingCart size={14} />
            Full Orders Queue
          </Button>
        }
      />

      {/* Priority Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div
          onClick={() => setActiveTab("newIntake")}
          className={`cursor-pointer transition ${activeTab === "newIntake" ? "ring-2 ring-primary rounded-xl" : ""}`}
        >
          <StatCard
            icon={<Inbox size={16} />}
            label="New Intake"
            subtitle="አዲስ ትዕዛዞች"
            value={counts.newIntake}
            description="Require review & customer lock"
            variant="default"
          />
        </div>

        <div
          onClick={() => setActiveTab("design")}
          className={`cursor-pointer transition ${activeTab === "design" ? "ring-2 ring-primary rounded-xl" : ""}`}
        >
          <StatCard
            icon={<Palette size={16} />}
            label="Design Desk"
            subtitle="ዲዛይን ቅንጅት"
            value={counts.designAssignmentRequired + counts.designReviewRequired}
            description={`${counts.designAssignmentRequired} to assign · ${counts.designReviewRequired} to review`}
            variant="sales"
          />
        </div>

        <div
          onClick={() => setActiveTab("pricing")}
          className={`cursor-pointer transition ${activeTab === "pricing" ? "ring-2 ring-primary rounded-xl" : ""}`}
        >
          <StatCard
            icon={<DollarSign size={16} />}
            label="Pricing Queue"
            subtitle="ዋጋ ማውጫ"
            value={counts.pricingQueue}
            description="Artwork verified · ready for pricing"
            variant="default"
          />
        </div>

        <div
          onClick={() => setActiveTab("paymentWaiting")}
          className={`cursor-pointer transition ${activeTab === "paymentWaiting" ? "ring-2 ring-primary rounded-xl" : ""}`}
        >
          <StatCard
            icon={<Wallet size={16} />}
            label="At Cashier"
            subtitle="ካሸር ጋር"
            value={counts.paymentWaiting}
            description="Priced · awaiting payment gate"
            variant="default"
          />
        </div>

        <div
          onClick={() => setActiveTab("customerFollowUp")}
          className={`cursor-pointer transition ${activeTab === "customerFollowUp" ? "ring-2 ring-primary rounded-xl" : ""}`}
        >
          <StatCard
            icon={<UserX size={16} />}
            label="Clarifications"
            subtitle="ደንበኛ ክትትል"
            value={counts.customerFollowUp + counts.returnedFromCashier}
            description={`${counts.customerFollowUp} customer · ${counts.returnedFromCashier} cashier`}
            variant={counts.customerFollowUp + counts.returnedFromCashier > 0 ? "alert" : "default"}
            isAlert={counts.customerFollowUp + counts.returnedFromCashier > 0}
          />
        </div>

        <div
          onClick={() => setActiveTab("production")}
          className={`cursor-pointer transition ${activeTab === "production" ? "ring-2 ring-primary rounded-xl" : ""}`}
        >
          <StatCard
            icon={<Hourglass size={16} />}
            label="Overdue / Risk"
            subtitle="አስቸኳይ"
            value={counts.overdueOrAtRisk}
            description={`${counts.productionProgress} in factory production`}
            variant={counts.overdueOrAtRisk > 0 ? "alert" : "default"}
            isAlert={counts.overdueOrAtRisk > 0}
          />
        </div>
      </div>

      {/* Cashier Returned Orders Alert (High Priority) */}
      {cockpit.returnedFromCashier.length > 0 ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
            <AlertTriangle size={18} />
            <h3 className="text-sm font-semibold">
              Returned from Cashier ({cockpit.returnedFromCashier.length} orders need pricing or info revision)
            </h3>
          </div>
          <div className="mt-3 space-y-2">
            {cockpit.returnedFromCashier.map((order: any) => (
              <div
                key={order._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {order.code} · {order.clientName} ({order.phone})
                  </p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                    Cashier Feedback: {order.returnedToReceptionReason}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="small"
                    variant="primary"
                    onClick={() => setPriceTarget({ ...order, id: order._id })}
                  >
                    <Wrench size={13} />
                    Revise Price
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => setClarificationTarget({ ...order, id: order._id })}
                  >
                    Ask Customer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Sub-Queue Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3 text-xs">
        <button
          onClick={() => setActiveTab("all")}
          className={`rounded-lg px-3 py-1.5 font-semibold transition ${
            activeTab === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface-elevated"
          }`}
        >
          All Actionable ({counts.newIntake + counts.designAssignmentRequired + counts.designReviewRequired + counts.pricingQueue})
        </button>
        <button
          onClick={() => setActiveTab("newIntake")}
          className={`rounded-lg px-3 py-1.5 font-semibold transition ${
            activeTab === "newIntake"
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface-elevated"
          }`}
        >
          New Intake ({counts.newIntake})
        </button>
        <button
          onClick={() => setActiveTab("design")}
          className={`rounded-lg px-3 py-1.5 font-semibold transition ${
            activeTab === "design"
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface-elevated"
          }`}
        >
          Design Coordination ({counts.designAssignmentRequired + counts.designReviewRequired})
        </button>
        <button
          onClick={() => setActiveTab("pricing")}
          className={`rounded-lg px-3 py-1.5 font-semibold transition ${
            activeTab === "pricing"
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface-elevated"
          }`}
        >
          Pricing Queue ({counts.pricingQueue})
        </button>
        <button
          onClick={() => setActiveTab("paymentWaiting")}
          className={`rounded-lg px-3 py-1.5 font-semibold transition ${
            activeTab === "paymentWaiting"
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface-elevated"
          }`}
        >
          At Cashier ({counts.paymentWaiting})
        </button>
        <button
          onClick={() => setActiveTab("production")}
          className={`rounded-lg px-3 py-1.5 font-semibold transition ${
            activeTab === "production"
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground hover:bg-surface-elevated"
          }`}
        >
          In Factory ({counts.productionProgress})
        </button>
      </div>

      {/* Main Work Panel */}
      <Panel>
        <PanelHeader
          title={
            activeTab === "newIntake"
              ? "New Orders Requiring Intake Review"
              : activeTab === "design"
                ? "Design Assignment & Artwork Review Queue"
                : activeTab === "pricing"
                  ? "Orders Ready for Pricing"
                  : activeTab === "paymentWaiting"
                    ? "Orders Waiting for Cashier Payment Verification"
                    : activeTab === "production"
                      ? "Factory Production Progress"
                      : activeTab === "customerFollowUp"
                        ? "Customer Follow-Up & Clarification Queue"
                        : "Active Desk Priority Actions"
          }
          subtitle="የዴስክ አስቸኳይ ተግባራት"
          kicker="Priority Tasks"
          icon={<Sparkles size={16} />}
        />

        <div className="divide-y divide-border">
          {/* 1. Design Review Queue Items */}
          {(activeTab === "all" || activeTab === "design") && cockpit.designReviewRequired.length > 0 ? (
            <div className="p-4 space-y-3 bg-indigo-500/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  Artwork Submissions Awaiting Reception Review ({cockpit.designReviewRequired.length})
                </span>
              </div>
              {cockpit.designReviewRequired.map((order: any) => (
                <div
                  key={order._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{order.code}</span>
                      <span className="text-xs font-semibold text-foreground">{order.clientName}</span>
                      <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                        v{order.designTask?.latestSubmission?.versionNumber ?? 1} ready
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {order.serviceType} · {order.dimensions} · Designer: {order.designTask?.assignedDesignerName ?? "Designer"}
                    </p>
                    {order.designTask?.latestSubmission?.notes ? (
                      <p className="text-[11px] text-foreground/80 mt-1 italic">
                        "{order.designTask.latestSubmission.notes}"
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      variant="primary"
                      onClick={() => setReviewDesignTarget({ order: { ...order, id: order._id }, task: order.designTask })}
                    >
                      <FileCheck2 size={13} />
                      Review Artwork
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* 2. New Intake Orders */}
          {(activeTab === "all" || activeTab === "newIntake") && cockpit.newIntake.length > 0 ? (
            <div className="p-4 space-y-3 bg-amber-500/5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                New Intake Orders Requiring Review Acceptance ({cockpit.newIntake.length})
              </span>
              {cockpit.newIntake.map((order: any) => (
                <div
                  key={order._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{order.code}</span>
                      <span className="text-xs font-semibold text-foreground">{order.clientName} ({order.phone})</span>
                      <StatusPill variant={order.priority === "High" ? "danger" : "warning"}>{order.priority}</StatusPill>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {order.serviceType} · {order.dimensions} · Due: {new Date(order.preferredDueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      variant="primary"
                      disabled={isPending(`reception-lock-${order._id}`)}
                      onClick={() => setLockTarget({ ...order, id: order._id })}
                    >
                      <Lock size={13} />
                      Accept & Review
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => setClarificationTarget({ ...order, id: order._id })}
                    >
                      Ask Clarification
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* 3. Design Assignment Required */}
          {(activeTab === "all" || activeTab === "design") && cockpit.designAssignmentRequired.length > 0 ? (
            <div className="p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Needs Design Assignment ({cockpit.designAssignmentRequired.length})
              </span>
              {cockpit.designAssignmentRequired.map((order: any) => (
                <div
                  key={order._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{order.code}</span>
                      <span className="text-xs font-semibold text-foreground">{order.clientName}</span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        Design Required
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {order.serviceType} · {order.dimensions} · Due {new Date(order.preferredDueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      variant="primary"
                      onClick={() => setAssignDesignTarget({ ...order, id: order._id })}
                    >
                      <Palette size={13} />
                      Assign Designer
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => {
                        void safeMutation(
                          `no-design-${order._id}`,
                          setDesignRequired({ orderId: order._id, required: false }),
                          () => toast.success("Marked as artwork provided / production ready"),
                        );
                      }}
                    >
                      Artwork Ready
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* 4. Ready for Pricing */}
          {(activeTab === "all" || activeTab === "pricing") && cockpit.pricingQueue.length > 0 ? (
            <div className="p-4 space-y-3 bg-emerald-500/5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Ready for Final Price Setting ({cockpit.pricingQueue.length})
              </span>
              {cockpit.pricingQueue.map((order: any) => (
                <div
                  key={order._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{order.code}</span>
                      <span className="text-xs font-semibold text-foreground">{order.clientName}</span>
                      {order.designStatus === "APPROVED" ? (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Artwork Approved
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {order.serviceType} · {order.dimensions} · Qty {order.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="small"
                      variant="primary"
                      onClick={() => setPriceTarget({ ...order, id: order._id })}
                    >
                      <DollarSign size={13} />
                      Set Price
                    </Button>
                    {!order.designRequired ? (
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => setAssignDesignTarget({ ...order, id: order._id })}
                      >
                        <Palette size={13} />
                        Request Design
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* 5. Awaiting Cashier */}
          {(activeTab === "all" || activeTab === "paymentWaiting") && cockpit.paymentWaiting.length > 0 ? (
            <div className="p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Awaiting Cashier Payment Verification ({cockpit.paymentWaiting.length})
              </span>
              {cockpit.paymentWaiting.map((order: any) => (
                <div
                  key={order._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{order.code}</span>
                      <span className="text-xs font-semibold text-foreground">{order.clientName}</span>
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600">
                        ETB {order.amount?.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {order.serviceType} · Handed over to Cashier {order.pricedAt ? new Date(order.pricedAt).toLocaleTimeString() : ""}
                    </p>
                  </div>
                  <span className="rounded bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600">
                    With Cashier
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {/* 6. Production Tracker */}
          {(activeTab === "production") && cockpit.productionProgress.length > 0 ? (
            <div className="p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                In Production ({cockpit.productionProgress.length})
              </span>
              {cockpit.productionProgress.map((order: any) => (
                <div
                  key={order._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary">{order.code}</span>
                      <span className="text-xs font-semibold text-foreground">{order.clientName}</span>
                      <StatusPill variant="info">{order.status}</StatusPill>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {order.serviceType} · {order.dimensions} · Due: {new Date(order.preferredDueDate).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => router.push("/dashboard/receptionist/jobs")}
                  >
                    View Job Cards
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Empty State */}
          {cockpit.newIntake.length === 0 &&
          cockpit.designReviewRequired.length === 0 &&
          cockpit.designAssignmentRequired.length === 0 &&
          cockpit.pricingQueue.length === 0 &&
          cockpit.returnedFromCashier.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-80" />
              <p className="mt-3 text-sm font-semibold text-foreground">Desk is all caught up!</p>
              <p className="mt-1 text-xs text-muted-foreground">
                All intake orders have been reviewed, design tasks assigned, and prices submitted to the cashier.
              </p>
            </div>
          ) : null}
        </div>
      </Panel>

      {/* Modals */}
      {lockTarget ? (
        <OrderReviewLockModal
          order={lockTarget}
          onClose={() => setLockTarget(null)}
          onSave={(reason) =>
            safeMutation(
              `reception-lock-${lockTarget.id}`,
              lockOrderForReview({
                orderId: lockTarget.id as Id<"customerOrders">,
                reviewLockReason: reason,
              }).then((result) => {
                setLockTarget(null);
                return result;
              }),
              () => toast.success(`${lockTarget.code} locked · customer editing disabled`),
            )
          }
        />
      ) : null}

      {priceTarget ? (
        <OrderPriceModal
          order={priceTarget}
          onClose={() => setPriceTarget(null)}
          onSave={(amount) =>
            safeMutation(
              `reception-price-${priceTarget.id}`,
              priceOrder({
                orderId: priceTarget.id as Id<"customerOrders">,
                amount,
              }).then((result) => {
                setPriceTarget(null);
                return result;
              }),
              () => toast.success(`${priceTarget.code} priced · routed to Cashier for payment verification`),
            )
          }
        />
      ) : null}

      {assignDesignTarget ? (
        <OrderAssignDesignModal
          order={assignDesignTarget}
          onClose={() => setAssignDesignTarget(null)}
        />
      ) : null}

      {reviewDesignTarget ? (
        <OrderReviewDesignModal
          order={reviewDesignTarget.order}
          task={reviewDesignTarget.task}
          onClose={() => setReviewDesignTarget(null)}
        />
      ) : null}

      {clarificationTarget ? (
        <OrderReturnClarificationModal
          order={clarificationTarget}
          onClose={() => setClarificationTarget(null)}
        />
      ) : null}
    </div>
  );
}