import type { ServiceId } from "./services";

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

const FULL_STEP_ORDER: WizardStep[] = [
  "welcome",
  "profile",
  "account-type",
  "company-tin",
  "category",
  "service",
  "specifications",
  "dimensions",
  "artwork",
  "review",
];

export function stepOrder(accountType?: string | null): WizardStep[] {
  if (accountType === "individual") {
    return FULL_STEP_ORDER.filter((s) => s !== "company-tin");
  }
  return FULL_STEP_ORDER;
}

export function nextStep(current: WizardStep, accountType?: string | null): WizardStep | null {
  const order = stepOrder(accountType);
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

export function prevStep(current: WizardStep, accountType?: string | null): WizardStep | null {
  const order = stepOrder(accountType);
  const idx = order.indexOf(current);
  return idx > 0 ? order[idx - 1] : null;
}

export function stepNumber(step: WizardStep, accountType?: string | null): number {
  return stepOrder(accountType).indexOf(step) + 1;
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
