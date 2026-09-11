# Operator Material Requests and Clean History Remediation

## Implementation Plan

**Repository:** `yoh-space/yt-ads`  
**Latest pulled branch:** `main` at `9e64fb6`  
**Scope:** Allow machine operators to request raw materials when they have never received stock, repair the machine-request failure path, and provide a trustworthy request and custody history.  
**Implementation status:** Planning only. No application source files were changed for this plan.

---

## 1. Executive Summary

The current operator material-request workflow is split across a machine-scoped request API, a shared material-request mutation, floor-stock custody, job material requirements, and multiple UI projections. The reported error is shown only as a generic Convex mutation failure, so the browser does not reveal which server guard rejected request `29c3b5cc24ac2911`.

The request flow should be redesigned around three separate concepts:

1. **Request eligibility:** Whether an operator is allowed to ask for material for a specific job on a specific machine.
2. **Custody-cycle eligibility:** Whether the operator has unresolved stock that must be reconciled before a new issue.
3. **Request history:** A durable append-only record of requests, issues, acknowledgements, shortages, discrepancies, and cancellations.

The current system combines these concepts too aggressively. A request can be rejected by a blanket “uncleared batch exists” check even when the operator has no usable material, the batch is zero, the batch belongs to a prior job, or the batch has already been operationally closed but lacks clearance. The UI also lists every active material rather than only the materials allowed by the selected Job Card, so it can submit a payload that the backend correctly rejects.

The recommended target behavior is:

- An operator with **no previous issued stock** can submit a material request for an active Job Card.
- The first request is validated against the Job Card’s immutable material requirements and the machine scope.
- A prior stock cycle blocks a new issue only when it has a genuine unresolved custody balance or an unresolved reconciliation exception.
- Zero remaining stock is not treated as usable stock.
- A fully consumed batch can be closed through an explicit lifecycle transition without requiring a physical-count workflow that does not apply.
- Requests remain historically auditable but operational screens show only relevant open and recent records.
- Errors return stable, user-readable codes and context instead of only generic server errors.
- Machine, operator, material, and Job Card identities are resolved by stable IDs, not URL text or display names.

> **Core rule:** A missing previous issue must be a valid starting state, not an error. A new request should be blocked only by a clearly defined unresolved custody or safety condition.

---

# 2. Current Request Flow and Failure Points

## 2.1 Current call chain

The operator page calls:

```text
operator/[machine]/requests/page.tsx
  → api.operator.requests.create
  → resolveOperatorMachine
  → createMaterialRequestInternal
  → materialRequests and materialRequestLines inserts
```

The operator overview page also calls the same machine-scoped mutation from the material request modal.

The mutation accepts:

- `machineSlug`
- `jobCardId`
- `materialId`
- `requestedQuantity`
- `unit`
- `requestedPackages`
- Optional package unit, lines, and note

## 2.2 Server guards that can reject a request

The shared mutation currently applies the following checks:

| Guard | Current behavior | Risk or failure mode |
|---|---|---|
| Operator role | Caller must be one of four operator roles. | Correct in principle, but role duplication can create mismatch. |
| Quantity | Quantity must be finite and greater than zero. | UI normally satisfies this. |
| Uncleared stock | Any `ACTIVE` or `PENDING_CLEARANCE` operator stock batch blocks all new requests. | Blocks first request only if stale or incorrectly assigned stock exists; also blocks after stock is fully consumed until clearance. |
| Job existence | Job must exist and not be `Completed`. | Correct, but does not distinguish queued versus production-ready states. |
| Material existence | Material must be active. | Correct. |
| Machine scope | Job machine must equal resolved machine. | Correct, but machine URL matching is text-based. |
| Operator role | Machine role must equal caller role. | Correct, but can reject after a machine-role configuration change. |
| Material allowance | Requested materials must equal `job.materialId` or a `jobMaterialRequirements` material. | Correct, but the UI lists all materials and lets the operator choose invalid ones. |
| Reconciliation shortage | Each line must pass `requireNoUnresolvedShortage`. | Can block otherwise valid requests when a prior shortage is unrelated to the current request or material state. |
| Unit | Line unit must equal the current material base unit. | Duplicate/legacy catalog records can cause conversion mismatches. |
| Package quantity | Requested packages must be finite and positive. | UI uses package conversion but does not clearly display the server’s authoritative conversion. |

The reported browser log does not expose the actual thrown message. The first implementation task must add structured error codes and capture the server message in the client toast and audit log.

## 2.3 Why the “no material issued before” case can still fail

