import type { ServiceId } from "@/constants/services";

export type MiniAppTab = "create" | "orders" | "profile";

export type OrderFormState = {
  clientName: string;
  companyLegalName: string;
  tinNumber: string;
  serviceType: ServiceId | null;
  width: string;
  height: string;
  quantity: string;
  notes: string;
};

export type CustomerOrderSummary = {
  id: string;
  code: string;
  serviceType: string;
  dimensions: string;
  quantity: string;
  status: string;
  updatedAt: number;
};
