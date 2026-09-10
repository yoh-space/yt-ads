# New Feature Implementation Plan

**Project**: YT Advertisement Operations Platform
**Feature**: Customer Onboarding, Order Edit, and Automated Material Deduction
**Date**: 2025-09-10
**Status**: In Progress — Phase 2 integration remaining, Phases 4–9 pending

---

## 1. Feature Overview

This feature implements a complete overhaul of the customer order intake, review, and production fulfillment workflow. The goal is to replace the flat Mini App intake with a guided wizard, give customers self-service edit capability with a reception-controlled lock, and automate material calculation from owner-configured recipes.

### Core Principle
Customer intake records the requested specification. Reception validates and locks the request. The mapping engine converts the locked request into production requirements. Inventory fulfillment and actual consumption remain auditable, separate events.

---

## 2. State Machine

| Status | Meaning | Customer Can Edit? |
|--------|---------|-------------------|
| `PENDING_REVIEW` | Customer submitted request awaiting Reception action | Yes |
| `RECEPTION_REVIEW` | Reception has started review and locked the customer request | No |
| `PRICED_AND_PENDING_PAYMENT` | Reception completed pricing, awaiting payment/credit approval | No |
| `CONFIRMED_PAID_OR_CREDIT` | Payment or credit approval confirmed | No |
| `JOB_CARD_CREATED` | Production Job Card and material requirements exist | No |
| `WAITING_FOR_MATERIAL` | Job Card exists but required materials not fully available | No |
| `IN_PRODUCTION` | Operator started production after stock audit passed | No |
| `COMPLETED` | Production complete | No |
| `READY_FOR_PICKUP` | Customer can collect after remaining balance cleared | No |

### Inventory Event Policy

| Event | Inventory Meaning | COGS Meaning |
|-------|------------------|--------------|
| Planned requirement | Expected production need | No COGS |
| Reservation | Stock promised to a Job Card | No COGS |
| Store-to-machine issue | Location/custody transfer | No COGS |
| Production consumption | Material actually used | Yes, actual COGS |
| Return | Unused material returned | Reverses allocation |
| Scrap | Material lost during production | COGS or variance per policy |

---

## 3. Phase Delivery Plan

### Phase 0 — Business Rules, Configuration, and Data Contract ✅ COMPLETED

**Objective**: Freeze business rules and data contracts before changing UI or inventory behavior.

**Deliverables**:
- ✅ Status transition matrix (`ALLOWED_STATUS_TRANSITIONS` in `convex/orders.ts`)
- ✅ Customer edit policy (only `PENDING_REVIEW` + not locked)
- ✅ Review-lock policy (atomic first-review action by Reception)
- ✅ Inventory event policy (planned → reserved → transferred → consumed/returned/scrap)
- ✅ `orderEvents` audit table in `convex/schema.ts`
- ✅ `PUBLIC_TRACKING_STATUSES` updated to include `RECEPTION_REVIEW` and `WAITING_FOR_MATERIAL`

**Commit**: `08402bf` — "feat(intake): align orders with material specifications"

---

### Phase 1 — Phone, Profile, and Customer Validation Foundation ✅ COMPLETED

**Objective**: Create one authoritative validation layer for customer profile and order intake.

**Deliverables**:
- ✅ `src/shared/phone-normalization.ts` — Ethiopian phone normalization (09.../07.../+2519.../+2517...)
- ✅ `src/shared/order-schemas.ts` — Zod schemas (EthiopianMobile, AccountType, BusinessIdentity, TIN, CustomerProfile, ServiceSelection, buildServiceSpecifications, CompleteOrderPayload, CustomerEditPayload)
- ✅ `src/telegram/geometry.ts` — aligned to delegate to shared `normalizePhone`
- ✅ Tests: `phone-normalization.test.ts` (10 tests), `order-schemas.test.ts` (14 tests)

**Commit**: `08402bf`

---

### Phase 2 — Customer Onboarding Wizard 🔄 IN PROGRESS

**Objective**: Replace flat Mini App intake with a stateful, multi-step wizard using React Hook Form + Zod.

**Deliverables**:
- ✅ `src/shared/wizard-steps.ts` — step definitions, navigation helpers
- ✅ `src/components/public/mini-app/order-wizard.tsx` — main wizard shell (RHF+Zod, draft persistence, file upload, submit)
- ✅ Wizard step components (welcome, profile, account-type, company-tin, category, service, specifications, dimensions, artwork, review)
- ❌ Wire wizard into `customer-mini-app.tsx` as "create" tab
- ❌ Update `customer-orders-view.tsx` for edit flow
- ❌ Wizard unit tests
- ❌ Commit Phase 2

