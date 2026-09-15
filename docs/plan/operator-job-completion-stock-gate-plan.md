# Operator Job Completion Stock-Gate Implementation Plan

## Executive Summary

Machine operators can currently complete a job card when their machine-level operator stock is empty because the completion path uses a shared deduction engine that falls back to parent inventory. The start-production mutation performs an operator-stock availability audit, but the completion mutation does not repeat that gate. As a result, completion can succeed without material being issued to the operator’s machine.

The fix should make the operator completion mutation enforce the same machine-scoped stock requirement before any completion-side writes occur. Completion must fail atomically when the required raw materials are not available in the operator’s assigned stock. Central inventory must not be consumed automatically as a substitute for missing operator stock in the operator completion workflow.

The plan preserves the existing storekeeper transfer workflow, audit ledger, BOM calculation, and administrative inventory operations. It changes only the operator production lifecycle so that a machine operator must receive the required materials before completing the job.

## Current Behavior

The operator start mutation in `convex/operator/jobs.ts` calls `auditJobMaterialAvailability`. That audit calculates each job requirement and compares it with active operator sub-stock associated with the machine and operator scope. If any requirement is short, production start is rejected with an insufficient-stock message.

The operator completion mutation in the same module verifies operator identity and machine assignment, then calls `completeJobInternal` in `convex/jobs.ts`. The shared completion transaction calls `deductJobRequirements` in `convex/jobConsumption.ts`.

The current deduction engine follows this sequence:

1. It calculates the remaining quantity for every open job-material requirement.
2. It deducts as much as possible from active operator sub-stock.
3. It deducts the remaining quantity directly from parent inventory.
4. It marks the requirement and job as completed.

This fallback is the reason an operator can complete a job without having the material on the machine. The inventory ledger correctly rejects the transaction when total material quantity is insufficient, but it does not enforce the distinct business rule that operator completion requires material to have been issued to the machine first.

## Target Invariants

| Invariant | Required behavior |
|---|---|
| Machine scope | An operator may complete only a job assigned to the operator’s resolved machine. |
| Status scope | An operator may complete only a job currently in `In production` status, with an explicit policy decision for paused jobs. |
| Operator-stock gate | Before completion, every non-exempt BOM material must have sufficient active operator sub-stock for that machine. |
| No parent fallback | The operator completion path must not consume parent inventory to cover a floor-stock shortage. |
| Atomicity | If any required material is short, no job status, requirement status, stock balance, reservation, machine status, or notification may be changed. |
| Solvent handling | Materials excluded from automatic consumption, such as solvents, must retain the current exemption behavior. |
| Idempotency | A completed job must remain safely idempotent and must not be deducted twice. |
| Administrative operations | Owner, manager, storekeeper, and approved administrative inventory workflows must retain their existing permissions and behavior unless explicitly routed through operator completion. |

## Recommended Implementation

### 1. Add a strict completion availability audit

Reuse `auditJobMaterialAvailability` from `convex/operator/jobs.ts` as the authoritative precondition for the operator completion mutation. The audit should cover the same BOM requirements used by completion, including planned quantity and approved scrap quantity, while excluding materials that the deduction engine intentionally excludes from automatic consumption.

The audit should return a structured shortage list containing the material identifier, material name, required quantity, available operator quantity, and unit. The error should identify every shortage rather than only the first missing item. This will let the operator request all missing materials in one storekeeper workflow.

The audit must use the same material-unit normalization and machine/operator scope as operator start. It must not query parent inventory to satisfy the operator-stock check.

### 2. Gate `operator.jobs.complete` before calling the shared completion transaction

In `convex/operator/jobs.ts`, update the `complete` mutation to perform these checks in order:

1. Resolve the authenticated operator, active profile, and assigned machine.
2. Load the job and verify that the job belongs to the resolved machine.
3. Reject an already completed job using the existing idempotent behavior.
4. Require the job to be in `In production` status. If paused-job completion is intentionally supported, define and test that exception explicitly rather than allowing every non-completed status.
5. Run the strict operator-stock audit.
6. Reject with a clear material-request instruction when shortages exist.
7. Call the shared completion transaction only after the audit succeeds.

The check must happen inside the Convex mutation before any completion writes. The shared completion transaction should remain responsible for the final deduction and status updates.

### 3. Prevent a race between audit and deduction

The preflight audit and deduction are executed within one Convex mutation, but the implementation must still account for concurrent deductions. The final deduction operation should revalidate the relevant operator sub-stock quantities or use an atomic shortage check immediately before writing movements.

The preferred design is to add a strict mode to `deductJobRequirements`, for example `requireOperatorStock: true`, for the operator completion path. In strict mode, the helper should first calculate all available operator stock and throw if any requirement is short. It should then deduct only from operator sub-stock and never enter the parent-inventory fallback branch.

The existing default mode may continue supporting parent-inventory fallback for workflows that explicitly require it. The operator completion mutation must always use strict mode.

### 4. Preserve central inventory for storekeeper transfers

