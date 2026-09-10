import type { ServiceId } from "@/constants/services";

export type MiniAppTab = "create" | "orders" | "profile";

export type OrderFormState = {
  clientName: string;
  companyLegalName: string;
  tinNumber: string;
  accountType: "individual" | "corporate" | "government";
  serviceType: ServiceId | null;
  specifications: Record<string, string>;
  width: string;
  height: string;
  quantity: string;
  notes: string;
};

export type CustomerOrderSummary = {
  id: string;
  code: string;
  clientName: string;
  phone: string;
  serviceType: string;
  serviceId?: string;
  specifications?: Record<string, string>;
  dimensions: string;
  quantity: string;
  status: string;
  editRevision?: number;
  customerEditable?: boolean;
  customerEditLockedAt?: number;
  reviewLockReason?: string;
  lastCustomerEditedAt?: number;
  preferredDueDate: number;
  notes?: string;
  updatedAt: number;
};
