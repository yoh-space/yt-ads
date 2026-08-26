"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowDownRight,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import type { CustomerOrder, JobCard, Machine, Material, MaterialRequest, Offcut, Profile, Role, ScrapLog, StockException } from "@/lib/operations-types";
import { Sidebar } from "./sidebar";
import { InventoryLoader } from "./inventory-loader";
import { DashboardAccessDenied } from "./access-denied";
import { Topbar } from "./topbar";
import { Overview } from "./views/overview";
import { InventoryView } from "./views/inventory";
import { JobsView } from "./views/jobs";
import { MachinesView } from "./views/machines";
import { OffcutsView } from "./views/offcuts";
import { ReportsView } from "./views/reports";
import { AuditLogView } from "./views/audit-log";
import { OrdersView, OrderConvertModal } from "./views/orders";
import { StockModal } from "./modals/stock-modal";
import { JobModal, type NewJobInput } from "./modals/job-modal";
import { OffcutModal, type NewOffcutInput } from "./modals/offcut-modal";
import { MaterialModal, type NewMaterialInput } from "./modals/material-modal";
import { ScrapModal, type NewScrapInput } from "./modals/scrap-modal";
import { MachineModal, type NewMachineInput } from "./modals/machine-modal";
import { MaterialRequestModal, type NewMaterialRequestInput } from "./modals/material-request-modal";
import { ExceptionStockModal } from "./modals/exception-stock-modal";
import { AccountSettingsModal } from "./modals/account-settings-modal";
import { canAccessView, defaultViewForRole, navItems, type Modal, type View } from "./nav-config";
import { hasPermission } from "@/lib/permissions";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export function OperationsDashboard() {
  const profile = useQuery(api.users.getCurrentProfile);
  const companySettings = useQuery(api.users.getCompanySettings);
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");
  const role = profile?.role ?? "admin";
  const canViewOrders = Boolean(profile && hasPermission(role, "order.view"));
  const canManageOrders = Boolean(profile && hasPermission(role, "order.manage"));
  const canRecordStock = Boolean(profile && hasPermission(role, "stock.record"));
  const canCreateMaterial = Boolean(profile && hasPermission(role, "material.create"));
  const canCreateJob = Boolean(profile && hasPermission(role, "job.create"));
  const canCreateMachine = Boolean(profile && hasPermission(role, "machine.create"));
  const canCreateOffcut = Boolean(profile && hasPermission(role, "offcut.create"));
  const canCreateScrap = Boolean(profile && hasPermission(role, "scrap.create"));
  const canCreateRequest = Boolean(profile && hasPermission(role, "request.create"));
  const canAcknowledgeRequest = Boolean(profile && hasPermission(role, "request.acknowledge"));
  const canIssueRequest = Boolean(profile && hasPermission(role, "request.issue"));
  const canRecordException = Boolean(profile && hasPermission(role, "stock.exception"));
  const materialRequests = useQuery(api.materialRequests.list, profile?.active ? {} : "skip");
  const ordersQuery = useQuery(api.orders.list, canViewOrders && profile?.active ? {} : "skip");
  const exceptionsQuery = useQuery(api.orders.listExceptions, canViewOrders && profile?.active ? {} : "skip");

  const ensureProfile = useMutation(api.users.ensureProfile);
  const recordStockMovement = useMutation(api.materials.recordStockMovement);
  const createMaterial = useMutation(api.materials.create);
  const createJob = useMutation(api.jobs.create);
  const completeJobMutation = useMutation(api.jobs.complete);
  const recordProductionMutation = useMutation(api.jobs.recordProduction);
  const createMachine = useMutation(api.machines.create);
  const createOffcut = useMutation(api.offcuts.create);
  const logScrap = useMutation(api.offcuts.logScrap);
  const createMaterialRequest = useMutation(api.materialRequests.create);
  const issueMaterialRequest = useMutation(api.materialRequests.issue);
  const acknowledgeMaterialRequest = useMutation(api.materialRequests.acknowledge);
  const convertOrder = useMutation(api.orders.convertToJob);
  const updateOrderStatus = useMutation(api.orders.setStatus);
  const recordExceptionStockOut = useMutation(api.orders.recordExceptionStockOut);
  const notifyOverdue = useMutation(api.orders.notifyOverdue);

  const [activeView, setActiveView] = useState<View>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [convertOrderTarget, setConvertOrderTarget] = useState<CustomerOrder | null>(null);
  const [notice, setNotice] = useState("የዛሬ ሥራ በቅጽበት እየተመዘገበ ነው");

  useEffect(() => {
    if (profile === null) {
      void ensureProfile().catch(() => {});
    }
  }, [profile, ensureProfile]);

  useEffect(() => {
    if (canManageOrders && ordersQuery) void notifyOverdue({}).catch(() => {});
  }, [canManageOrders, notifyOverdue, ordersQuery]);

  if (profile === undefined || companySettings === undefined) return <InventoryLoader />;
  if (profile === null || !profile.active) return <DashboardAccessDenied />;
  if (state === undefined || materialRequests === undefined || (canViewOrders && (ordersQuery === undefined || exceptionsQuery === undefined))) {
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

  function completeJob(jobId: string) {
    void completeJobMutation({ jobId: jobId as Id<"jobCards"> })
      .then(() => setNotice("የሥራ ካርዱ ተጠናቋል፤ መዝገቡ ተዘምኗል"))
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Unable to complete the job card."));
  }

  function requestMaterial(input: NewMaterialRequestInput) {
    finishMutation(
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
      issueMaterialRequest({ requestId: requestId as Id<"materialRequests">, issuedQuantity }),
      "እቃው ተሰጥቷል፤ ክምችቱ ተዘምኗል",
    );
  }

  function acknowledgeMaterial(requestId: string) {
    finishMutation(
      acknowledgeMaterialRequest({ requestId: requestId as Id<"materialRequests"> }),
      "የተሰጠው እቃ እንደደረሰ ተረጋግጧል",
    );
  }

  function recordProduction(jobId: string, inputQuantity: number, outputQuantity: number, wasteQuantity: number) {
    void recordProductionMutation({
      jobCardId: jobId as Id<"jobCards">,
      inputQuantity,
      outputQuantity,
      wasteQuantity,
    })
      .then(() => setNotice("የምርት መዝገቡ ተቀምጧል፤ ክምችት ተዘምኗል"))
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Unable to save the production log."));
  }

  function finishMutation<T>(promise: Promise<T>, successMessage: string) {
    void promise
      .then(() => {
        setNotice(successMessage);
        setModal(null);
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : "The operation could not be completed."));
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? "collapsed" : ""}`}>
      <Sidebar
        activeView={visibleView}
        onNavigate={openView}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        collapsed={sidebarCollapsed}
        runningJobsCount={runningJobs.length}
        companyName={companySettings?.companyName}
        logoUrl={companySettings?.logoUrl}
        role={resolvedRole}
      />

      {mobileNavOpen ? (
        <button aria-label="Close navigation overlay" className="overlay" onClick={() => setMobileNavOpen(false)} />
      ) : null}

      <main className="main-content">
        <Topbar
          activeView={visibleView}
          onMenu={() => setMobileNavOpen(true)}
          onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
          sidebarCollapsed={sidebarCollapsed}
          profile={resolvedProfile}
          companyName={companySettings?.companyName}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <div className="page-content">
          <section className="page-heading">
            <div>
              <h1>
                {visibleView === "overview"
                  ? "የምርት እና ክምችት አጠቃላይ እይታ"
                  : navItems.find((item) => item.id === visibleView)?.label}
                <span>{navItems.find((item) => item.id === visibleView)?.english}</span>
              </h1>
              <p>{notice}</p>
            </div>
            <div className="heading-actions">
              {visibleView === "inventory" ? (
                <>
                  {canRecordException ? <button className="button secondary" onClick={() => openModal("exception", "stock.exception")}><ArrowDownRight size={16} />Direct exception</button> : null}
                  {canRecordStock ? <button className="button secondary" onClick={() => openModal("stock", "stock.record")}><ArrowDownRight size={16} />Stock movement</button> : null}
                  {canCreateMaterial ? <button className="button primary" onClick={() => openModal("material", "material.create")}><Plus size={16} />እቃ ጨምር</button> : null}
                </>
              ) : null}
              {visibleView === "jobs" && canCreateJob ? <button className="button primary" onClick={() => openModal("job", "job.create")}><Plus size={16} />New job card</button> : null}
              {visibleView === "machines" && canCreateMachine ? <button className="button primary" onClick={() => openModal("machine", "machine.create")}><Plus size={16} />Add machine</button> : null}
              {visibleView === "offcuts" ? (
                <>
                  {canCreateScrap ? <button className="button secondary" onClick={() => openModal("scrap", "scrap.create")}><Trash2 size={16} />Log scrap</button> : null}
                  {canCreateOffcut ? <button className="button primary" onClick={() => openModal("offcut", "offcut.create")}><Scissors size={16} />Log offcut</button> : null}
                </>
              ) : null}
              {visibleView === "overview" && canCreateJob ? <button className="button primary" onClick={() => openModal("job", "job.create")}><Plus size={16} />አዲስ ሥራ ካርድ</button> : null}
            </div>
          </section>

          {visibleView === "overview" ? (
            <Overview
              materials={materials}
              machines={machines}
              jobs={jobs}
              orders={orders}
              lowStock={lowStock}
              stockValue={stockValue}
              waste={averageWaste}
              onView={openView}
              onComplete={completeJob}
            />
          ) : null}
          {visibleView === "orders" ? <OrdersView orders={orders} machines={machines} materials={materials} canManage={canManageOrders} onConvert={setConvertOrderTarget} onStatus={(orderId, status) => finishMutation(updateOrderStatus({ orderId: orderId as Id<"customerOrders">, status }), `Order status updated to ${status}`)} /> : null}
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
            />
          ) : null}
          {visibleView === "jobs" ? (
            <JobsView jobs={jobs} machines={machines} materials={materials} canCreate={canCreateJob} canComplete={Boolean(profile && hasPermission(role, "job.complete"))} onCreate={() => openModal("job", "job.create")} onComplete={completeJob} />
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
              onCreate={() => openModal("machine", "machine.create")}
              onOffcut={() => openModal("offcut", "offcut.create")}
              onScrap={() => openModal("scrap", "scrap.create")}
              onComplete={completeJob}
              onRecordProduction={recordProduction}
            />
          ) : null}
          {visibleView === "offcuts" ? (
            <OffcutsView offcuts={offcuts} scraps={scraps} canCreate={canCreateOffcut} canScrap={canCreateScrap} onCreate={() => openModal("offcut", "offcut.create")} onScrap={() => openModal("scrap", "scrap.create")} />
          ) : null}
          {visibleView === "reports" ? <ReportsView /> : null}
          {visibleView === "audit" ? <AuditLogView /> : null}
        </div>
      </main>

      {modal === "exception" && canRecordException ? <ExceptionStockModal materials={materials} onClose={() => setModal(null)} onSave={(input) => finishMutation(recordExceptionStockOut({ materialId: input.materialId as Id<"materials">, quantity: input.quantity, unit: input.unit, reason: input.reason, authorizationNote: input.authorizationNote }), "Direct exception stock-out recorded")} /> : null}
      {modal === "stock" && canRecordStock ? (
        <StockModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(materialId, direction, quantity, inputUnit, note) => {
            const material = materials.find((entry) => entry.id === materialId);
            finishMutation(
              recordStockMovement({ materialId: materialId as Id<"materials">, direction, quantity, inputUnit, note }),
              `${material?.name ?? "Material"}: ${direction === "in" ? "stock-in" : "stock-out"} recorded`,
            );
          }}
        />
      ) : null}
      {modal === "job" && canCreateJob ? (
        <JobModal
          materials={materials}
          machines={machines}
          onClose={() => setModal(null)}
          onSave={(input: NewJobInput) => {
            finishMutation(
              createJob({
                ...input,
                machineId: input.machineId as Id<"machines">,
                materialId: input.materialId as Id<"materials">,
              }),
              `${input.client || "Walk-in"} ተመዝግቧል እና ለማሽን ተመድቧል`,
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
            finishMutation(createMaterial(input), `${input.name} ወደ የእቃ መዝገብ ታክሏል`);
          }}
        />
      ) : null}
      {modal === "machine" && canCreateMachine ? (
        <MachineModal
          onClose={() => setModal(null)}
          onSave={(input: NewMachineInput) => {
            finishMutation(createMachine(input), `${input.name} ወደ ማሽኖች ዝርዝር ታክሏል`);
          }}
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
      {convertOrderTarget ? <OrderConvertModal order={convertOrderTarget} machines={machines} materials={materials} onClose={() => setConvertOrderTarget(null)} onSave={(input) => finishMutation(convertOrder({ orderId: convertOrderTarget.id as Id<"customerOrders">, machineId: input.machineId as Id<"machines">, materialId: input.materialId as Id<"materials">, quantity: input.quantity, unit: input.unit, priority: input.priority }).then(() => setConvertOrderTarget(null)), "Order converted to a job card")} /> : null}
      {settingsOpen && resolvedProfile ? (
        <AccountSettingsModal profile={resolvedProfile} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </div>
  );
}

