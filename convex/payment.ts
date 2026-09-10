import type { Doc } from "./_generated/dataModel";

export type PaymentAccount = { label: string; channel: string; name: string; identifier: string };
export type PaymentInstructions = { version: number; capturedAt: number; accounts: PaymentAccount[] };

export function roundMoney(value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error("Amount must be a finite non-negative number.");
  return Number(value.toFixed(2));
}

export function paymentBreakdown(amount: number) {
  const total = roundMoney(amount);
  const advanceDueAmount = roundMoney(total / 2);
  return { total, advanceDueAmount, remainingDueAmount: roundMoney(total - advanceDueAmount) };
}

export function assertPaymentAmount(received: number, required: number, label: string) {
  const actual = roundMoney(received);
  const due = roundMoney(required);
  if (actual !== due) throw new Error(`${label} must equal ${due.toFixed(2)} ETB.`);
  return actual;
}

export function snapshotPaymentInstructions(
  settings: Pick<Doc<"companySettings">, "paymentInstructions" | "paymentInstructionsVersion"> | null,
  capturedAt = Date.now(),
): PaymentInstructions {
  const configured = settings?.paymentInstructions;
  const accounts: PaymentAccount[] = [];
  if (configured?.cbe?.enabled) accounts.push({ label: "Commercial Bank of Ethiopia", channel: "CBE", name: configured.cbe.accountName, identifier: configured.cbe.accountNumber });
  if (configured?.boa?.enabled) accounts.push({ label: "Bank of Abyssinia", channel: "BOA", name: configured.boa.accountName, identifier: configured.boa.accountNumber });
  if (configured?.telebirr?.enabled) accounts.push({ label: "Telebirr", channel: "Telebirr", name: configured.telebirr.displayName, identifier: configured.telebirr.merchantId });
  if (configured?.cbeBirr?.enabled) accounts.push({ label: "CBE Birr", channel: "CBE Birr", name: configured.cbeBirr.displayName, identifier: configured.cbeBirr.merchantId });
  return { version: settings?.paymentInstructionsVersion ?? 0, capturedAt, accounts };
}

export function validatePaymentIdentifier(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 80) throw new Error(`${label} is required and must be 80 characters or fewer.`);
  return normalized;
}