The intended first-request case should pass the uncleared-stock check when there are no `operatorSubStock` rows for the operator. It can still fail if any of the following is true:

1. A stale `operatorSubStock` row exists for the operator from a prior machine or test seed.
2. A batch has `ACTIVE` status with `currentRemaining = 0`, which the current guard still treats as blocking.
3. A `PENDING_CLEARANCE` batch belongs to a different machine or old job but is indexed only by operator.
4. The selected material is not in the Job Card’s primary material or BOM requirement list.
5. The selected material’s current base unit differs from the modal’s submitted unit.
6. The Job Card is not visible to the machine-scoped query or has been assigned to another machine.
7. The URL machine slug resolves to a different machine than the Job Card’s `machineId`.
8. The caller’s profile role or assigned-machine scope does not match the database machine record.
9. The Job Card has no active requirements and the UI default material came from the global material list rather than the Job Card.
10. An unresolved shortage flag blocks the material even though no physical material has previously been issued to this operator.

The diagnostic work must identify which condition applies to request `29c3b5cc24ac2911` before any data cleanup is performed.

---

# 3. Target Domain Model

## 3.1 Request eligibility

Create a single server-side function that returns a structured eligibility result before a request is submitted:

```text
getMaterialRequestEligibility(machineId, jobCardId)
```

The result should include:

| Field | Purpose |
|---|---|
| `eligible` | Whether the request can be submitted. |
| `machine` | Stable machine ID, code, name, and operator role. |
| `job` | Job Card ID, code, status, and current machine. |
| `allowedMaterials` | Only the primary material and active BOM requirement materials. |
| `requiredQuantities` | Planned, approved scrap, and remaining quantities per material. |
| `priorCustodyState` | None, usable stock, zero-balance closeable, pending reconciliation, or shortage. |
| `blockingReasons` | Stable codes and user-readable messages. |
| `warnings` | Non-blocking information such as an existing zero-balance batch. |
| `conversionSnapshots` | Server-authoritative package-to-base-unit conversions. |

The UI should use this result to disable invalid choices before submission. The mutation must repeat the same validation because the client is not trusted.

## 3.2 Custody-cycle state machine

The current `operatorSubStock.status` values are insufficient for cleanly distinguishing usable stock from historical closure. Define explicit lifecycle semantics:

| State | Meaning | Can request new issue? |
|---|---|---:|
| `ACTIVE` | Stock is currently in operator custody and has usable remaining quantity. | No for the same material/cycle; policy-defined for unrelated material. |
| `DEPLETED` | System balance is zero and consumption is fully accounted. | Yes after automatic closure. |
| `PENDING_CLEARANCE` | Physical reconciliation is required before closure. | No until approved. |
| `CLEARED` | Owner approved the reconciliation and closed the cycle. | Yes. |
| `DISCREPANCY` | A variance or shortage requires resolution. | No for the affected custody scope. |
| `VOIDED` | Administrative correction invalidated the batch without deleting history. | Yes. |

If schema compatibility makes a new enum expensive, retain the current statuses but add derived fields and explicit lifecycle events. A new status is preferable because an `ACTIVE` row with zero remaining quantity is semantically ambiguous.

## 3.3 Scope of a blocking custody cycle

The current guard blocks based on all batches belonging to the operator. The target scope should be explicit:

- **Default recommendation:** block only unresolved custody for the same machine and operator.
- **Material-family restriction:** if the organization requires one global custody cycle per operator, make that a configuration policy and show it clearly.
- **Do not block on unrelated historical batches.**

The check must consider:

```text
operatorId + machineId + materialId + unresolved lifecycle state
```

A prior batch on another machine must not silently prevent a request on the operator’s current assigned machine unless Owner policy explicitly requires global custody locking.

## 3.4 First-request semantics

When no qualifying `operatorSubStock` batch exists:

1. The operator selects an active Job Card.
2. The server returns allowed material requirements.
3. The operator selects one or more allowed materials.
4. The server validates requested quantities against the requirement and package conversion.
5. The system creates one request group and line records.
6. The storekeeper receives a notification.
7. The operator sees the request in `Requested` status.

No historical batch is required before creating a request. The request itself becomes the beginning of the custody chain only after the Storekeeper issues material.

---

# 4. Clean History Design

## 4.1 History principles

“Clean history” should not mean deleting records. Material requests affect inventory custody, audit, and financial reconciliation. Deleting them would make it impossible to explain stock movements.

The target is a **clean operational view over an append-only audit history**:

