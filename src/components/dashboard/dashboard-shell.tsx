"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { CustomerOrder, JobCard, Machine, Material, Profile, Role } from "@/lib/operations-types";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { DesktopConnectionBanner } from "./desktop-connection-banner";
import { InventoryLoader } from "./inventory-loader";
import { DashboardAccessDenied } from "./access-denied";
import { useSafeMutation } from "./pending-store";
import { hasPermission } from "@/lib/permissions";
import { canAccess } from "@/lib/access-policy";
import { WorkspaceRenderer } from "./workspace-renderer";
import { resolveWorkspace } from "./workspace-registry";
import { DashboardModalProvider, useDashboardModal } from "./modal-context";
import { StockModal } from "./modals/stock-modal";
import { OffcutModal, type NewOffcutInput } from "./modals/offcut-modal";
import { ScrapModal, type NewScrapInput } from "./modals/scrap-modal";
import { MaterialModal, type NewMaterialInput } from "./modals/material-modal";
import { MachineModal, type NewMachineInput } from "./modals/machine-modal";
import { MachineEditModal } from "./modals/machine-edit-modal";
import { MachineSettingsModal } from "./modals/machine-settings-modal";
import { MaterialRequestModal, type NewMaterialRequestInput } from "./modals/material-request-modal";
import { ExceptionStockModal } from "./modals/exception-stock-modal";
import { OrderCreateModal, type NewOrderInput } from "./modals/order-create-modal";
import { OrderPriceModal, OrderConfirmModal } from "./views/orders";
import { ReconciliationModal, type NewReconciliationInput } from "./modals/reconciliation-modal";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

