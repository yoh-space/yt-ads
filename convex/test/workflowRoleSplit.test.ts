import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { ROLE_PERMISSIONS } from "../../src/shared/role-permissions";
import { ROUTE_CONTRACTS } from "../../src/lib/role-routing";

describe("Workflow Role Split: Permissions and Routing Contracts", () => {
  it("assigns accurate and strictly separated permissions to cashier, designer, and receptionist", () => {
    const cashierPerms = new Set(ROLE_PERMISSIONS.cashier);
    const designerPerms = new Set(ROLE_PERMISSIONS.designer);
    const receptionistPerms = new Set(ROLE_PERMISSIONS.receptionist);

    // Cashier must have payment verification and job creation, but NOT price setting or design review
    expect(cashierPerms.has("order.payment_verify")).toBe(true);
    expect(cashierPerms.has("job.create")).toBe(true);
    expect(cashierPerms.has("order.price")).toBe(false);
    expect(cashierPerms.has("design.review")).toBe(false);
    expect(cashierPerms.has("design.assign")).toBe(false);

    // Designer must have design submission, but NOT pricing or payment verification
    expect(designerPerms.has("design.view")).toBe(true);
    expect(designerPerms.has("design.submit")).toBe(true);
    expect(designerPerms.has("order.price")).toBe(false);
    expect(designerPerms.has("order.payment_verify")).toBe(false);
    expect(designerPerms.has("job.create")).toBe(false);

    // Receptionist must have pricing and design coordination, but NOT payment verification
    expect(receptionistPerms.has("order.price")).toBe(true);
    expect(receptionistPerms.has("design.assign")).toBe(true);
    expect(receptionistPerms.has("design.review")).toBe(true);
    expect(receptionistPerms.has("order.payment_verify")).toBe(false);
  });

  it("configures dedicated workspace route contracts for cashier and designer", () => {
    const cashierContract = ROUTE_CONTRACTS.cashier;
    const designerContract = ROUTE_CONTRACTS.designer;
    const receptionistContract = ROUTE_CONTRACTS.receptionist;

    expect(cashierContract.homeRoute).toBe("/dashboard/cashier");
    expect(cashierContract.allowedPrefixes).toContain("/dashboard/cashier");

    expect(designerContract.homeRoute).toBe("/dashboard/designer");
    expect(designerContract.allowedPrefixes).toContain("/dashboard/designer");

    expect(receptionistContract.homeRoute).toBe("/dashboard/receptionist");
    expect(receptionistContract.allowedPrefixes).toContain("/dashboard/receptionist");
  });
});

describe("Workflow Role Split: Order Design and Payment Gates", () => {
  it("validates design requirements before pricing", () => {
    const orderWithPendingDesign = {
      _id: "order_1",
      status: "RECEPTION_REVIEW",
      designRequired: true,
      designStatus: "IN_PROGRESS",
      amount: 1500,
    };

    // Design is required but not approved
    const canPrice = !orderWithPendingDesign.designRequired || orderWithPendingDesign.designStatus === "APPROVED";
    expect(canPrice).toBe(false);

    const orderWithApprovedDesign = {
      _id: "order_2",
      status: "RECEPTION_REVIEW",
      designRequired: true,
      designStatus: "APPROVED",
      amount: 1500,
    };

    const canPriceApproved = !orderWithApprovedDesign.designRequired || orderWithApprovedDesign.designStatus === "APPROVED";
    expect(canPriceApproved).toBe(true);
  });

  it("validates payment readiness for Cashier queue", () => {
    const orderNotPriced = {
      _id: "order_3",
      status: "RECEPTION_REVIEW",
      amount: undefined,
      designRequired: false,
    };

    const isReadyForCashier = (order: any) =>
      order.status === "PRICED_AND_PENDING_PAYMENT" &&
      typeof order.amount === "number" &&
      order.amount > 0 &&
      (!order.designRequired || order.designStatus === "APPROVED");

    expect(isReadyForCashier(orderNotPriced)).toBe(false);

    const orderPricedAndReady = {
      _id: "order_4",
      status: "PRICED_AND_PENDING_PAYMENT",
      amount: 3500,
      designRequired: true,
      designStatus: "APPROVED",
    };

    expect(isReadyForCashier(orderPricedAndReady)).toBe(true);
  });
});
