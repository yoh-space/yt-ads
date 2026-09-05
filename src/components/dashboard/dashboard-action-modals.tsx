"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { JobCard, Machine, Material, Profile, Role } from "@/lib/operations-types";
import { hasPermission } from "@/lib/permissions";
import { useSafeMutation } from "./pending-store";
import { useDashboardModal } from "./modal-context";
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

type StateDoc = { _id: string; [key: string]: unknown };
type WithId<T extends StateDoc> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends StateDoc>(docs: T[]): WithId<T>[] {
  return docs.map(({ _id, ...rest }) => ({ ...rest, id: _id }));
}

export function DashboardActionModals({ profile }: { profile: Profile | null }) {
  const { isPending, safeMutation } = useSafeMutation();
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
  const role: Role = profile?.role ?? "admin";
  const needsState =
    modal === "stock" ||
    modal === "exception" ||
    modal === "offcut" ||
    modal === "scrap" ||
    modal === "request" ||
    modal === "reconciliation" ||
    machineSettingsTarget !== null ||
    editMachineTarget !== null ||
    convertOrderTarget !== null;
  const state = useQuery(api.dashboard.getState, profile?.active && needsState ? {} : "skip");
  const unclearedStock = useQuery(
    api.inventory.myUnclearedStock,
    profile?.active && modal === "request" ? {} : "skip",
  );

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

  if (!state && needsState) return null;

  const materials = withIds((state?.materials ?? []) as StateDoc[]) as Material[];
  const machines = withIds((state?.machines ?? []) as StateDoc[]) as Machine[];
  const jobs = withIds((state?.jobs ?? []) as StateDoc[]) as JobCard[];
  const can = (permission: Parameters<typeof hasPermission>[1]) => Boolean(profile && hasPermission(role, permission));
  const finish = <T,>(key: string, promise: Promise<T>, message: string) => {
    safeMutation(key, promise, () => toast.success(message), () => toast.error("Action failed. Please try again."));
  };

  return (
    <>
      {modal === "stock" && can("stock.record") ? (
        <StockModal
          materials={materials}
          onClose={closeModal}
          onSave={(materialId, direction, quantity, inputUnit, note) => {
            const material = materials.find((entry) => entry.id === materialId) as { name?: string } | undefined;
            finish(`stock-${materialId}-${direction}`, recordStockMovement({
              materialId: materialId as Id<"materials">,
              direction,
              quantity,
              inputUnit,
              note,
            }), `${material?.name ?? "Material"}: ${direction === "in" ? "stock-in" : "stock-out"} recorded`);
          }}
        />
      ) : null}
      {modal === "exception" && can("stock.exception") ? (
        <ExceptionStockModal
          materials={materials}
          onClose={closeModal}
          onSave={(input) => finish("record-exception", recordExceptionStockOut({
            materialId: input.materialId as Id<"materials">,
            quantity: input.quantity,
            unit: input.unit,
            reason: input.reason,
            authorizationNote: input.authorizationNote,
          }), "Exception stock-out recorded")}
        />
      ) : null}
      {modal === "material" && can("material.create") ? (
        <MaterialModal onClose={closeModal} onSave={(input: NewMaterialInput) => finish("create-material", createMaterial(input), `${input.name} added to inventory`)} />
      ) : null}
      {modal === "machine" && can("machine.create") ? (
        <MachineModal onClose={closeModal} onSave={(input: NewMachineInput) => finish("create-machine", createMachine(input), `${input.name} registered`)} />
      ) : null}
      {modal === "offcut" && can("offcut.create") ? (
        <OffcutModal
          materials={materials}
          onClose={closeModal}
          onSave={(input: NewOffcutInput) => finish("create-offcut", createOffcut({
            ...input,
            materialId: input.materialId as Id<"materials">,
            operatorSubStockId: input.operatorSubStockId as Id<"operatorSubStock"> | undefined,
            machineId: input.machineId as Id<"machines"> | undefined,
          }), "Offcut logged")}
        />
      ) : null}
      {modal === "scrap" && can("scrap.create") ? (
        <ScrapModal
          materials={materials}
          onClose={closeModal}
          onSave={(input: NewScrapInput) => finish("create-scrap", logScrap({
            ...input,
            materialId: input.materialId as Id<"materials">,
            operatorSubStockId: input.operatorSubStockId as Id<"operatorSubStock"> | undefined,
            machineId: input.machineId as Id<"machines"> | undefined,
          }), "Scrap logged")}
        />
      ) : null}
      {modal === "order" && can("order.create") ? (
        <OrderCreateModal onClose={closeModal} onSave={(input: NewOrderInput) => finish("create-order", createWalkIn(input), "Order created successfully")} />
      ) : null}
      {modal === "request" && can("request.create") ? (
        <MaterialRequestModal
          jobs={jobs}
          materials={materials}
          unclearedStock={unclearedStock ?? []}
          onClose={closeModal}
          onSave={(input: NewMaterialRequestInput) => finish("create-request", createMaterialRequest({
            jobCardId: input.jobCardId as Id<"jobCards">,
            materialId: input.materialId as Id<"materials">,
            requestedQuantity: input.requestedQuantity,
            unit: input.unit,
            note: input.note,
          }), "Material request submitted")}
        />
      ) : null}
      {editMachineTarget ? (
        <MachineEditModal
          machine={editMachineTarget}
          onClose={() => setEditMachineTarget(null)}
          onSave={(input) => finish(`edit-machine-${editMachineTarget.id}`, updateMachine({ machineId: editMachineTarget.id as Id<"machines">, ...input }), `${editMachineTarget.name} updated`)}
        />
      ) : null}
      {machineSettingsTarget ? (
        <MachineSettingsModal
          machine={machineSettingsTarget}
          onClose={() => setMachineSettingsTarget(null)}
          onEdit={(machine) => { setMachineSettingsTarget(null); setEditMachineTarget(machine); }}
          onRemove={(machineId) => { finish(`remove-machine-${machineId}`, removeMachine({ machineId: machineId as Id<"machines"> }), "Machine removed"); setMachineSettingsTarget(null); }}
          onStatusChange={(machineId, status) => finish(`status-machine-${machineId}`, updateMachineStatus({ machineId: machineId as Id<"machines">, status }), `Status updated to ${status}`)}
          isPending={isPending}
          canUpdateMachine={can("machine.update")}
          canDeleteMachine={can("machine.delete")}
          canCreateOffcut={can("offcut.create")}
          onOffcut={() => { setMachineSettingsTarget(null); openModal("offcut"); }}
          canCreateScrap={can("scrap.create")}
          onScrap={() => { setMachineSettingsTarget(null); openModal("scrap"); }}
        />
      ) : null}
      {convertOrderTarget?.status === "PENDING_REVIEW" ? (
        <OrderPriceModal
          order={convertOrderTarget}
          onClose={() => setConvertOrderTarget(null)}
          onSave={(amount) => finish(`price-${convertOrderTarget.id}`, priceOrder({ orderId: convertOrderTarget.id as Id<"customerOrders">, amount }).then((result) => { setConvertOrderTarget(null); return result; }), `${convertOrderTarget.code} priced · awaiting payment`)}
        />
      ) : null}
      {convertOrderTarget?.status === "PRICED_AND_PENDING_PAYMENT" ? (
        <OrderConfirmModal
          order={convertOrderTarget}
          machines={machines}
          materials={materials}
          onClose={() => setConvertOrderTarget(null)}
          onSave={(input) => finish(`confirm-${convertOrderTarget.id}`, confirmOrderAndIssueJobCard({
            orderId: convertOrderTarget.id as Id<"customerOrders">,
            paymentDecision: input.paymentDecision,
            paymentMethod: input.paymentMethod,
            machineId: input.machineId as Id<"machines">,
            materialId: input.materialId as Id<"materials">,
            quantity: input.quantity,
            unit: input.unit,
            priority: input.priority,
          }).then((result) => { setConvertOrderTarget(null); return result; }), "Order confirmed · job card issued")}
        />
      ) : null}
      {modal === "reconciliation" && can("reconciliation.record") ? (
        <ReconciliationModal
          materials={materials}
          onClose={closeModal}
          onSave={(input: NewReconciliationInput) => finish("record-reconciliation", countMaterial({
            materialId: input.materialId as Id<"materials">,
            countedQuantity: input.countedQuantity,
            note: input.note,
          }), "Physical count recorded")}
        />
      ) : null}
    </>
  );
}
