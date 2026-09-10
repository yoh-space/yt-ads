import type { ServiceId } from "./services";

export const WIZARD_TOTAL_STEPS = 10;

export type WizardStep =
  | "welcome"
  | "profile"
  | "account-type"
  | "company-tin"
  | "category"
  | "service"
  | "specifications"
  | "dimensions"
  | "artwork"
  | "review";

export interface WizardNavigationOptions {
  accountType?: "individual" | "corporate" | "government";
  isEdit?: boolean;
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
    "specifications",
    "dimensions",
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
    return null;
  }
  return idx < steps.length - 1 ? steps[idx + 1] : null;
}

export function prevStep(current: WizardStep, options?: WizardNavigationOptions): WizardStep | null {
  const steps = getActiveWizardSteps(options);
  const idx = steps.indexOf(current);
  if (idx === -1) {
    if (current === "company-tin") return "account-type";
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

export function stepLabel(step: WizardStep): string {
  const labels: Record<WizardStep, string> = {
    welcome: "Welcome",
    profile: "Profile",
    "account-type": "Account Type",
    "company-tin": "Business Details",
    category: "Category",
    service: "Service",
    specifications: "Specifications",
    dimensions: "Dimensions & Qty",
    artwork: "Artwork & Notes",
    review: "Review & Submit",
  };
  return labels[step];
}
