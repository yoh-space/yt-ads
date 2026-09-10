import { describe, expect, it } from "vitest";
import { assertPaymentAmount, paymentBreakdown, snapshotPaymentInstructions } from "../payment";

describe("two-stage payments", () => {
  it("splits 600 ETB into equal advance and balance", () => {
    expect(paymentBreakdown(600)).toEqual({ total: 600, advanceDueAmount: 300, remainingDueAmount: 300 });
  });

  it("keeps odd totals reconciled after rounding", () => {
    const result = paymentBreakdown(601);
    expect(result.advanceDueAmount + result.remainingDueAmount).toBe(result.total);
  });

  it("rejects underpayment and accepts the exact amount", () => {
    expect(() => assertPaymentAmount(299.99, 300, "Advance payment")).toThrow();
    expect(assertPaymentAmount(300, 300, "Advance payment")).toBe(300);
  });

  it("snapshots only enabled customer-facing channels", () => {
    const snapshot = snapshotPaymentInstructions({
      paymentInstructionsVersion: 4,
      paymentInstructions: {
        cbe: { accountName: "YT Ads", accountNumber: "00123", enabled: true },
        boa: { accountName: "YT Ads", accountNumber: "999", enabled: false },
        telebirr: { displayName: "YT Ads", merchantId: "M-1", enabled: true },
      },
    });
    expect(snapshot.version).toBe(4);
    expect(snapshot.accounts.map((account) => account.identifier)).toEqual(["00123", "M-1"]);
  });
});
