"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Modal } from "./nav-config";
import type { CustomerOrder, Machine } from "@/lib/operations-types";

type ModalContextType = {
  modal: Modal;
  openModal: (modal: Modal) => void;
  closeModal: () => void;
  convertOrderTarget: CustomerOrder | null;
  setConvertOrderTarget: (order: CustomerOrder | null) => void;
  editMachineTarget: Machine | null;
  setEditMachineTarget: (machine: Machine | null) => void;
  machineSettingsTarget: Machine | null;
  setMachineSettingsTarget: (machine: Machine | null) => void;
  floorMachineId?: string;
  setFloorMachineId: (id?: string) => void;
};

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function DashboardModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<Modal>(null);
  const [convertOrderTarget, setConvertOrderTarget] = useState<CustomerOrder | null>(null);
  const [editMachineTarget, setEditMachineTarget] = useState<Machine | null>(null);
  const [machineSettingsTarget, setMachineSettingsTarget] = useState<Machine | null>(null);
  const [floorMachineId, setFloorMachineId] = useState<string | undefined>();

  const openModal = (m: Modal) => setModal(m);
  const closeModal = () => {
    setModal(null);
    setConvertOrderTarget(null);
    setEditMachineTarget(null);
    setMachineSettingsTarget(null);
  };

  return (
    <ModalContext.Provider
      value={{
        modal,
        openModal,
        closeModal,
        convertOrderTarget,
        setConvertOrderTarget,
        editMachineTarget,
        setEditMachineTarget,
        machineSettingsTarget,
        setMachineSettingsTarget,
        floorMachineId,
        setFloorMachineId,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useDashboardModal() {
  const context = useContext(ModalContext);
  if (!context) {
    return {
      modal: null,
      openModal: () => {},
      closeModal: () => {},
      convertOrderTarget: null,
      setConvertOrderTarget: () => {},
      editMachineTarget: null,
      setEditMachineTarget: () => {},
      machineSettingsTarget: null,
      setMachineSettingsTarget: () => {},
      floorMachineId: undefined,
      setFloorMachineId: () => {},
    };
  }
  return context;
}