- Historical records remain immutable after creation except for controlled lifecycle fields.
- Operational screens show open requests, current job requests, and a configurable recent period.
- Closed requests are archived from the default view.
- Administrative users can search the complete history.
- Corrections use reversal or void events rather than destructive deletion.

## 4.2 Request lifecycle

Use a consistent request lifecycle:

```text
REQUESTED
→ PARTIALLY_ISSUED
→ ISSUED
→ RECEIVED
→ CLOSED
```

Exception states should be:

```text
SHORT_STOCK
DISCREPANCY
CANCELLED
VOIDED
```

The current system uses `Requested`, `Partially Issued`, `Issued`, `Received`, `Short Stock`, and `Discrepancy`, but it lacks an explicit `Closed` or `Cancelled` state. This causes historical requests to remain operationally visible even after their business purpose is complete.

## 4.3 Request event history

Add an append-only request event table or equivalent event records containing:

| Field | Purpose |
|---|---|
| `requestId` | Parent request. |
| `requestGroupId` | Multi-line request group. |
| `eventType` | Created, issued, acknowledged, shortage, discrepancy, cancelled, closed, voided. |
| `fromStatus` | Previous state. |
| `toStatus` | New state. |
| `quantity` | Event quantity where applicable. |
| `packageQuantity` | Physical package quantity where applicable. |
| `actorId` | Staff member responsible. |
| `machineId` | Machine scope snapshot. |
| `jobCardId` | Job context. |
| `reason` | Required for exception or correction events. |
| `createdAt` | Immutable timestamp. |

This creates a clean timeline without relying on overwritten fields such as `issuedBy`, `receivedBy`, or `note`.

## 4.4 Operational history views

Provide three views:

| View | Default contents |
|---|---|
| Open requests | Requested, Partially Issued, and unresolved exceptions. |
| Current machine | Requests for the current machine and active/queued Job Cards. |
| History | Closed, Received, Cancelled, and older requests with filters. |

The operator page should show current open requests and recent requests for the current machine. It should not show every historical request by default.

The Storekeeper page should show open requests across machines, grouped by request group. Owner and Manager views should include full audit search.

## 4.5 Data cleanup migration

Add an idempotent migration that:

1. Detects requests with missing or invalid parent Job Cards.
2. Detects requests with missing or inactive materials.
3. Detects requests whose machine differs from the Job Card machine.
4. Detects duplicate request lines in the same group.
5. Detects completed requests still shown as open.
6. Detects `ACTIVE` zero-balance stock batches.
7. Detects batches whose operator and machine scope no longer match.
8. Marks invalid historical records as `VOIDED` or `DISCREPANCY` with a reason.
9. Converts fully consumed, fully accounted batches into `DEPLETED` or equivalent.
10. Does not delete records or alter inventory quantities without an explicit audited correction.

The migration must produce a report before applying changes. The report should include counts by issue type and affected IDs.

---

# 5. Machine Association Remediation

## 5.1 Stable machine identity

The latest code has introduced `src/shared/production-manifest.ts`, but database and UI workflows still resolve operator machines through URL slugs. `resolveMachineForRole` matches a slug against machine `code` or `type` using `includes`.

This is fragile because:

- A type can match multiple machines.
- Display names can change.
- Owner names and catalog names can differ.
- A partial slug can resolve to an unintended machine.

The target URL should carry a stable machine ID or canonical machine code. The server should resolve exact identity first:

```text
machineId → exact database machine record
machineCode → exact canonical code
legacy slug → temporary compatibility resolver with ambiguity rejection
```

If a legacy slug matches more than one machine, fail with `AMBIGUOUS_MACHINE_SCOPE` instead of selecting the first match.

## 5.2 Operator assignment validation

At request time, validate all of the following together:

1. The caller is an active operator.
2. The caller’s role is allowed for the machine.
3. The caller’s assigned-machine scope includes the machine when explicit scope exists.
4. The Job Card machine equals the selected machine.
5. The Job Card service and route are compatible with the machine.
6. The material request lines belong to the Job Card’s BOM or primary material.

Return a single structured scope result so each handler does not reimplement partial checks.

## 5.3 Machine-scoped request indexes

The current `materialRequests` table has indexes by Job Card and status, but not a direct machine index. The machine is optional on the request even though the Job Card provides the machine association.

Add a denormalized `machineId` snapshot to every new request and index it:

```text
by_machine_status: [machineId, status]
by_machine_requested_at: [machineId, requestedAt]
```

Keep the Job Card relation as the source of truth and use the request machine snapshot for scoped history and audit. A migration should backfill the snapshot from each request’s Job Card where possible.

## 5.4 Request group identity

The current group ID is generated as:

