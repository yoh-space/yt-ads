import type { ServiceId } from "./services";
import { serviceSpecificationFields } from "./service-specifications";

export type WizardStep =
  | "welcome"
  | "profile"
  | "account-type"
  | "company-tin"
  | "category"
  | "service"
  | "dimensions"
  | "specifications"
  | "artwork"
  | "review";

export interface WizardNavigationOptions {
  accountType?: "individual" | "corporate" | "government";
  serviceId?: ServiceId | string;
  isEdit?: boolean;
}

/**
 * A service only shows the Specifications step when it has customer-entered
 * specification fields. Roll-based services (banners, stickers, canvas) now
 * derive their roll substrate automatically from the job width on the backend,
 * so that step is skipped entirely.
 */
function serviceNeedsSpecifications(serviceId?: string): boolean {
  if (!serviceId) return true;
  return serviceSpecificationFields(serviceId).length > 0;
}

export function getActiveWizardSteps(options?: WizardNavigationOptions): WizardStep[] {
  const isIndividual = !options?.accountType || options.accountType === "individual";
  const steps: WizardStep[] = [
    "welcome",
    "profile",
    "account-type",
    ...(isIndividual ? [] : (["company-tin"] as WizardStep[])),
    "category",
    "service",
    "dimensions",
    ...(serviceNeedsSpecifications(options?.serviceId) ? (["specifications"] as WizardStep[]) : []),
    "artwork",
    "review",
  ];
  return steps;
}

export function nextStep(current: WizardStep, options?: WizardNavigationOptions): WizardStep | null {
  const steps = getActiveWizardSteps(options);
  const idx = steps.indexOf(current);
  if (idx === -1) {
    if (current === "company-tin") return "category";
    if (current === "specifications") return "artwork";
    return null;
  }
  return idx < steps.length - 1 ? steps[idx + 1] : null;
}

export function prevStep(current: WizardStep, options?: WizardNavigationOptions): WizardStep | null {
  const steps = getActiveWizardSteps(options);
  const idx = steps.indexOf(current);
  if (idx === -1) {
    if (current === "company-tin") return "account-type";
    if (current === "specifications") return "dimensions";
    return null;
  }
  return idx > 0 ? steps[idx - 1] : null;
}

export function stepNumber(step: WizardStep, options?: WizardNavigationOptions): number {
  const steps = getActiveWizardSteps(options);
  const idx = steps.indexOf(step);
  return idx >= 0 ? idx + 1 : 1;
}

export function totalSteps(options?: WizardNavigationOptions): number {
  return getActiveWizardSteps(options).length;
}

export function stepOrder(options?: WizardNavigationOptions): WizardStep[] {
  return getActiveWizardSteps(options);
}

export function stepLabel(step: WizardStep): string {
  const labels: Record<WizardStep, string> = {
    welcome: "Welcome",
    profile: "Profile",
    "account-type": "Account Type",
    "company-tin": "Business Details",
    category: "Category",
    service: "Service",
    dimensions: "Dimensions & Qty",
    specifications: "Specifications",
    artwork: "Artwork & Notes",
    review: "Review & Submit",
  };
  return labels[step];
}
