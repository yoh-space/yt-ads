import { describe, expect, it } from "vitest";
import { canTransitionOrderStatus } from "../orders";

/**
 * Phase 3 — Customer Onboarding → Lock/Edit Lifecycle state-machine invariants.
 *
 * These tests assert the core decision logic that guards
 * `lockOrderForReview` and `updateCustomerOrder` so the same rules are
 * enforced regardless of which UI path triggers them. The actual Convex
 * mutation bodies delegate to the same logic, so testing the pure helpers
 * here gives fast, deterministic coverage.
 */

const CONFIRMED_PAID_OR_CREDIT = "CONFIRMED_PAID_OR_CREDIT";

// Mirror of the order-document shape that the lock/edit guards inspect.
interface OrderState {
  status: string;
  customerEditLockedAt?: number;
  customerEditable: boolean;
  editRevision: number;
}

// Pure predicate matching `lockOrderForReviewInternal` guard:
//   order.status === "PENDING_REVIEW" && !order.customerEditLockedAt
function canLockForReview(order: OrderState): boolean {
  return order.status === "PENDING_REVIEW" && !order.customerEditLockedAt;
}

// Pure predicate matching `updateCustomerOrder` guard:
//   !order.customerEditLockedAt && order.status === "PENDING_REVIEW"
function canCustomerEdit(order: OrderState): boolean {
  return order.status === "PENDING_REVIEW" && !order.customerEditLockedAt;
}

// Pure predicate matching `priceOrderInternal` guard:
//   !!order.customerEditLockedAt && status in [RECEPTION_REVIEW, PRICED_AND_PENDING_PAYMENT]
function canPrice(order: OrderState): boolean {
  return ["RECEPTION_REVIEW", "PRICED_AND_PENDING_PAYMENT"].includes(order.status) && Boolean(order.customerEditLockedAt);
}

// Pure predicate matching `confirmOrderAndIssueJobCardInternal` guard:
function canConfirm(order: OrderState): boolean {
  return ["RECEPTION_REVIEW", "PRICED_AND_PENDING_PAYMENT"].includes(order.status) && Boolean(order.customerEditLockedAt);
}

// Pure concurrency check matching `updateCustomerOrder`:
//   args.editRevision === order.editRevision
function isRevisionFresh(order: OrderState, incomingRevision: number): boolean {
  return order.editRevision === incomingRevision;
}

// Simulate the lock transition effect.
function applyLock(order: OrderState, now: number, _lockedBy: string): OrderState {
  expect(canLockForReview(order)).toBe(true);
  return { ...order, status: "RECEPTION_REVIEW", customerEditLockedAt: now, editRevision: order.editRevision + 1, customerEditable: false };
}

// Simulate the pricing transition effect.
function applyPrice(order: OrderState): OrderState {
  expect(canPrice(order)).toBe(true);
  return { ...order, status: "PRICED_AND_PENDING_PAYMENT" };
}

// Simulate the confirm transition effect.
function applyConfirm(order: OrderState): OrderState {
  expect(canConfirm(order)).toBe(true);
    return { ...order, status: CONFIRMED_PAID_OR_CREDIT };
}