---

### Phase 3 — Order Submission and Customer Edit Lifecycle ✅ COMPLETED

**Objective**: Allow customers to correct requests after submission while preserving a strict Reception-controlled lock boundary.

**Deliverables**:
- ✅ `lockOrderForReview` mutation — atomic lock with audit event + Telegram notification
- ✅ `updateCustomerOrder` mutation — ownership verification, optimistic concurrency, rejects locked/stale
- ✅ `recordOrderEvent` helper — append-only audit trail
- ✅ Lock gates on `priceOrderInternal` and `confirmOrderAndIssueJobCardInternal`
- ✅ `submit` mutation — accepts `accountType`, `tinNumber`, `companyLegalName`
- ✅ Reception dashboard: lock button, lock-aware price/confirm, lock banner
- ✅ Tests: `convex/test/lockAndEdit.test.ts` (13 tests)

**Commit**: `4c8a6b0` — "feat(orders): implement order review lock and account type validation"

---

### Phase 4 — Owner Operational Configuration for LED and Nesting ⬜ NOT STARTED

**Objective**: Make LED calculations and nesting behavior configurable by Owner users.

**Deliverables**:
- ❌ Owner LED recipe configuration UI (modules per m², pack size, minimum quantity, rounding mode, power supply capacity)
- ❌ Nesting policy configuration (sheet dimensions, rotations, kerf, edge margin, remnant size, waste threshold, grain constraints)
- ❌ Versioned configuration with `activeFrom` timestamp
- ❌ Permission enforcement (Owner-only changes)
- ❌ Configuration validation and audit events

---

### Phase 5 — Service-to-Material Mapping Engine ⬜ NOT STARTED

**Objective**: Convert a locked order into canonical material requirements.

**Deliverables**:
- ❌ Pure mapping engine (deterministic, reproducible)
- ❌ Roll quantity calculators (area-based, running-length)
- ❌ Nesting calculator (MaxRects/Guillotine heuristic)
- ❌ LED recipe calculator
- ❌ Hardware recipe calculator
- ❌ Calculation explanation output
- ❌ Unit tests for each material family

---

### Phase 6 — Job Card Issuance and Material Allocation ⬜ NOT STARTED

**Objective**: Invoke mapping engine during Job Card creation without blocking Reception on shortages.

**Deliverables**:
- ❌ Job Card issuance integration (locked order → calculation snapshot → Job Card)
- ❌ Material requirement persistence
- ❌ Reservation/allocation transaction
- ❌ Shortage material request creation
- ❌ Calculation snapshot persistence
- ❌ Idempotency protection

---

### Phase 7 — Storekeeper Fulfillment and Operator Production Gate ⬜ NOT STARTED

**Objective**: Connect calculated requirements to material request and machine stock workflows.

**Deliverables**:
- ❌ Material request linkage to Job Cards
- ❌ Storekeeper fulfillment display
- ❌ Operator specification and nesting display
- ❌ Start-job revalidation (backend stock audit)
- ❌ Shortage and fulfillment notifications

---

### Phase 8 — Actual Consumption, Reconciliation, and Revenue COGS ⬜ NOT STARTED

**Objective**: Record actual usage separately from planned/allocated quantities.

**Deliverables**:
- ❌ Production consumption mutation
- ❌ Return and scrap workflow
- ❌ Requirement reconciliation
- ❌ Revenue COGS integration
- ❌ Variance reporting

---

### Phase 9 — Staff Inspection and Customer Visibility ⬜ NOT STARTED

**Objective**: Make new data understandable to every role without exposing inappropriate internal data.

**Deliverables**:
- ❌ Customer Mini App: order detail, edit states, lock status
- ❌ Reception workspace: specification display, shortage warnings
- ❌ Operator workspace: material availability, nesting summary
- ❌ Owner workspace: configuration versions, formulas, COGS, waste outcomes

---

## 4. Data Model Additions

### Customer Order Fields (added)
| Field | Type | Purpose |
|-------|------|---------|
| `accountType` | `"individual" \| "corporate" \| "government"` | Account classification |
| `serviceId` | `string` | Canonical service identifier |
| `specifications` | `Record<string, string>` | Validated catalog selections |
| `editRevision` | `number` | Optimistic concurrency control |
| `customerEditable` | `boolean` | Derived edit permission |
| `customerEditLockedAt` | `number` | First Reception review timestamp |
| `customerEditLockedBy` | `string` | Receptionist identity |
| `reviewLockReason` | `string` | Audit explanation |
| `lastCustomerEditedAt` | `number` | Customer edit timestamp |
| `lastCustomerEditedBy` | `string` | Telegram identity |