function DashboardShellInner({ children }: { children: ReactNode }) {
  const { isPending, safeMutation } = useSafeMutation();
  const profile = useQuery(api.users.getCurrentProfile);
  const companySettings = useQuery(api.users.getCompanySettings);
  const state = useQuery(api.dashboard.getState, profile?.active ? {} : "skip");
  const role: Role = profile?.role ?? "admin";
  const accessContext = { profile: profile ? { role: profile.role, active: profile.active } : null };
  const workspace = resolveWorkspace(accessContext);
  // Storekeepers operate the physical stock workflow only; avoid mounting the
  // order query because their role intentionally has no order.view permission.
  const ordersQuery = useQuery(
    api.orders.list,
    profile?.active && canAccess(accessContext, "orders.view") ? {} : "skip",
  );
  const {
    modal,
    openModal,
    closeModal,
    convertOrderTarget,
    setConvertOrderTarget,
    editMachineTarget,
    setEditMachineTarget,
    machineSettingsTarget,
    setMachineSettingsTarget,
  } = useDashboardModal();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const ensureProfile = useMutation(api.users.ensureProfile);
  const recordStockMovement = useMutation(api.materials.recordStockMovement);
  const createMaterial = useMutation(api.materials.create);
  const createMachine = useMutation(api.machines.create);
  const updateMachine = useMutation(api.machines.update);
  const removeMachine = useMutation(api.machines.remove);
  const updateMachineStatus = useMutation(api.machines.updateStatus);
  const createOffcut = useMutation(api.offcuts.create);
  const logScrap = useMutation(api.offcuts.logScrap);
  const createMaterialRequest = useMutation(api.materialRequests.create);
  const priceOrder = useMutation(api.orders.priceOrder);
  const confirmOrderAndIssueJobCard = useMutation(api.orders.confirmOrderAndIssueJobCard);
  const recordExceptionStockOut = useMutation(api.orders.recordExceptionStockOut);
  const createWalkIn = useMutation(api.orders.createWalkIn);
  const countMaterial = useMutation(api.reconciliation.countMaterial);

  const unclearedStockQuery = useQuery(
    api.inventory.myUnclearedStock,
    profile?.active && ["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"].includes(profile.role)
      ? {}
      : "skip"
  );

  useEffect(() => {
    if (profile === null) {
      void ensureProfile().catch(() => {});
    }
  }, [profile, ensureProfile]);

  // Synchronize role cookie for Next.js proxy routing
  useEffect(() => {
    if (profile?.role) {
      document.cookie = `user_role=${profile.role}; path=/; max-age=604800; SameSite=Lax`;
    }
  }, [profile?.role]);

  useEffect(() => {
    const stored = window.localStorage.getItem("dashboard-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("dashboard-sidebar-collapsed", String(next));
      return next;
    });
  }

  function finishMutation<T>(key: string, promise: Promise<T>, successMessage?: string) {
    safeMutation(
      key,
      promise,
      () => {
        if (successMessage) toast.success(successMessage);
      },
      () => {
        toast.error("Action failed. Please try again.");
      }
    );
  }

  if (profile === undefined || (profile?.active && !state)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0C0D10]">
        <InventoryLoader label="Loading Operations Console…" />
      </div>
    );
  }

  if (profile && !profile.active) {
    return <DashboardAccessDenied />;
  }

  const materials = state ? (withIds(state.materials) as Material[]) : [];
  const machines = state ? (withIds(state.machines) as Machine[]) : [];
  const jobs = state ? (withIds(state.jobs) as JobCard[]) : [];
  const runningJobsCount = jobs.filter((job) => job.status === "In production").length;
  const ordersCount = canAccess(accessContext, "orders.view")
    ? ordersQuery?.length ?? state?.orderStats?.todaysOrders ?? 0
    : 0;
  const activeMachinesCount = machines.filter((machine) => machine.status === "Running").length;
  const resolvedProfile: Profile | null = profile ? { ...profile, id: profile._id } : null;

  const canRecordStock = Boolean(profile && hasPermission(role, "stock.record"));
  const canCreateMaterial = Boolean(profile && hasPermission(role, "material.create"));
  const canCreateMachine = Boolean(profile && hasPermission(role, "machine.create"));
  const canCreateOffcut = Boolean(profile && hasPermission(role, "offcut.create"));
  const canCreateScrap = Boolean(profile && hasPermission(role, "scrap.create"));
  const canCreateRequest = Boolean(profile && hasPermission(role, "request.create"));
  const canRecordException = Boolean(profile && hasPermission(role, "stock.exception"));
  const canCreateOrder = Boolean(profile && hasPermission(role, "order.create"));
  const canRecordReconciliation = Boolean(profile && hasPermission(role, "reconciliation.record"));

  return (
    <div
      className="min-h-screen bg-[#0C0D10] text-[#E2E8F0]"
    >
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onToggleSidebar={toggleSidebar}
        collapsed={sidebarCollapsed}
        runningJobsCount={runningJobsCount}
        ordersCount={ordersCount}
        activeMachinesCount={activeMachinesCount}
        companyName={companySettings?.companyName}
        role={role}
        workspace={workspace ?? undefined}
      />

      <div
        className={cn(
          "min-h-screen flex flex-col transition-all duration-300",
          sidebarCollapsed ? "md:ml-16" : "md:ml-60"
        )}
      >
        <Topbar
          onMenu={() => setMobileNavOpen(true)}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          profile={resolvedProfile}
          companyName={companySettings?.companyName}
          onOpenSettings={() => {}}
        />

        <main className="flex-1 p-6 md:p-8 max-w-[1700px] w-full mx-auto animate-in fade-in duration-200">
          <WorkspaceRenderer context={accessContext}>{children}</WorkspaceRenderer>
        </main>
      </div>

      <DesktopConnectionBanner />

      {/* Global Modals triggered from any sub-route */}
      {modal === "stock" && canRecordStock ? (
        <StockModal
          materials={materials}
          onClose={closeModal}
          onSave={(materialId, direction, quantity, inputUnit, note) => {
            const material = materials.find((entry) => entry.id === materialId);
            finishMutation(
              `stock-${materialId}-${direction}`,
              recordStockMovement({
                materialId: materialId as Id<"materials">,
                direction,
                quantity,
                inputUnit,
                note,
              }),
              `${material?.name ?? "Material"}: ${direction === "in" ? "stock-in" : "stock-out"} recorded`
            );
          }}
        />
      ) : null}

      {modal === "exception" && canRecordException ? (
        <ExceptionStockModal
          materials={materials}
          onClose={closeModal}
          onSave={(input) => {
            finishMutation(
              "record-exception",
              recordExceptionStockOut({
                materialId: input.materialId as Id<"materials">,
                quantity: input.quantity,
                unit: input.unit,
                reason: input.reason,
                authorizationNote: input.authorizationNote,
              }),
              "Exception stock-out recorded"
            );
          }}
        />
      ) : null}

      {modal === "material" && canCreateMaterial ? (
        <MaterialModal
          onClose={closeModal}
          onSave={(input: NewMaterialInput) => {
            finishMutation("create-material", createMaterial(input), `${input.name} added to inventory`);
          }}
        />
      ) : null}

      {modal === "machine" && canCreateMachine ? (
        <MachineModal
          onClose={closeModal}
          onSave={(input: NewMachineInput) => {
            finishMutation("create-machine", createMachine(input), `${input.name} registered`);
          }}
        />
      ) : null}

      {modal === "offcut" && canCreateOffcut ? (
        <OffcutModal
          materials={materials}
          onClose={closeModal}
          onSave={(input: NewOffcutInput) => {
            finishMutation(
              "create-offcut",
              createOffcut({
                ...input,
                materialId: input.materialId as Id<"materials">,
                operatorSubStockId: input.operatorSubStockId as Id<"operatorSubStock"> | undefined,
                machineId: input.machineId as Id<"machines"> | undefined,
              }),
              "Offcut logged"
            );
          }}
        />
      ) : null}

      {modal === "scrap" && canCreateScrap ? (
        <ScrapModal
          materials={materials}
          onClose={closeModal}
          onSave={(input: NewScrapInput) => {
            finishMutation(
              "create-scrap",
              logScrap({
                ...input,
                materialId: input.materialId as Id<"materials">,
                operatorSubStockId: input.operatorSubStockId as Id<"operatorSubStock"> | undefined,
                machineId: input.machineId as Id<"machines"> | undefined,
              }),
              "Scrap logged"
            );
          }}
        />
      ) : null}

      {modal === "order" && canCreateOrder ? (
        <OrderCreateModal
          onClose={closeModal}
          onSave={(input: NewOrderInput) => {
            finishMutation("create-order", createWalkIn(input), "Order created successfully");
          }}
        />
      ) : null}

      {modal === "request" && canCreateRequest ? (
        <MaterialRequestModal
          jobs={jobs}
          materials={materials}
          unclearedStock={unclearedStockQuery ?? []}
          onClose={closeModal}
          onSave={(input: NewMaterialRequestInput) => {
            finishMutation(
              "create-request",
              createMaterialRequest({
                jobCardId: input.jobCardId as Id<"jobCards">,
                materialId: input.materialId as Id<"materials">,
                requestedQuantity: input.requestedQuantity,
                unit: input.unit,
                note: input.note,
              }),
              "Material request submitted"
            );
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
              `${editMachineTarget.name} updated`
            );
          }}
        />
      ) : null}

      {machineSettingsTarget ? (
        <MachineSettingsModal
          machine={machineSettingsTarget}
          onClose={() => setMachineSettingsTarget(null)}
          onEdit={(m) => {
            setMachineSettingsTarget(null);
            setEditMachineTarget(m);
          }}
          onRemove={(machineId) => {
            finishMutation(`remove-machine-${machineId}`, removeMachine({ machineId: machineId as Id<"machines"> }), "Machine removed");
            setMachineSettingsTarget(null);
          }}
          onStatusChange={(machineId, status) => {
            finishMutation(`status-machine-${machineId}`, updateMachineStatus({ machineId: machineId as Id<"machines">, status }), `Status updated to ${status}`);
          }}
          isPending={isPending}
          canUpdateMachine={Boolean(profile && hasPermission(role, "machine.update"))}
          canDeleteMachine={Boolean(profile && hasPermission(role, "machine.delete"))}
          canCreateOffcut={canCreateOffcut}
          onOffcut={() => {
            setMachineSettingsTarget(null);
            openModal("offcut");
          }}
          canCreateScrap={canCreateScrap}
          onScrap={() => {
            setMachineSettingsTarget(null);
            openModal("scrap");
          }}
        />
      ) : null}

      {convertOrderTarget && convertOrderTarget.status === "PENDING_REVIEW" ? (
        <OrderPriceModal
          order={convertOrderTarget}
          onClose={() => setConvertOrderTarget(null)}
          onSave={(amount) =>
            finishMutation(
              `price-${convertOrderTarget.id}`,
              priceOrder({ orderId: convertOrderTarget.id as Id<"customerOrders">, amount }).then((res) => {
                setConvertOrderTarget(null);
                return res;
              }),
              `${convertOrderTarget.code} priced · awaiting payment`
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
          onSave={(input) =>
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
              }).then((res) => {
                setConvertOrderTarget(null);
                return res;
              }),
              "Order confirmed · job card issued"
            )
          }
        />
      ) : null}

      {modal === "reconciliation" && canRecordReconciliation ? (
        <ReconciliationModal
          materials={materials}
          onClose={closeModal}
          onSave={(input: NewReconciliationInput) => {
            finishMutation(
              "record-reconciliation",
              countMaterial({
                materialId: input.materialId as Id<"materials">,
                countedQuantity: input.countedQuantity,
                note: input.note,
              }),
              "Physical count recorded"
            );
          }}
        />
      ) : null}
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <DashboardModalProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </DashboardModalProvider>
  );
}
