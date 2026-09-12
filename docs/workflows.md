# Operational Workflows & Dual-Layer Reconciliation

> **Scope.** End-to-end operational procedures as they actually run on the platform today: the customer order journey (Telegram Mini App and walk-in alike), the 24-hour unpaid-order expiry guard, the parent's-vs-floor's dual-layer inventory with the clearance handoff, and the customer-facing Telegram notification pipeline that is strictly gated to receptionist confirmation.

## 1. Customer order journey

The customer-facing order path is built around five immutable states. The status union itself is defined in `convex/schema.ts:38`; the canonical lifecycle in code is enforced by `ALLOWED_STATUS_TRANSITIONS` in `convex/orders.ts:18`.

```
        (customer submits)
             │
             ▼
   ┌─────────────────────┐
   │   PENDING_REVIEW    │  ◀── created by publicCreate / createTelegramOrder / createWalkIn
   └─────────┬───────────┘
             │  receptionist prices via priceOrder
             ▼
   ┌───────────────────────────────────┐
   │  PRICED_AND_PENDING_PAYMENT        │  ◀── owner has priced the order; awaits
   └─────────┬─────────────────────────┘        payment verification
             │  receptionist verifies payment
             ▼  (or credit) via confirmOrderAndIssueJobCard
   ┌─────────────────────────────────────────┐
   │  JOB_CARD_CREATED  →  IN_PRODUCTION      │  ◀── customer gets ACCEPTED push
   └─────────────────────────────────────────┘        (strictly after receptionist
             │                                  confirmation, never on submit)
             ▼  operator logs production
   ┌─────────────────────────────────────────┐
   │       COMPLETED  →  READY_FOR_PICKUP     │
   └─────────────────────────────────────────┘
```

### 1.1 The first state — `PENDING_REVIEW`

Submission can come from three surfaces, all of which arrive in the same PENDING_REVIEW cell:

| Surface | Public mutation | Touches a Telegram-bound customer? |
| --- | --- | --- |
| **Telegram Mini App** (the home route `/`) | `api.orders.submit` (`publicCreate` action wrapper that internally calls the same path as `createTelegramOrder`) | Yes — verified via `verifyTelegramInitData` |
| **Telegram bot, text-first** | `createTelegramOrder` (`convex/orders.ts:777`) called from `bot.ts` `createOrder(ctx, draft)` after the conversational order draft is complete | Yes |
| **Walk-in (reception desk)** | `createWalkIn` (`convex/orders.ts:222`) | Only if a Telegram chat id is recorded for this customer (optional) |

What all three mutations do *together*:

- Validate clientName, phone, dimensions, and that the order's `preferredDueDate` is in the future.
- Cross-check the chosen service against `serviceType` (matches `src/constants/services.ts`).
- Verify the Telegram identity when supplied (`verifyTelegramInitData`, `convex/telegramAuth.ts`).
- Stamp `status: PENDING_REVIEW`, `source ∈ {public_portal, walk_in}`, and an `expiresAt` derived from `systemConfigs.orderExpirationHours` (default 12h).
- **Notify the receptionist Telegram group** with a single inline-keyboard alert (Accept / Reject / Verify payment) — *see §4.2*.
- **Do not push anything to the customer.** Customer-facing success messages are deliberately temporary (the bot's reply is "📌 your order is pending verification until reception confirms your payment") and the Mini App's confirmation screen says the same. This is the single most important contract: **the customer never receives an "order accepted" push at submit time.** That gate is enforced in `convex/orders.ts`'s `pushCustomerOrderStatus` helper — see §4.

The Mini App's own `submit` flow (`src/components/public/telegram-mini-app-order.tsx:108`) reads the verified phone from the bot's deep-link (preferred) or from `api.users.getByTelegramId` (fallback), then submits with `api.orders.submit`.

### 1.2 Reception step 1 — `PRICED_AND_PENDING_PAYMENT`

Reception (Owner / Manager / Admin / Receptionist) calls `api.orders.priceOrder` (`convex/orders.ts:513`) with the agreed final total. Convex:

- Requires `order.manage`.
- Confirms the order is currently in `PENDING_REVIEW` or `PRICED_AND_PENDING_PAYMENT`.
- Patches `amount` (rounded to 2 dp) and `status`.
- Pushes the centralised `pushCustomerOrderStatus` helper, which schedules a `sendTelegramNotificationInternal` only if the customer has a `telegramChatId` and the status transition is into the gated `CUSTOMER_PUSH_STATUSES` set (`PRICED_AND_PENDING_PAYMENT | JOB_CARD_CREATED | IN_PRODUCTION | COMPLETED`). The Telegram message uses the bilingual customer copy (`customerOrderPriced` / `customerOrderAccepted` in `src/telegram/i18n.ts`) and the `/track` URL is appended so the customer can follow the order.

### 1.3 Reception step 2 — `JOB_CARD_CREATED` (or earlier)

Reception calls `api.orders.confirmOrderAndIssueJobCard` (`convex/orders.ts:545`). This is the **single payment-gated entry point** to production.

The handler:

- Requires `order.manage`.
- Confirms the order is currently in `PENDING_REVIEW` or `PRICED_AND_PENDING_PAYMENT` and has no job card yet.
- Confirms the chosen machine is active and not in `Maintenance` / `Unavailable` and that the material has enough base-unit stock (`material.quantity >= args.quantity`).
- Creates a `jobCards` row with a stable `code` (e.g. `JC-0421`), sets the machine's `status = Running` if it wasn't already, and patches the order to:
  - `status: "JOB_CARD_CREATED"`
  - `paymentStatus: args.paymentDecision` (`PAID` or `APPROVED_CREDIT`)
  - `paymentConfirmedAt`, `paymentConfirmedBy`
  - `machineId`, `jobCardId`.
- Notifies the assigned operator's role plus Owner/Manager/Admin that a paid order has been queued.
- Calls `pushCustomerOrderStatus` (the same helper used everywhere) which posts the **"✅ your order was confirmed by reception!"** Telegram message to the customer. This is the **first** customer-facing acknowledgment push.

The whole class of customer notifications is centralised in `pushCustomerOrderStatus` (`convex/orders.ts:110`). It accepts a hint `(order, previousStatus)` and:

- Fires only when the order has a `telegramChatId`,
- Fires only when the new status is in `CUSTOMER_PUSH_STATUSES = {PRICED_AND_PENDING_PAYMENT, JOB_CARD_CREATED, IN_PRODUCTION, COMPLETED}`,
- Skips if the status didn't actually change,
- Otherwise schedules a `sendTelegramNotificationInternal` call with a custom Amharic/English message that varies by status.

> Because every code path that advances an order's status (`priceOrder`, `confirmOrderAndIssueJobCard`, `setStatus`, the scheduled expiration path) routes through this helper, the customer-facing channel **cannot** fire prematurely.

### 1.4 Operator pickup — `IN_PRODUCTION`

Operator activity is mostly driven by `recordProduction`. The order surface advances via two paths:

- The receptionist calls `setStatus(orderId, "IN_PRODUCTION")` (`convex/orders.ts:458`) after the operator indicates they have begun work. The helper routes the customer notification through `pushCustomerOrderStatus` → *"🖨️ production started"*.
- Or the operator board's "Start job" action updates `jobCards.status = "In production"` (`convex/jobs.ts`) and the job's `machineId` map is refreshed automatically via the dashboard's reactive queries.

### 1.5 Completion — `COMPLETED`, `READY_FOR_PICKUP`

Production staff closes the job card through `recordProduction` (which calls the helper for the last consumption event) and then `setStatus(orderId, "COMPLETED")` triggers a final *"🎉 your order is complete!"* push. `READY_FOR_PICKUP` is the post-completion flag for *customer pickup*; transition is also gated through `setStatus` and surfaces the same notification helper — but only for completeness; in practice the COMPLETED push is sufficient.

### 1.6 24-hour unpaid-order expiry (the cron guard)

Unconfirmed orders that age past their `expiresAt` are transitioned to `Expired` by the hourly cron `expireOrdersInternal` (`convex/crons.ts:7`). The internal mutation:

1. Collects all `customerOrders` with `status ∈ {PENDING_REVIEW, PRICED_AND_PENDING_PAYMENT}` and `expiresAt < now`.
2. Patches each to `{status: "Expired", updatedAt: now, archiveReason: "expired_before_payment"}`.
3. Pushes a Telegram message to the customer's `telegramChatId` (when set) telling them the order timed out and they should reorder.

This prevents stale PENDING orders from blocking the queue — and it's what powers the **24-hour unpaid-order expiration cron guard** the owner wants.

### 1.7 Where the customer journey touches Telegram

The Mini App and the bot share the same `telegramChatId` linkage on `customerOrders`. After the receptionist confirms the order, the customer can:

- Reply to the bot with `/myorders` (`src/telegram/bot.ts:260`) — `listByTelegramChat` returns the order list.
- Reply with an order code (`/status` flow) to fetch live progress.
- Open `/track` (public, no auth) to see the same fields.

## 2. Order-notification pipeline (the gateway pattern)

The notifications pipeline is the canonical example of **centralised gating**. Every order status transition that the customer should see is funnelled through `pushCustomerOrderStatus` and only that function is allowed to push to the customer. Every status transition that management should see is funnelled through `notifyOrderRoles`, which targets `["owner", "manager", "admin"]` (`convex/orders.ts:110`).

The split between the two channels is structural:

| Channel | Entry point | Gate |
| --- | --- | --- |
| **Customer** (`sendTelegramNotificationInternal`) | `pushCustomerOrderStatus(ctx, order, previousStatus)` (`convex/orders.ts:110`) | Only fires when `order.telegramChatId` is set, when `previousStatus !== order.status`, and when `order.status ∈ CUSTOMER_PUSH_STATUSES`. |
| **Management** (`notifications` table) | `notifyOrderRoles(ctx, payload)` (`convex/orders.ts:110`) | Always fires for ownership transitions (price, confirm, status change). |

Inline overrides exist only for the `Expired` event (which is itself produced only by `expireOrdersInternal`) and the `rejectFromReception` mutation (which is triggered only by the receptionist's Reject button on the action keyboard). Both are explicit user actions; both transition *away* from the customer-success statuses, so they bypass `pushCustomerOrderStatus` and reach the customer through their own dedicated, narrowly-scoped notifications.

> The summary: **the customer never gets a "your order is accepted" push from `publicCreate` / `createTelegramOrder` / `createWalkIn`** — those mutations only land the order in PENDING_REVIEW, and PENDING_REVIEW is not in `CUSTOMER_PUSH_STATUSES`. The single customer push for an accepted order is the one fired by `confirmOrderAndIssueJobCard` when the receptionist verifies payment.

## 3. Receptionist Telegram group (the moment an order is placed)

The receptionist group is the operations nerve centre for new orders. The moment a customer submits an order — any of the three submission surfaces — `notifyOrderRoles` notifies the Owner/Manager/Admin in-app and the `notifyReceptionist` helper (`src/telegram/bot.ts:156`) sends a single Telegram message to the chat id configured as:

```
TELEGRAM_RECEPTION_CHAT_ID   (preferred — set this in production)
TELEGRAM_OWNER_CHAT_ID       (legacy fallback)
```

The message includes the full order payload and a 4-row inline keyboard:

| Row | Buttons |
| --- | --- |
| 1 | ✅ Accept · ❌ Reject |
| 2 | 🔍 Verify payment |
| 3 | 👆 Open dashboard (URL button to `/dashboard`) |

- The Reject button calls `api.orders.rejectFromReception` (`convex/orders.ts:651`) which transitions the order to `Expired`, posts an in-app `order_status` notification to management, and pushes a polite *"❌ your order was declined"* message to the customer.
- Accept and Verify payment acknowledge in chat and reply with a URL to the dashboard so reception can complete pricing / payment verification with the full context (machine, material, quantity).
- The Open-dashboard link exposes the canonical dashboard URL via `process.env.NEXT_PUBLIC_APP_URL`.

> Because the bot packs the verified Telegram id + phone into the launcher URL (`miniAppLaunchUrl`, `bot.ts:99`), the receptionist can also open the customer's Telegram profile / chat directly from the in-app notification bell — the receptionist group isn't the only path.

## 4. Dual-layer inventory

The platform's correctness story is that the **central inventory and the operator floor are two projections of one ledger**, not two independent counters. They are reconciled by the event-sourced `stock_movements` table documented in `architecture.md` §4. Here is the handoff story.

### 4.1 Central parent inventory (`parentInventory`)

The storekeeper is responsible for the central projection. The data flow:

1. **Stock-in.** When new rolls / sheets / liters arrive, the storekeeper records them via `api.materials.create` (on a material) or `api.inventory.upsertParentInventoryItem`. Internally the handler calls `recordInventoryEvent` with `eventType: STOCK_IN`, decrementing nothing and incrementing both `materials.quantity` and `parentInventory.totalStockQuantity`. The conversion ratio used (`lengthPerRoll`, `areaPerSheet`, `volumePerContainer`) is frozen onto the event row (`stock_movements.conversionRatio`).
2. **Handover to operator.** The storekeeper's *Issue* action (now grounded in `request.issue` permission) — visible through the issue button on `material-requests-panel.tsx` — calls `api.materialRequests.issue` (`convex/materialRequests.ts:96`), which creates an `operatorSubStock` row and calls `recordInventoryEvent` with `eventType: STORE_TO_OPERATOR_TRANSFER`, `custody: parent`, `balanceEffect: transfer`. The event decrementing `materials.quantity` and parent packaging units (`parentInventory.totalStockQuantity -= packageQuantity`) and incrementing `operatorSubStock.currentRemaining`.
3. **Direct exception stock-outs.** Storekeeper / manager can record small ad-hoc writes via `api.orders.recordExceptionStockOut` (`convex/orders.ts:803`). This writes `eventType: EXCEPTION_STOCK_OUT` plus a `stockExceptions` row, which the audit log surfaces under *"exception stock-out"*.
4. **Physical reconciliation.** A weekly central count via `api.reconciliation.countMaterial` (`convex/reconciliation.ts:17`) writes a `reconciliations` row plus a `RECONCILIATION_ADJUSTMENT` event that corrects the parent projection.

> The storekeeper **never** patches `parentInventory.totalStockQuantity` directly. Every change flows through `recordInventoryEvent`.

### 4.2 Operator sub-stock (`operatorSubStock`)

The press floor is the second projection. The data flow:

1. **Initial issue.** A `STORE_TO_OPERATOR_TRANSFER` event creates and increments the row (above).
2. **Production.** Every `recordProduction` (per console session) writes a `PRODUCTION_CONSUMPTION` event with `custody: operator`. `recordInventoryEvent` decrementing `operatorSubStock.currentRemaining`. Offcuts are tracked through `OFFCUT_RETURN` events with `custody: operator` (also decrementing floor stock) plus an `offcuts` row that records a reusable offcut for re-issue.
3. **Scrap.** Scrap is recorded via `logScrap` or `exhaustOperatorStock`, both writing `SCRAP_LOG` events. `exhaustOperatorStock` patches `status: PENDING_CLEARANCE` and `currentRemaining` is left at zero.
4. **Weekly reconciliation.** Operator logs a physical count via `api.inventory.performWeeklyReconciliation`. The handler auto-promotes the batch to `PENDING_CLEARANCE` (if it was `ACTIVE`) and writes a `RECONCILIATION_ADJUSTMENT` event correcting the floor.
5. **Clearance.** Owner clicks **Approve Clearance** in the dashboard → `api.inventory.approveOperatorClearance` patches the row to `CLEARED` and notifies the operator.

### 4.3 The handoff between the two projections

| Event | Central projection effect | Floor projection effect |
| --- | --- | --- |
| `STOCK_IN` | `parentInventory.totalStockQuantity += pkg` | none |
| `STORE_TO_OPERATOR_TRANSFER` | `-pkg` (and `materials.quantity -= base`) | `operatorSubStock.currentRemaining += base`, `issuedQuantity += base`, `issuedUnits += pkg` |
| `PRODUCTION_CONSUMPTION` | none | `operatorSubStock.currentRemaining -= base` (when `custody: operator`) |
| `OFFCUT_RETURN` (custody operator) | none | `operatorSubStock.currentRemaining -= base`; `offcuts` row created |
| `SCRAP_LOG` | none | `operatorSubStock.currentRemaining -= base` |
| `RECONCILIATION_ADJUSTMENT` (central) | `parentInventory.totalStockQuantity ± pkg` and `materials.quantity ± base` | none |
| `RECONCILIATION_ADJUSTMENT` (operator) | none | `operatorSubStock.currentRemaining ± base` |

The two-tier invariant — *"the ledger is the source of truth, the projections are derived"* — is what allows the Owner to confidently audit ETB-denominated loss without ever trusting a balance directly: it reads the ledger.

### 4.4 Material requests: the only path to issue stock

`api.materialRequests.create` (`convex/materialRequests.ts:50`) is the entry point for an operator's *"I need more raw material"* call. The handler enforces:

| Gate | Detail |
| --- | --- |
| Permission | `request.create`. Owned by the six operator roles, manager, admin, storekeeper. **Explicitly excluded from Owner** by `EXCLUDED_FROM_OWNER`. |
| Quantity | Strictly positive. |
| Job-card link | The `jobCardId` must exist; the job's `materialId` and `unit` must match the request. |
| **Active floor-stock check** | The handler queries `operatorSubStock` by `operatorId = identity._id`, filters `status ∈ {ACTIVE, PENDING_CLEARANCE}`. If any row matches, it throws the owner-gated message: *"Request Blocked: You have active or un-cleared floor material. Please reconcile your remaining stock and obtain Owner Clearance before requesting new stock."* |
| Audit | Inserts the `materialRequests` row at `Requested` and notifies all `request.view` holders that a request is outstanding. |

`api.materialRequests.issue` (storekeeper action) increments the issuance counters, writes a `STORE_TO_OPERATOR_TRANSFER` event, patches the request status (`Partially Issued` if partial, `Issued` otherwise), and notifies the requesting operator. `api.materialRequests.acknowledge` (operator action) marks the batch as `Received`, writes a `material_received` notification to the issuer, and tracks who acknowledged it.

### 4.5 The "reconcile → clearance → new request" closed loop

```
 operator creates request
    │
    ├── blocked? throw "Request Blocked"
    │
    ├── storekeeper issues
    │
    ├── operator records production (PRODUCTION_CONSUMPTION)
    │
    ├── operator records weekly reconciliation or exhausts batch
    │      → RECONCILIATION_ADJUSTMENT or SCRAP_LOG
    │      → operatorSubStock.status = PENDING_CLEARANCE
    │
    ├── owner reviews on floor audit queue
    │      → click "Approve Clearance"
    │      → operatorSubStock.status = CLEARED
    │      → operator receives "clearance granted" notification
    │
    └── operator can create the next request
```

The loop is enforced in three places that must all be present:

1. `api.materialRequests.create` — rejects while any `ACTIVE` / `PENDING_CLEARANCE` row exists (`materialRequests.ts:50`).
2. `api.inventory.approveOperatorClearance` — the only path to `CLEARED`.
3. The ledger's auto-exhaustion — `EXHAUSTED` is reached before `CLEARED`, so an operator cannot sneak additional material by abusing `recordProduction`.

## 5. Operational configuration — the knobs that tune the workflows

Owned exclusively by the Owner (and admin for redundancy), the `systemConfigs` row captures every policy that the workflows above respect at runtime:

| Config field | Where it's consulted |
| --- | --- |
| `etbPerSquareMetre / Litre / Piece / Metre / Sheet`, `materialOverrides` | Every ETB-monetaryLoss computation in `convex/reconciliation.ts`, `convex/dashboard.ts:financialMetrics`, `convex/reports.ts`. |
| `unitConversionDefaults` | Material conversion at receive time (frozen onto `stock_movements.conversionRatio`). |
| `inkMlPerSquareMetre` | Material consumption rate for UV ink (used by `convex/materialUsage.ts` for production forecasting). |
| `maxAllowedWastePercent` | Threshold beyond which operator-reported waste flags for review. |
| `minOffcutAreaSquareMetre` | Offcuts smaller than this size are not recorded. |
| `requireAdminPinForExceptions` | Forces an authorization note on every direct exception stock-out (`convex/orders.ts recordExceptionStockOut`). |
| `maxDirectStockOutEtb` | ETB ceiling for un-approved direct exception stock-outs (the *Risk & Theft Prevention Controls* control). |
| `orderExpirationHours` | Drives the 24-hour unpaid-order expiry (above). |

Anyone editing these values must run `pnpm check / pnpm test / NODE_ENV=production pnpm build` before merging, exactly as the rest of the codebase. See `AGENTS.md`.

## 6. The notification dispatch matrix

Notification channels (in-app inbox, Telegram customer push, reception group alert, internal scheduled job) are independent. The dispatch matrix:

| Trigger | In-app inbox | Telegram customer | Reception Telegram group |
| --- | --- | --- | --- |
| New order placed (`publicCreate` / `createTelegramOrder` / `createWalkIn`) | `notifyOrderRoles` → Owner/Manager/Admin | — (gated by `pushCustomerOrderStatus`) | `notifyReceptionist` (inline keyboard) |
| Reception prices (`priceOrder`) | — | `pushCustomerOrderStatus` on transition to `PRICED_AND_PENDING_PAYMENT` | — |
| Reception confirms payment (`confirmOrderAndIssueJobCard`) | `notifyRoles(operatorRole + Owner/Manager/Admin)` | `pushCustomerOrderStatus` on transition to `JOB_CARD_CREATED` | — |
| Status flip to `IN_PRODUCTION` | `notifyOrderRoles` | `pushCustomerOrderStatus` | — |
| Status flip to `COMPLETED` | `notifyOrderRoles` | `pushCustomerOrderStatus` | — |
| Order expires (`expireOrdersInternal`) | `notifyUser` to operator | `notifyRoles` + customer push | — |
| Floor batch exhausted / reconciled | `notifyRoles` (Owner/Manager/Admin) | — | — |
| Operator clearance approved | `notifyUser` to the operator | — | — |
| Operator clearance rejected via Reject | `notifyOrderRoles` + direct customer push | Direct rejection message | — |
| Overdue order (`notifyOverdueInternal`) | `notifyOrderRoles` (Owner/Manager/Admin) | — | — |

Every push labelled **customer** is centralised through `pushCustomerOrderStatus`. Every push labelled **management** is centralised through `notifyOrderRoles`. The matrix is the single source of truth for "who hears about what".

## 7. Quick reference — primary entry points

| Workflow | Convex entry point | Telegram surface |
| --- | --- | --- |
| Customer submits Mini App order | `api.orders.submit` | `/` Mini App |
| Customer submits text-first order | `api.orders.createTelegramOrder` (called from `src/telegram/bot.ts createOrder`) | `/start` → bot flow |
| Walk-in order | `api.orders.createWalkIn` | — |
| Order pricing | `api.orders.priceOrder` (reception confirm modal) | — |
| Payment verification | `api.orders.confirmOrderAndIssueJobCard` (reception confirm modal) | Reception Reject button → `api.orders.rejectFromReception` |
| Operator material request | `api.materialRequests.create` | MaterialRequestsPanel |
| Storekeeper issue | `api.materialRequests.issue` | MaterialRequestsPanel |
| Operator acknowledge | `api.materialRequests.acknowledge` | MaterialRequestsPanel |
| Operator production log | `api.jobs.recordProduction` | Jobs view |
| Operator floor reconciliation | `api.inventory.performWeeklyReconciliation` | OperatorStock / weekly-reconciliation-modal |
| Storekeeper central count | `api.reconciliation.countMaterial` | Reconciliation view |
| Owner floor clearance | `api.inventory.approveOperatorClearance` | OwnerInventoryOversight, OperatorClearancePanel |
| Owner review | `api.reconciliation.review` | Reconciliation view |
| Unpaid-order expiry (cron) | `internal.orders.expireOrdersInternal` (every 30 min) | Customer push with `Expired` copy |
| Overdue alerts (cron) | `internal.orders.notifyOverdueInternal` (every hour) | — |
| Reception push on new order | `notifyReceptionist` (in `src/telegram/bot.ts`) | Always when a chat id is set |

## 8. Summary

The platform's operational model has only three moving parts:

1. **Customer → Reception → Production → Pickup** — anchored on `customerOrders.status`, gated by `pushCustomerOrderStatus` so no premature customer success push is possible.
2. **Central Store → Operator Floor → Reconciliation → Owner Clearance** — anchored on the event-sourced ledger and the `operatorSubStock.status` lifecycle, gated by `materialRequests.create` so operators can never skip reconciliation.
3. **Operational Configuration** — anchored on `systemConfigs`, owned by the Owner, consumed everywhere ETB-rate, conversion, expiry, or risk decisions happen.

Each part has its own documentation deep-dive in this suite. The next place to read for the security angle is [`rbac-security.md`](./rbac-security.md).