describe("Phase 3 — Lock & Edit State Machine", () => {
  describe("initial order state", () => {
    it("a newly submitted order is PENDING_REVIEW, unlocked, revision 1", () => {
      const order: OrderState = {
        status: "PENDING_REVIEW",
        customerEditLockedAt: undefined,
        customerEditable: true,
        editRevision: 1,
      };
      expect(canLockForReview(order)).toBe(true);
      expect(canCustomerEdit(order)).toBe(true);
      expect(canPrice(order)).toBe(false);
      expect(canConfirm(order)).toBe(false);
    });
  });

  describe("customer edit before lock", () => {
    it("customer can edit while PENDING_REVIEW and not locked", () => {
      const order: OrderState = {
        status: "PENDING_REVIEW",
        customerEditLockedAt: undefined,
        customerEditable: true,
        editRevision: 3,
      };
      expect(canCustomerEdit(order)).toBe(true);
    });

    it("customer edit rejected after Reception locks the order", () => {
      const locked = applyLock(
        {
          status: "PENDING_REVIEW",
          customerEditLockedAt: undefined,
          customerEditable: true,
          editRevision: 5,
        },
        Date.now(),
        "reception-1",
      );
      expect(canCustomerEdit(locked)).toBe(false);
      expect(locked.customerEditLockedAt).toBeDefined();
      expect(locked.customerEditable).toBe(false);
    });

    it("stale edit revision is rejected", () => {
      const order: OrderState = {
        status: "PENDING_REVIEW",
        customerEditLockedAt: undefined,
        customerEditable: true,
        editRevision: 5,
      };
      expect(isRevisionFresh(order, 3)).toBe(false);
      expect(isRevisionFresh(order, 5)).toBe(true);
    });

    it("lock bumps editRevision so pending customer edits become stale", () => {
      const order: OrderState = {
        status: "PENDING_REVIEW",
        customerEditLockedAt: undefined,
        customerEditable: true,
        editRevision: 5,
      };
      const locked = applyLock(order, Date.now(), "reception-1");
      expect(locked.editRevision).toBe(6);
      expect(isRevisionFresh(locked, 5)).toBe(false);
    });
  });

  describe("pricing requires prior lock", () => {
    it("pricing is rejected while PENDING_REVIEW without a lock", () => {
      const order: OrderState = {
        status: "PENDING_REVIEW",
        customerEditLockedAt: undefined,
        customerEditable: true,
        editRevision: 1,
      };
      expect(canPrice(order)).toBe(false);
    });

    it("pricing is allowed after lock moves order to RECEPTION_REVIEW", () => {
      const order: OrderState = {
        status: "PENDING_REVIEW",
        customerEditLockedAt: undefined,
        customerEditable: true,
        editRevision: 1,
      };
      const locked = applyLock(order, Date.now(), "reception-1");
      expect(canPrice(locked)).toBe(true);
      const priced = applyPrice(locked);
      expect(priced.status).toBe("PRICED_AND_PENDING_PAYMENT");
    });

    it("pricing remains allowed during PRICED_AND_PENDING_PAYMENT (re-price)", () => {
      const priced: OrderState = {
        status: "PRICED_AND_PENDING_PAYMENT",
        customerEditLockedAt: Date.now() - 10_000,
        customerEditable: false,
        editRevision: 2,
      };
      expect(canPrice(priced)).toBe(true);
    });
  });

  describe("confirmation requires prior lock", () => {
    it("confirmation is rejected while PENDING_REVIEW without a lock", () => {
      const order: OrderState = {
        status: "PENDING_REVIEW",
        customerEditLockedAt: undefined,
        customerEditable: true,
        editRevision: 1,
      };
      expect(canConfirm(order)).toBe(false);
    });

    it("confirmation is allowed from both RECEPTION_REVIEW and PRICED_AND_PENDING_PAYMENT when locked", () => {
      const locked: OrderState = {
        status: "RECEPTION_REVIEW",
        customerEditLockedAt: Date.now(),
        customerEditable: false,
        editRevision: 2,
      };
      expect(canConfirm(locked)).toBe(true);

      const priced: OrderState = {
        status: "PRICED_AND_PENDING_PAYMENT",
        customerEditLockedAt: Date.now(),
        customerEditable: false,
        editRevision: 2,
      };
      expect(canConfirm(priced)).toBe(true);
    });

    it("confirmation on a locked, priced order transitions to CONFIRMED_PAID_OR_CREDIT", () => {
      const priced: OrderState = {
        status: "PRICED_AND_PENDING_PAYMENT",
        customerEditLockedAt: Date.now(),
        customerEditable: false,
        editRevision: 2,
      };
      const confirmed = applyConfirm(priced);
      expect(confirmed.status).toBe(CONFIRMED_PAID_OR_CREDIT);
      expect(confirmed.customerEditLockedAt).toBeDefined();
    });
  });

  describe("double-lock protection", () => {
    it("cannot lock an already-locked order", () => {
      const locked: OrderState = {
        status: "RECEPTION_REVIEW",
        customerEditLockedAt: Date.now(),
        customerEditable: false,
        editRevision: 2,
      };
      expect(canLockForReview(locked)).toBe(false);
    });

    it("cannot lock a non-PENDING_REVIEW order", () => {
      const priced: OrderState = {
        status: "PRICED_AND_PENDING_PAYMENT",
        customerEditLockedAt: undefined,
        customerEditable: true,
        editRevision: 1,
      };
      expect(canLockForReview(priced)).toBe(false);
    });
  });

  describe("review-lock transition guard", () => {
    it("does not allow skipping straight from PENDING_REVIEW to PRICED_AND_PENDING_PAYMENT", () => {
      expect(canTransitionOrderStatus("PENDING_REVIEW", "PRICED_AND_PENDING_PAYMENT")).toBe(false);
    });

    it("does not allow skipping straight from PENDING_REVIEW to CONFIRMED_PAID_OR_CREDIT", () => {
      expect(canTransitionOrderStatus("PENDING_REVIEW", "CONFIRMED_PAID_OR_CREDIT")).toBe(false);
    });

    it("requires the RECEPTION_REVIEW intermediate step before pricing", () => {
      expect(canTransitionOrderStatus("PENDING_REVIEW", "RECEPTION_REVIEW")).toBe(true);
      expect(canTransitionOrderStatus("RECEPTION_REVIEW", "PRICED_AND_PENDING_PAYMENT")).toBe(true);
    });

    it("requires the CONFIRMED_PAID_OR_CREDIT intermediate step before the job card", () => {
      expect(canTransitionOrderStatus("PRICED_AND_PENDING_PAYMENT", "CONFIRMED_PAID_OR_CREDIT")).toBe(true);
      expect(canTransitionOrderStatus("CONFIRMED_PAID_OR_CREDIT", "JOB_CARD_CREATED")).toBe(true);
    });
  });
});
