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

export function nextStep(current: WizardStep): WizardStep | null {
  const order: WizardStep[] = [
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
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}

export function prevStep(current: WizardStep): WizardStep | null {
  const order: WizardStep[] = [
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
  const idx = order.indexOf(current);
  return idx > 0 ? order[idx - 1] : null;
}

export function stepNumber(step: WizardStep): number {
  return ["welcome", "profile", "account-type", "company-tin", "category", "service", "specifications", "dimensions", "artwork", "review"].indexOf(step) + 1;
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