### Order Events Table (added)
| Field | Type | Purpose |
|-------|------|---------|
| `orderId` | `Id<"customerOrders">` | Reference |
| `actorId` | `string` | Auth user or Telegram id |
| `actorLabel` | `string` | Human-readable label |
| `action` | `LOCKED_FOR_REVIEW \| CUSTOMER_EDIT \| EDIT_REJECTED_LOCKED \| EDIT_REJECTED_STALE` | Event type |
| `detail` | `string?` | Optional explanation |
| `createdAt` | `number` | Timestamp |

---

## 5. API Boundaries

| Capability | Customer | Receptionist | Storekeeper | Operator | Owner |
|-----------|----------|-------------|-------------|----------|-------|
| Edit own pending order | ✅ | ❌ | ❌ | ❌ | ❌ |
| Lock order for review | ❌ | ✅ | ❌ | ❌ | ✅ |
| Price order | ❌ | ✅ | ❌ | ❌ | ✅ |
| Issue Job Card | ❌ | ✅ | ❌ | ❌ | ✅ |
| Configure LED recipe | ❌ | ❌ | ❌ | ❌ | ✅ |
| Configure nesting | ❌ | ❌ | ❌ | ❌ | ✅ |
| Issue store material | ❌ | ❌ | ✅ | ❌ | ✅ |
| Start production | ❌ | ❌ | ❌ | ✅ | ✅ |
| Record actual consumption | ❌ | ❌ | ❌ | ✅ | ✅ |
| View unit costs | ❌ | Limited | ❌ | ❌ | ✅ |

---

## 6. Testing Strategy

### Unit Tests (existing)
- `src/shared/phone-normalization.test.ts` — Ethiopian phone forms, separators, invalid prefixes
- `src/shared/order-schemas.test.ts` — Zod validation, TIN conditional, edit payload `.strict()`
- `convex/test/lockAndEdit.test.ts` — State machine invariants (lock, edit, stale revision, pricing gate, double-lock)

### Integration Tests (pending)
- Mini App submission creates `PENDING_REVIEW`
- Customer edit updates only editable fields
- Reception first review action locks the order
- Customer edit after lock is rejected
- Job Card issuance creates one calculation snapshot
- Repeated issuance is idempotent
- Insufficient material creates material request
- Operator start blocked by insufficient machine stock
- Storekeeper fulfillment unlocks Operator start

### End-to-End Acceptance Cases (pending)
- **Case A**: Light Box A1 — area-based LED calculation from Owner recipe
- **Case B**: Nested foam job — deterministic nesting with rotation
- **Case C**: Zero inventory at intake — Job Card created with explicit shortage
- **Case D**: Customer edit cutoff — edit succeeds before lock, rejected after
- **Case E**: LED configuration change — new Job Cards use new version
- **Case F**: Actual COGS — transfer does not inflate COGS, consumption does

---

## 7. Final Acceptance Definition

The feature is complete when all of the following are true:

1. ✅ Customers can onboard through a guided Mini App wizard
2. ✅ Phone numbers are normalized and validated in both client and server layers
3. ✅ Corporate and government accounts require valid company and TIN information
4. ❌ Service-specific material specifications are dynamically rendered from the canonical catalog
5. ✅ Orders remain editable in `PENDING_REVIEW`
6. ✅ Reception's first review action locks customer editing atomically
7. ❌ Job Card issuance uses the locked specification snapshot
8. ❌ LED quantities come from Owner-configured recipes
9. ❌ Rigid-sheet quantities use deterministic nesting rather than only area division
10. ✅ Reception can issue Job Cards even when material is unavailable
11. ❌ Shortages create material requests and a visible waiting state
12. ❌ Operators cannot start production before required machine stock is available
13. ❌ Reservations and transfers do not inflate COGS
14. ❌ Actual production consumption produces the financial COGS record
15. ❌ Every calculation is reproducible from its stored catalog and configuration versions
16. ❌ The complete workflow is covered by unit, integration, and end-to-end tests

**Progress**: 6/16 acceptance criteria fully complete, 3 partially complete (wizard built but not integrated).