The fix must not make parent inventory unavailable. Storekeepers must still be able to issue raw materials from central inventory to operator sub-stock through the existing material-request and transfer workflow.

A successful transfer should increase the operator sub-stock balance associated with the correct machine and material. After the transfer, the operator detail page should show the job as stock-ready, and completion should pass the strict gate.

### 5. Align the operator UI with the backend rule

The operator job detail UI already displays the stock audit and exposes a material request action. Update the UI so that the completion button is disabled when `stockAudit.sufficient` is false, while retaining the backend rejection as the authoritative control.

The disabled state should include a short explanation such as “Request required materials before completing this job.” The UI must refresh the job detail and stock audit after a material request or stock transfer so the completion action becomes available without a full page reload.

The UI should not imply that a job is complete merely because the completion request was submitted. It should display success only after the strict mutation returns successfully.

### 6. Add auditability and operational messaging

When completion is rejected for missing operator stock, record the failed attempt if the project’s existing audit conventions support rejected workflow events. The event should include the job card, machine, operator, and shortage summary without creating an inventory movement.

The operator-facing error should explain that the material must be requested from the storekeeper before completion. The storekeeper and owner notification flows should remain unchanged unless an existing material-request notification is missing the job context.

## Files to Review or Change

| Area | File | Planned action |
|---|---|---|
| Operator completion authorization | `convex/operator/jobs.ts` | Add strict stock and status gates before `completeJobInternal`. |
| Shared completion engine | `convex/jobs.ts` | Pass strict operator-stock mode into the deduction helper if required by the chosen design. |
| Deduction engine | `convex/jobConsumption.ts` | Add strict operator-only deduction mode that rejects shortages and disables parent fallback. |
| Inventory ledger | `convex/inventoryLedger.ts` | Confirm operator sub-stock deductions remain atomic and preserve shortage validation. Change only if required for the strict mode. |
| Operator job detail UI | `src/app/(dashboard)/dashboard/operator/[machine]/job/[id]/page.tsx` or the current job-detail component | Disable completion while stock is insufficient and show the request-material explanation. |
| Operator material request flow | `convex/operator/requests.ts` and related UI | Verify that transfers can satisfy the same material/unit requirements used by completion. |
| Tests | `convex/test/` and operator UI tests | Add regression coverage for empty floor stock, partial stock, successful transfer, and central-stock fallback rejection. |

## Test Plan

### Backend unit and integration tests

The following cases must be added or updated:

| Test case | Expected result |
|---|---|
| Operator completes with zero operator stock and sufficient parent stock | Completion is rejected; parent stock is unchanged; job remains `In production`. |
| Operator completes with partial operator stock and sufficient parent stock | Completion is rejected; no partial deduction occurs; job remains `In production`. |
| Operator completes after storekeeper issues the full required quantity | Completion succeeds; operator sub-stock is deducted; job becomes `Completed`; machine becomes available. |
| Operator completes with multiple BOM materials and one shortage | Completion is rejected atomically; no requirement is marked completed and no material movement is written. |
| Operator completes a paused job | Result follows the explicit status policy; no implicit bypass is allowed. |
| Operator completes a job assigned to another machine | Completion is rejected. |
| Non-operator administrative workflow uses central fallback where explicitly supported | Existing behavior remains unchanged. |
| Completed job is submitted again | Mutation remains idempotent and does not create duplicate deductions. |
| Solvent or exempt material is present | Existing exemption remains intact and does not create a false shortage. |
| Concurrent stock usage makes the quantity insufficient after the preflight audit | Strict deduction rejects the transaction without partial completion writes. |

### Verification commands

Run the repository’s standard checks after implementation:

```bash
pnpm check
pnpm test
NODE_ENV=production pnpm build
```

Inspect the final diff with `git diff --check` and verify that no generated files or unrelated configuration changes are included.

## Rollout and Acceptance Criteria

The implementation is complete when an operator cannot complete a job unless the required non-exempt materials are present in the operator stock associated with that machine. A central warehouse balance alone must not satisfy the operator completion gate.

The implementation is also complete when a storekeeper transfer makes the job eligible, the completion transaction deducts the issued operator stock exactly once, and all status, inventory, reservation, machine, and notification updates remain consistent.

The backend mutation must enforce the rule independently of the UI. The UI should make the rule visible and guide the operator toward a material request, but hiding or disabling the button must not be the only protection.

## References

[1]: ../../convex/operator/jobs.ts "Machine-scoped operator job mutations and stock audit"
[2]: ../../convex/jobConsumption.ts "Shared job-material deduction engine"
[3]: ../../convex/jobs.ts "Shared job completion transaction"
[4]: ../../convex/inventoryLedger.ts "Authoritative inventory event and balance projection logic"
[5]: ../../convex/operator/requests.ts "Operator material request workflow"
[6]: ../../convex/test/operatorStockGate.test.ts "Existing operator stock-gate tests"
[7]: ../../convex/test/materialRequests.test.ts "Existing material request and transfer tests"

**Author:** Manus AI

**Status:** Proposed implementation plan

**Date:** 2026-09-15
