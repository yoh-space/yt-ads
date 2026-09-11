import { describe, expect, it } from "vitest";
import { assertPaymentAmount, paymentBreakdown, snapshotPaymentInstructions } from "../payment";
import { buildCustomerStatusMessage } from "../orders";

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

describe("customer status notification copy", () => {
  it("includes total, half advance, balance, and owner account numbers when priced", () => {
    const message = buildCustomerStatusMessage({
      code: "ORD-2026-076697",
      status: "PRICED_AND_PENDING_PAYMENT",
      amount: 3000,
      advanceDueAmount: 1500,
      remainingDueAmount: 1500,
      paymentInstructionsSnapshot: {
        version: 1,
        capturedAt: 0,
        accounts: [
          { label: "Commercial Bank of Ethiopia", channel: "CBE", name: "YT Ads", identifier: "1000123456789" },
          { label: "Telebirr", channel: "Telebirr", name: "YT Ads", identifier: "0912345678" },
        ],
      },
    });

    expect(message).toContain("ORD-2026-076697");
    expect(message).toContain("3000.00 ብር");
    expect(message).toContain("1500.00 ብር");
    expect(message).toContain("Commercial Bank of Ethiopia");
    expect(message).toContain("1000123456789");
    expect(message).toContain("Telebirr");
    expect(message).toContain("0912345678");
  });

  it("omits the account block when no channels are configured", () => {
    const message = buildCustomerStatusMessage({
      code: "ORD-1",
      status: "PRICED_AND_PENDING_PAYMENT",
      amount: 200,
      advanceDueAmount: 100,
      remainingDueAmount: 100,
    });
    expect(message).not.toContain("የክፍያ መረጃ");
  });
});
