"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowDownRight,
  Plus,
} from "lucide-react";
import type { CustomerOrder, JobCard, Machine, Material, MaterialRequest, Offcut, Profile, Role, ScrapLog, StockException } from "@/lib/operations-types";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { InventoryLoader } from "./inventory-loader";
import { DashboardAccessDenied } from "./access-denied";
import { Topbar } from "./topbar";
import { Overview, type FinancialMetrics } from "./views/overview";
import { InventoryView } from "./views/inventory";
import { JobsView } from "./views/jobs";
import { MachinesView } from "./views/machines";
import { OffcutsView } from "./views/offcuts";
import { ReportsView } from "./views/reports";
import { ReconciliationView } from "./views/reconciliation";
import { AuditLogView } from "./views/audit-log";
import { SettingsView } from "./views/settings";
import { OrdersView, OrderPriceModal, OrderConfirmModal } from "./views/orders";
import { StockModal } from "./modals/stock-modal";
import { OffcutModal, type NewOffcutInput } from "./modals/offcut-modal";
import { ReconciliationModal, type NewReconciliationInput } from "./modals/reconciliation-modal";
import { MaterialModal, type NewMaterialInput } from "./modals/material-modal";
import { ScrapModal, type NewScrapInput } from "./modals/scrap-modal";
import { MachineModal, type NewMachineInput } from "./modals/machine-modal";
import { MachineEditModal } from "./modals/machine-edit-modal";
import { MachineSettingsModal } from "./modals/machine-settings-modal";
import { MaterialRequestModal, type NewMaterialRequestInput } from "./modals/material-request-modal";
import { ExceptionStockModal } from "./modals/exception-stock-modal";
import { OrderCreateModal, type NewOrderInput } from "./modals/order-create-modal";
import { useSafeMutation } from "./pending-store";
import { canAccessView, defaultViewForRole, navItems, ROLE_WORKSPACE, type Modal, type View } from "./nav-config";
import { hasPermission } from "@/lib/permissions";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export function OperationsDashboard() {
  const { isPending, safeMutation } = useSafeMutation();
  const profile = useQuery(api.users.getCurrentProfile);
  const companySettings = useQuery(api.users.getCompanySettings);
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");
  const role = profile?.role ?? "admin";
  const isOwner = role === "owner";
  const financialMetrics = useQuery(api.dashboard.financialMetrics, isOwner && profile?.active ? {} : "skip");
  const kpis = useQuery(api.dashboard.getKpis, profile?.active ? {} : "skip");
  const canViewOrders = Boolean(profile && hasPermission(role, "order.view"));
  const canManageOrders = Boolean(profile && hasPermission(role, "order.manage"));
  const canRecordStock = Boolean(profile && hasPermission(role, "stock.record"));
  const canCreateMaterial = Boolean(profile && hasPermission(role, "material.create"));
  const canCreateMachine = Boolean(profile && hasPermission(role, "machine.create"));
  const canCreateOffcut = Boolean(profile && hasPermission(role, "offcut.create"));
  const canCreateScrap = Boolean(profile && hasPermission(role, "scrap.create"));
  const canCreateRequest = Boolean(profile && hasPermission(role, "request.create"));
  const canAcknowledgeRequest = Boolean(profile && hasPermission(role, "request.acknowledge"));
  const canIssueRequest = Boolean(profile && hasPermission(role, "request.issue"));
  const canRecordException = Boolean(profile && hasPermission(role, "stock.exception"));
  const canCreateOrder = Boolean(profile && hasPermission(role, "order.create"));
  const canRecordReconciliation = Boolean(profile && hasPermission(role, "reconciliation.record"));
  const canReviewReconciliation = Boolean(profile && hasPermission(role, "reconciliation.review"));
  const materialRequests = useQuery(api.materialRequests.list, profile?.active ? {} : "skip");
  const ordersQuery = useQuery(api.orders.list, canViewOrders && profile?.active ? {} : "skip");
  const exceptionsQuery = useQuery(api.orders.listExceptions, canViewOrders && profile?.active ? {} : "skip");
  const reconciliationSummary = useQuery(api.reconciliation.summary, profile?.active ? {} : "skip");

  const ensureProfile = useMutation(api.users.ensureProfile);
  const recordStockMovement = useMutation(api.materials.recordStockMovement);
  const createMaterial = useMutation(api.materials.create);
  const completeJobMutation = useMutation(api.jobs.complete);
  const recordProductionMutation = useMutation(api.jobs.recordProduction);
  const createMachine = useMutation(api.machines.create);
  const updateMachine = useMutation(api.machines.update);
  const removeMachine = useMutation(api.machines.remove);
  const updateMachineStatus = useMutation(api.machines.updateStatus);
  const assignNextJob = useMutation(api.machines.assignNextJob);
  const createOffcut = useMutation(api.offcuts.create);
  const logScrap = useMutation(api.offcuts.logScrap);
  const createMaterialRequest = useMutation(api.materialRequests.create);
  const issueMaterialRequest = useMutation(api.materialRequests.issue);
  const acknowledgeMaterialRequest = useMutation(api.materialRequests.acknowledge);
  const priceOrder = useMutation(api.orders.priceOrder);
  const confirmOrderAndIssueJobCard = useMutation(api.orders.confirmOrderAndIssueJobCard);
  const updateOrderStatus = useMutation(api.orders.setStatus);
  const recordExceptionStockOut = useMutation(api.orders.recordExceptionStockOut);
  const notifyOverdue = useMutation(api.orders.notifyOverdue);
  const createWalkIn = useMutation(api.orders.createWalkIn);
  const countMaterial = useMutation(api.reconciliation.countMaterial);
  const reviewReconciliation = useMutation(api.reconciliation.review);

  const [activeView, setActiveView] = useState<View>("overview");
  const [workspaceApplied, setWorkspaceApplied] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [convertOrderTarget, setConvertOrderTarget] = useState<CustomerOrder | null>(null);
  const [editMachineTarget, setEditMachineTarget] = useState<Machine | null>(null);
  const [machineSettingsTarget, setMachineSettingsTarget] = useState<Machine | null>(null);
  const [jobFilter, setJobFilter] = useState<JobCard["status"] | "open" | null>(null);
  const [notice, setNotice] = useState("የዛሬ ሥራ በቅጽበት እየተመዘገበ ነው");

  useEffect(() => {
    if (profile === null) {
      void ensureProfile().catch(() => {});
    }
  }, [profile, ensureProfile]);

  useEffect(() => {
    if (!workspaceApplied && profile?.role) {
      setActiveView(ROLE_WORKSPACE[profile.role].view);
      setWorkspaceApplied(true);
    }
  }, [workspaceApplied, profile?.role]);

  useEffect(() => {
    if (canManageOrders && ordersQuery) void notifyOverdue({}).catch(() => {});
  }, [canManageOrders, notifyOverdue, ordersQuery]);

  if (profile === undefined || companySettings === undefined) return <InventoryLoader />;
  if (profile === null || !profile.active) return <DashboardAccessDenied />;
  if (state === undefined || kpis === undefined || materialRequests === undefined || reconciliationSummary === undefined || (isOwner && financialMetrics === undefined) || (canViewOrders && (ordersQuery === undefined || exceptionsQuery === undefined))) {
    return <InventoryLoader />;
  }

  const resolvedRole: Role = profile?.role ?? "admin";
  const materials = withIds(state.materials) as Material[];
  const machines = withIds(state.machines) as Machine[];
  const jobs = withIds(state.jobs) as JobCard[];
  const offcuts = withIds(state.offcuts) as Offcut[];
  const scraps = withIds(state.scraps) as ScrapLog[];
  const requests = withIds(materialRequests) as MaterialRequest[];
  const orders = canViewOrders ? (withIds(ordersQuery ?? []) as CustomerOrder[]) : [];
  const exceptions = canViewOrders ? (withIds(exceptionsQuery ?? []) as StockException[]) : [];
  const resolvedProfile: Profile | null = profile ? { ...profile, id: profile._id } : null;
  const visibleView = canAccessView(resolvedRole, activeView) ? activeView : defaultViewForRole(resolvedRole);

  const filteredMachines = role === "owner" || role === "manager" || role === "admin" || role === "storekeeper"
    ? machines
    : machines.filter((machine) => machine.operatorRole === role);
  const runningJobs = jobs.filter((job) => job.status === "In production");
  const lowStock = materials.filter((material) => material.reorderAt > 0 && material.quantity <= material.reorderAt);
  const stockValue = materials.reduce((total, material) => total + material.quantity, 0);
  const averageWaste = Number(
    (3.4 + Math.min(5, scraps.reduce((total, scrap) => total + scrap.quantity, 0) / 10)).toFixed(1),
  );

  function openModal(nextModal: Exclude<Modal, null>, permission: Parameters<typeof hasPermission>[1]) {
    if (!hasPermission(resolvedRole, permission)) {
      setNotice("You do not have permission to open this action.");
      return;
    }
    setModal(nextModal);
  }

  function openView(view: View) {
    if (!canAccessView(resolvedRole, view)) {
      setNotice("This workspace view is not available for your role.");
      setMobileNavOpen(false);
      return;
    }
    setActiveView(view);
    setMobileNavOpen(false);
  }

  function filterJobsFromOverview(status: JobCard["status"] | "open") {
    setJobFilter(status);
    openView("jobs");
  }

  function completeJob(jobId: string) {
    safeMutation(
      `complete-job-${jobId}`,
      completeJobMutation({ jobId: jobId as Id<"jobCards"> }),
      () => {
        const message = "የሥራ ካርዱ ተጠናቋል፤ መዝገቡ update ሆኗል";
        setNotice(message);
        toast.success(message);
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to complete the job card.";
        setNotice(message);
        toast.error(message);
      },
    );
  }

  function requestMaterial(input: NewMaterialRequestInput) {
    finishMutation(
      "request-material",
      createMaterialRequest({
        ...input,
        jobCardId: input.jobCardId as Id<"jobCards">,
        materialId: input.materialId as Id<"materials">,
      }),
      "የእቃ ጥያቄው ተልኳል",
    );
  }

  function issueMaterial(requestId: string, issuedQuantity: number) {
    finishMutation(
      `issue-${requestId}`,
      issueMaterialRequest({ requestId: requestId as Id<"materialRequests">, issuedQuantity }),
      "እቃው ተሰጥቷል፤ ክምችቱ update ሆኗል",
    );
  }

  function acknowledgeMaterial(requestId: string) {
    finishMutation(
      `ack-${requestId}`,
      acknowledgeMaterialRequest({ requestId: requestId as Id<"materialRequests"> }),
      "የተሰጠው እቃ እንደደረሰ ተረጋግጧል",
    );
  }

  function recordProduction(jobId: string, inputQuantity: number, outputQuantity: number, wasteQuantity: number) {
    safeMutation(
      `production-${jobId}`,
      recordProductionMutation({
        jobCardId: jobId as Id<"jobCards">,
        inputQuantity,
        outputQuantity,
        wasteQuantity,
      }),
      () => {
        const message = "የምርት መዝገቡ ተቀምጧል፤ ክምችት update ሆኗል";
        setNotice(message);
        toast.success(message);
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : "Unable to save the production log.";
        setNotice(message);
        toast.error(message);
      },
    );
  }

  function finishMutation<T>(key: string, promise: Promise<T>, successMessage: string) {
    safeMutation(
      key,
      promise,
      (result: T) => {
        if (result && typeof result === "object" && "success" in result && !(result as { success: boolean }).success) {
          const message = (result as { error?: string }).error ?? "The operation could not be completed.";
          setNotice(message);
          toast.error(message);
          return;
        }
        setNotice(successMessage);
        setModal(null);
        toast.success(successMessage);
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : "The operation could not be completed.";
        setNotice(message);
        toast.error(message);
      },
    );
  }

  return (
    <>
      <Sidebar
        activeView={visibleView}
        onNavigate={openView}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        collapsed={sidebarCollapsed}
        runningJobsCount={runningJobs.length}
        companyName={companySettings?.companyName}
        logoUrl={companySettings?.logoUrl}
        role={resolvedRole}
      />

      {mobileNavOpen ? (
        <button 
          aria-label="Close navigation overlay" 
          className="fixed inset-0 z-10 bg-black/20 md:hidden" 
          onClick={() => setMobileNavOpen(false)} 
        />
      ) : null}

      <main className={cn(
        "min-h-screen transition-all duration-300",
        "ml-[280px]",
        {
          "ml-[74px]": sidebarCollapsed,
          "ml-0 max-md:ml-0": mobileNavOpen,
        }
      )}>
        <Topbar
          activeView={visibleView}
          onMenu={() => setMobileNavOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          sidebarCollapsed={sidebarCollapsed}
          profile={resolvedProfile}
          companyName={companySettings?.companyName}
          onOpenSettings={() => openView("settings")}
        />

        <div className="p-[34px]">
          <section className="mb-8 flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-navy mb-2">
                {visibleView === "overview"
                  ? "የባለቤት የፋይናንስ እና የክምችት ኦዲት"
                  : navItems.find((item) => item.id === visibleView)?.label}
                <span className="block text-sm font-normal text-muted-foreground mt-1">
                  {visibleView === "overview"
                    ? "Owner Financial Oversight · Stock Audit"
                    : navItems.find((item) => item.id === visibleView)?.english}
                </span>
              </h1>
              <p className="text-sm text-ink">{notice}</p>
            </div>
            
            <div className="flex items-center gap-3">
              {visibleView === "inventory" ? (
                <>
                  {canRecordException ? (
                    <button 
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-secondary-foreground transition-colors hover:border-cyan hover:bg-cyan/10"
                      onClick={() => openModal("exception", "stock.exception")}
                    >
                      <ArrowDownRight size={16} />Direct exception
                    </button>
                  ) : null}
                  {canRecordStock ? (
                    <button 
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border border-line bg-white text-secondary-foreground transition-colors hover:border-cyan hover:bg-cyan/10"
                      onClick={() => openModal("stock", "stock.record")}
                    >
                      <ArrowDownRight size={16} />Stock movement
                    </button>
                  ) : null}
                  {canCreateMaterial ? (
                    <button 
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-custom transition-colors hover:bg-navy-2"
                      onClick={() => openModal("material", "material.create")}
                    >
                      <Plus size={16} />እቃ ጨምር
                    </button>
                  ) : null}
                </>
              ) : null}
              {visibleView === "machines" && canCreateMachine ? (
                <button 
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-custom transition-colors hover:bg-navy-2"
                  onClick={() => openModal("machine", "machine.create")}
                >
                  <Plus size={16} />Add machine
                </button>
              ) : null}
              {visibleView === "overview" && canCreateOrder ? (
                <button 
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-custom transition-colors hover:bg-navy-2"
                  onClick={() => openModal("order", "order.create")}
                >
                  <Plus size={16} />New Customer Order
                </button>
              ) : null}
              {visibleView === "reconciliation" ? null : null}
            </div>
          </section>

          {visibleView === "overview" ? (
            <Overview
              materials={materials}
              machines={machines}
              jobs={jobs}
              orders={orders}
              orderStats={state.orderStats}
              materialPulse={state.orderPulse ?? []}
              lowStock={lowStock}
              stockValue={stockValue}
              waste={averageWaste}
              reconciliationVariances={reconciliationSummary?.currentVariances ?? []}
              financialMetrics={(financialMetrics ?? null) as FinancialMetrics | null}
              kpis={kpis}
              onView={openView}
              onFilterJobs={filterJobsFromOverview}
              onComplete={completeJob}
            />
          ) : null}
          {visibleView === "orders" ? <OrdersView orders={orders} machines={machines} materials={materials} canManage={canManageOrders} canCreateOrder={canCreateOrder} onConvert={setConvertOrderTarget} onStatus={(orderId, status) => finishMutation(`order-status-${orderId}`, updateOrderStatus({ orderId: orderId as Id<"customerOrders">, status }), `Order status updated to ${status}`)} onCreateOrder={() => openModal("order", "order.create")} isPending={isPending} /> : null}
          {visibleView === "inventory" ? (
            <InventoryView
              materials={materials}
              lowStock={lowStock}
              requests={requests}
              role={resolvedRole}
              onStock={() => openModal("stock", "stock.record")}
              onException={() => openModal("exception", "stock.exception")}
              exceptions={exceptions}
              canRecordStock={canRecordStock}
              canRecordException={canRecordException}
              canCreateMaterial={canCreateMaterial}
              canCreateRequest={canCreateRequest}
              canIssueRequest={canIssueRequest}
              canAcknowledgeRequest={canAcknowledgeRequest}
              onAdd={() => openModal("material", "material.create")}
              onRequest={() => openModal("request", "request.create")}
              onIssue={issueMaterial}
              onAcknowledge={acknowledgeMaterial}
              isPending={isPending}
            />
          ) : null}
          {visibleView === "jobs" ? (
            <JobsView jobs={jobs} machines={machines} materials={materials} canCreate={false} canComplete={Boolean(profile && hasPermission(role, "job.complete"))} onCreate={() => {}} onComplete={completeJob} filterStatus={jobFilter} onClearFilter={() => setJobFilter(null)} />
          ) : null}
          {visibleView === "machines" ? (
            <MachinesView
              machines={filteredMachines}
              jobs={jobs}
              role={resolvedRole}
              canCreateMachine={canCreateMachine}
              canCreateOffcut={canCreateOffcut}
              canCreateScrap={canCreateScrap}
              canComplete={Boolean(profile && hasPermission(role, "job.complete"))}
              canUpdateMachine={Boolean(profile && hasPermission(role, "machine.update"))}
              canDeleteMachine={Boolean(profile && hasPermission(role, "machine.delete"))}
              onCreate={() => openModal("machine", "machine.create")}
              onOffcut={() => openModal("offcut", "offcut.create")}
              onScrap={() => openModal("scrap", "scrap.create")}
              onComplete={completeJob}
              onRecordProduction={recordProduction}
              onAssignNextJob={(machineId) => finishMutation(`assign-job-${machineId}`, assignNextJob({ machineId: machineId as Id<"machines"> }), "Job assigned to machine")}
              onSettings={setMachineSettingsTarget}
              onView={openView}
              isPending={isPending}
            />
          ) : null}
          {visibleView === "offcuts" ? (
            <OffcutsView offcuts={offcuts} scraps={scraps} canCreate={canCreateOffcut} canScrap={canCreateScrap} onCreate={() => openModal("offcut", "offcut.create")} onScrap={() => openModal("scrap", "scrap.create")} />
          ) : null}
          {visibleView === "reports" ? <ReportsView canSeeFinancial={isOwner} /> : null}
          {visibleView === "reconciliation" ? <ReconciliationView materials={materials} canRecord={canRecordReconciliation} canReview={canReviewReconciliation} canSeeFinancial={isOwner} onCount={() => openModal("reconciliation", "reconciliation.record")} onReview={(id, status) => finishMutation(`review-recon-${id}`, reviewReconciliation({ reconciliationId: id as Id<"reconciliations">, status }), "Reconciliation record reviewed")} /> : null}
          {visibleView === "audit" ? <AuditLogView /> : null}
          {visibleView === "settings" && resolvedProfile ? <SettingsView profile={resolvedProfile} /> : null}
        </div>
      </main>

      {modal === "exception" && canRecordException ? <ExceptionStockModal materials={materials} onClose={() => setModal(null)} onSave={(input) => finishMutation("exception-stock", recordExceptionStockOut({ materialId: input.materialId as Id<"materials">, quantity: input.quantity, unit: input.unit, reason: input.reason, authorizationNote: input.authorizationNote }), "Direct exception stock-out recorded")} /> : null}
      {modal === "stock" && canRecordStock ? (
        <StockModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(materialId, direction, quantity, inputUnit, note) => {
            const material = materials.find((entry) => entry.id === materialId);
            finishMutation(
              `stock-${materialId}-${direction}`,
              recordStockMovement({ materialId: materialId as Id<"materials">, direction, quantity, inputUnit, note }),
              `${material?.name ?? "Material"}: ${direction === "in" ? "stock-in" : "stock-out"} recorded`,
            );
          }}
        />
      ) : null}
      {modal === "order" && canCreateOrder ? (
        <OrderCreateModal
          onClose={() => setModal(null)}
          onSave={(input: NewOrderInput) => {
            finishMutation(
              "create-walk-in-order",
              createWalkIn({
                clientName: input.clientName,
                phone: input.phone,
                serviceType: input.serviceType,
                dimensions: input.dimensions,
                quantity: input.quantity,
                amount: input.amount,
                preferredDueDate: input.preferredDueDate,
                priority: input.priority,
                notes: input.notes || undefined,
              }),
              `${input.clientName} ተዘርግቧል እና ትዕዛዝ ተመዝግቧል`,
            );
          }}
        />
      ) : null}
      {modal === "offcut" && canCreateOffcut ? (
        <OffcutModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(input: NewOffcutInput) => {
            finishMutation(
              "create-offcut",
              createOffcut({ ...input, materialId: input.materialId as Id<"materials"> }),
              `ቅሪት ወደ ንቁ ክምችት ተመልሷል`,
            );
          }}
        />
      ) : null}
      {modal === "scrap" && canCreateScrap ? (
        <ScrapModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(input: NewScrapInput) => {
            finishMutation(
              "log-scrap",
              logScrap({ ...input, materialId: input.materialId as Id<"materials"> }),
              `${input.reason} ለወጪ እና ቅነሳ ትንተና ተመዝግቧል`,
            );
          }}
        />
      ) : null}
      {modal === "material" && canCreateMaterial ? (
        <MaterialModal
          onClose={() => setModal(null)}
          onSave={(input: NewMaterialInput) => {
            finishMutation("create-material", createMaterial(input), `${input.name} ወደ የእቃ መዝገብ ታክሏል`);
          }}
        />
      ) : null}
      {modal === "machine" && canCreateMachine ? (
        <MachineModal
          onClose={() => setModal(null)}
          onSave={(input: NewMachineInput) => {
            finishMutation("create-machine", createMachine(input), `${input.name} ወደ ማሽኖች ዝርዝር ታክሏል`);
          }}
        />
      ) : null}
      {editMachineTarget ? (
        <MachineEditModal
          machine={editMachineTarget}
          onClose={() => setEditMachineTarget(null)}
          onSave={(input) => {
            finishMutation(
              `edit-machine-${editMachineTarget.id}`,
              updateMachine({ machineId: editMachineTarget.id as Id<"machines">, ...input }),
              `${editMachineTarget.name} updated successfully`,
            );
          }}
        />
      ) : null}
      {machineSettingsTarget ? (
        <MachineSettingsModal
          machine={machineSettingsTarget}
          onClose={() => setMachineSettingsTarget(null)}
          onEdit={(machine) => {
            setMachineSettingsTarget(null);
            setEditMachineTarget(machine);
          }}
          onRemove={(machineId) => { finishMutation(`remove-machine-${machineId}`, removeMachine({ machineId: machineId as Id<"machines"> }), "Machine removed from register"); setMachineSettingsTarget(null); }}
          onStatusChange={(machineId, status) => finishMutation(`status-machine-${machineId}`, updateMachineStatus({ machineId: machineId as Id<"machines">, status }), `Machine status updated to ${status}`)}
          isPending={isPending}
          canUpdateMachine={Boolean(profile && hasPermission(role, "machine.update"))}
          canDeleteMachine={Boolean(profile && hasPermission(role, "machine.delete"))}
          canCreateOffcut={canCreateOffcut}
          onOffcut={() => { setMachineSettingsTarget(null); openModal("offcut", "offcut.create"); }}
          canCreateScrap={canCreateScrap}
          onScrap={() => { setMachineSettingsTarget(null); openModal("scrap", "scrap.create"); }}
        />
      ) : null}
      {modal === "request" && canCreateRequest ? (
        <MaterialRequestModal
          jobs={jobs}
          materials={materials}
          onClose={() => setModal(null)}
          onSave={requestMaterial}
        />
      ) : null}
      {convertOrderTarget && convertOrderTarget.status === "PENDING_REVIEW" ? (
        <OrderPriceModal
          order={convertOrderTarget}
          onClose={() => setConvertOrderTarget(null)}
          onSave={(amount) =>
            finishMutation(
              `price-${convertOrderTarget.id}`,
              priceOrder({ orderId: convertOrderTarget.id as Id<"customerOrders">, amount }).then((result) => {
                setConvertOrderTarget(null);
                return result;
              }),
              `${convertOrderTarget.code} priced · awaiting payment`,
            )
          }
        />
      ) : null}
      {convertOrderTarget && convertOrderTarget.status === "PRICED_AND_PENDING_PAYMENT" ? (
        <OrderConfirmModal
          order={convertOrderTarget}
          machines={machines}
          materials={materials}
          onClose={() => setConvertOrderTarget(null)}
          onSave={(input: { paymentDecision: "PAID" | "APPROVED_CREDIT"; paymentMethod?: string; machineId: string; materialId: string; quantity: number; unit: Material["unit"]; priority?: CustomerOrder["priority"] }) =>
            finishMutation(
              `confirm-${convertOrderTarget.id}`,
              confirmOrderAndIssueJobCard({
                orderId: convertOrderTarget.id as Id<"customerOrders">,
                paymentDecision: input.paymentDecision,
                paymentMethod: input.paymentMethod,
                machineId: input.machineId as Id<"machines">,
                materialId: input.materialId as Id<"materials">,
                quantity: input.quantity,
                unit: input.unit,
                priority: input.priority,
              }).then((result) => {
                setConvertOrderTarget(null);
                return result;
              }),
              "Order confirmed · job card issued",
            )
          }
        />
      ) : null}
      {modal === "reconciliation" && canRecordReconciliation ? (
        <ReconciliationModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(input: NewReconciliationInput) => {
            finishMutation(
              "record-reconciliation",
              countMaterial({ materialId: input.materialId as Id<"materials">, countedQuantity: input.countedQuantity, note: input.note }),
              "Physical count recorded · variance computed",
            );
          }}
        />
      ) : null}
    </>
  );
}

