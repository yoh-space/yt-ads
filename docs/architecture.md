# System Architecture

> **Scope.** This document explains how the YT Advertisement Operations Platform is constructed: the runtime stack, how data flows between the layers, the event-sourced inventory ledger that powers every monetary and stock-balance figure, and the relational schema that backs the order / job / production workflows.

## 1. Tech stack

| Layer | Technology | Purpose in this codebase |
| --- | --- | --- |
| Web client | **Next.js 16 (App Router, Turbopack)** | The authenticated dashboard at `/dashboard` (server-rendered shell, client-rendered panels), the public Mini App at `/` (`src/app/page.tsx` → `<TelegramMiniAppOrder/>`), and the order tracker at `/track`. |
| Backend | **Convex 1.25** | Authoritative database, real-time queries, mutations, and scheduled crons (`convex/crons.ts`). All business logic lives here. |
| Auth | **Better Auth (`@convex-dev/better-auth`)** | Manages staff identities and the `users`/`staff` tables; powers `/sign-in` and `/sign-up` pages; also resolves the signed-in identity for every Convex handler. |
| Styling | **Tailwind v3.4 + design tokens in `src/app/globals.css`** | Authoritative token set: deep-navy canvases (`--background: 222 47% 11%`), midnight-slate surfaces (`--card: 215 28% 17%`), electric-cyan accents (`--cyan: 199 89% 48%`). |
| UI primitives | **`src/components/ui/*`** | `Panel`, `PanelHeader`, `Button`, `Badge`, `Input`, `Select`, `StatusPill`, `StatCard`, `TelemetryBar`, `Progress`, `MicroHistogram`, `MetricChart`, `Table`, `Typography` — every dashboard surface composes these. These are domain-neutral with no Convex or role imports. |
| Dashboard domains | **`src/components/dashboard/*`** | Domain views and modals are organized under `views/` and `modals/`; shared UI primitives remain in `src/components/ui/*`. |
| Telegram bot | **grammY (`src/telegram`)** | Long-polling bot over `TELEGRAM_BOT_TOKEN`. Webhook handler is mounted at `/api/telegram`. Sessions back into Convex (`telegramSessions`). |
| Tauri desktop shell | **Tauri v2 (`src-tauri/`)** | Optional desktop wrapper that loads the existing web app at `http://localhost:3000`; auto-update is registered via `src/components/auto-updater.tsx`. |
| Cron / schedulers | **`convex/crons.ts` + `ctx.scheduler.runAfter`** | Hourly overdue-order alerts, every-30-minutes order expiry, nightly status-casing migration, plus inline-deferred Telegram pushes and inventory write-backs. |
| Test stack | **Vitest (`vitest.config.ts`)** | Pure unit tests on shared library/utility modules (geometry, units, permissions, validation, telegram session helpers). |
| Validation | **Convex validators + `convex/validation.ts`** | Shared validation helpers (`assertPositiveFinite`, production-log invariants) and schema validators reused by public mutations/queries. |

> The platform intentionally avoids React/Next.js-only state management. Server state is **exclusively** synced through Convex subscriptions (`useQuery` / `useMutation`); client-only state is restricted to ephemeral form/input state inside individual components.

## 2. High-level topology

```
┌─────────────────────────────────┐    ┌─────────────────────────────────────────┐
│  Telegram clients (customers)   │    │       Web dashboards (staff)            │
│  - private chats w/ bot          │    │  - Next.js App Router /dashboard       │
│  - Telegram Mini App (WebApp)    │    │  - Workspace-oriented routing          │
└──────────────────┬──────────────┘    │  - React + Tailwind components          │
                   │                   │  - Dashboard domain components         │
                   │ HMAC-SHA256 initData  └────────────────────┬──────────────────┘
                   │ Telegram WebApp primary button         │
                   │                                        │ Better Auth session
                   ▼                                        │
        ┌──────────────────────────────────────────────────────────┐
        │           grammY bot webhook + Mini App API              │
        │      /api/telegram  ◄──►  Convex mutations/queries       │
        │      /api/auth/[...all]                                  │
        └──────────────────────────┬──────────────────────────────┘
                                   │ Convex over HTTPS
                                   ▼
        ┌──────────────────────────────────────────────────────────┐
        │                     Convex deployment                    │
        │  ─ schema + validators (convex/schema.ts, types.ts)        │
        │  ─ mutations / queries / actions (convex/*)               │
        │  ─ scheduled crons (crons.ts)                             │
        │  ─ Telegram session & user tables                         │
        │  ─ Single source of truth: stock_movements                │
        └──────────────────────────────────────────────────────────┘
```

### 2.1 Workspace-oriented routing

The dashboard uses a canonical workspace routing model defined in `docs/adr/0001-workspace-routing-architecture.md`:

- **Canonical routes**: `/dashboard/[workspace]/...` where `workspace` ∈ `{owner, manager, admin, storekeeper, receptionist, operator}`
- **Operator routes**: Stable at `/dashboard/operator/[machine]` for `laser`, `cnc`, `plotter`, `printer`
- **Legacy redirects**: Flat routes (`/orders`, `/inventory`, `/reports`, `/settings`, `/reconciliation`) and the legacy reception route redirect to canonical workspace routes; owner, manager, and storekeeper roots are served directly by the dynamic workspace route
- **Authorization**: Route contracts in `src/lib/role-routing.ts` define allowed prefixes per workspace; proxy interception in `src/proxy.ts` enforces redirects

The workspace model separates functional operational domains from raw database roles, enabling modular feature loading and scoped layout ownership.

The platform deliberately keeps the React/Next.js server out of the business-logic path: every authoritative decision (creating an order, pricing one, approving clearance, sending a Telegram alert) is a **Convex** call. The Next.js server is responsible only for SSR of the dashboard shell and for the `/api/auth/[...all]` and `/api/telegram` webhook routes.

## 3. Two-tier inventory (parent ↔ floor)

Material lives in exactly two projections:

- **Central parent inventory** (`parentInventory` table) — whole **packaging units** held by the store. Each row declares `unitType ∈ {ROLL, SHEET, LITER}` and a conversion factor (e.g. `lengthPerRoll`, `areaPerSheet`, `volumePerContainer`). Owning this projection lets the storekeeper answer *"how many rolls of 3-metre banner do we still have?"* without any conversion math.
- **Operator sub-stock** (`operatorSubStock` table) — base-unit stock sitting at a specific operator on a specific machine. A floor batch moves through `ACTIVE → PENDING_CLEARANCE → CLEARED → EXHAUSTED` as it goes from "just issued" to "owner-approved" to "fully consumed".

The reason both projections exist is that the store and the press floor speak different units. The store counts rolls; the press consumes square-metres. Patching either side directly would lose the unit-conversion rate at write time, so the two projections are **projected** by the ledger rather than maintained by hand.

## 4. Event-sourced inventory ledger

The authoritative inventory write surface is the `stock_movements` table. Every change in stock — receiving, issuing, producing, returning an offcut, scrapping, reconciling, or recording a direct exception stock-out — is an **immutable event row**. Materialised balances (on `materials`, `parentInventory`, and `operatorSubStock`) are projections maintained transactionally inside `convex/inventoryLedger.ts:71` (`recordInventoryEvent`); they are never patched directly.

### 4.1 Authoritative event types

The union is defined in `convex/schema.ts` (`stockEventType`) and exported from `convex/inventoryLedger.ts` (`InventoryEventType`):

| Event | `eventType` discriminator | `custody` | `balanceEffect` | When it is written | Side-effects on balance projections |
| --- | --- | --- | --- | --- | --- |
| Receive into central store | `STOCK_IN` | `parent` | `in` | Storekeeper receives new rolls / sheets / liters (mutations in `convex/materials.ts`, `convex/inventory.ts`). | Catalog base-units ↑, parent packaging units ↑ (when `parentInventoryId` + `packageQuantity` provided). |
| Hand a batch to a press operator | `STORE_TO_OPERATOR_TRANSFER` | `parent` (when issued by storekeeper) | `transfer` | A storekeeper "issues" to an operator (`convex/materialRequests.ts:256` → `recordInventoryEvent`). | Catalog base-units ↓, operator sub-stock `currentRemaining` ↑, issued quantity `+baseQuantity`, packaging units `+packageQuantity`. |
| Produce output (consume material) | `PRODUCTION_CONSUMPTION` | `operator` | `out` | Operator logs production (`convex/jobs.ts` recordProduction). | Operator sub-stock `currentRemaining` ↓. |
| Return a usable offcut | `OFFCUT_RETURN` | `operator` | `in` | Operator registers a usable offcut (`convex/offcuts.ts` createOffcut). | Operator sub-stock `currentRemaining` ↓ (counts against floor balance), and the `offcuts` table records a reusable piece. |
| Log scrap on the floor | `SCRAP_LOG` | `operator` | `none` | Operator manually marks scrap (`convex/offcuts.ts` logScrap), or `convex/inventory.ts` `exhaustOperatorStock`. | Operator sub-stock `currentRemaining` ↓ (no catalog change). |
| Weekly physical reconciliation | `RECONCILIATION_ADJUSTMENT` | `parent` or `operator` | `in`/`out` | Operator records a physical count (`convex/inventory.ts` performWeeklyReconciliation) or store records a central count (`convex/reconciliation.ts` countMaterial). | Either tier's balance is corrected, and a discrepancy row is written to `weeklyReconciliations` or `reconciliations`. |
| Direct exception stock-out | `EXCEPTION_STOCK_OUT` | `parent` or `operator` | `out` | Owner/manager records a sample / repair / test cut (`convex/orders.ts` recordExceptionStockOut). | Catalog or sub-stock stock `↓`; a `stockExceptions` row is written. |

**Automated dispatch registration.** On top of the operator-registered flows above, `confirmOrderAndIssueJobCard` (`convex/orders.ts:1018`) derives scrap and off-cut deterministically — never from client input — via the pure engine `src/shared/material-calc.ts` (shared with `previewAutoRouting`, so the dispatch modal's read-only **Auto-Calculated Production Breakdown** card matches the ledger exactly). In one transaction it:

- writes a `PRODUCTION_CONSUMPTION` (custody `parent`, `out`) for the roll `grossArea` (`rollWidth × jobLength × qty`) or rigid total sheet area;
- when a roll side strip ≥ 0.3 m wide (or a rigid-sheet leftover) is a usable off-cut, inserts an `offcuts` row and an `OFFCUT_RETURN` event (custody `parent`, `in`);
- writes a `SCRAP_LOG` event plus a `scraps` row for the remainder (+ owner-configured setup margin);
- persists the breakdown on the `jobCards` row (`grossDeductedQuantity`, `netProductArea`, `offcutArea`, `scrapArea`, `scrapPercentage`).

### 4.2 Invariants enforced by `recordInventoryEvent`

The single helper that writes every ledger row enforces these invariants transactionally (`convex/inventoryLedger.ts:71`):

1. **Quantities are strictly positive.** `baseQuantity > 0` is asserted (`inventoryLedger.ts:75`).
2. **Notes are never empty** — every event has a free-text narrative (`inventoryLedger.ts:78`).
3. **The material must be active** (`inventoryLedger.ts:81`).
4. **Central-store balance cannot go negative**; the projection rejects with `Insufficient ${material.name} stock` (`inventoryLedger.ts:91`). The projection clamps to zero on read (`materials.quantity = Math.max(0, …)`) but rejects on write.
5. **Operator sub-stock cannot go negative** (`inventoryLedger.ts:134`). A sub-stock row also auto-flips to `EXHAUSTED` when remaining ≤ 0 (`inventoryLedger.ts:185`). Then a separate `exhaustOperatorStock` (and the weekly reconciliation flow) is responsible for transitioning it through `PENDING_CLEARANCE → CLEARED`.
6. **The event is appended *after* the projection updates** (`inventoryLedger.ts:190`), so readers replaying the ledger see the same state the projections show.

### 4.3 Why the ledger is event-sourced and not just balance-based

Two engineering realities justify the design:

- **ETB-denominated leakage detection depends on unit-conversion history.** Stock loss is computed as `|variance| × etbValue`. The conversion ratio used at receive time must be preserved per roll, not derived from a current state — the schema therefore records `conversionRatio`, `packageQuantity`, and `packageUnit` directly on each event.
- **The Owner's audit queue needs replay.** Operator sub-stock is the only tier that a manager can interrogate to detect a missing roll; that requires `stock_movements` to be queryable per `operatorSubStockId`. The `by_operator_sub_stock` and `by_material_created` indexes (schema.ts:518–519) keep those reads cheap.

The authoritative contract — *the projection fields are derived, the events are the truth* — is also stated on the `stock_movements` table comment (schema.ts:484–487).

## 5. Database schema (canonical reference)

The schema is defined in `convex/schema.ts`; every table there is annotated with the role that authors it and the typical consumer. Below is the **logical** model grouped by concern, with the table-level invariants that matter to architects.

### 5.1 Identity, configuration, and notifications

| Table | Purpose | Key indices |
| --- | --- | --- |
| `companySettings` | One row per workspace (key `"yt-advertisement"`) holding company name, address, phone, logo URL, daily/monthly report flags, timezone, and the active state of the workspace. | `by_key` |
| `systemConfigs` | One row (key `"default"`) of owner-managed operational knobs: ETB rates per base unit, unit conversion defaults, per-material price overrides, ink ML/m², waste and offcut thresholds, risk controls, and the order-expiration window. Authored only by Owner/admin via the Operational Configuration page. | `by_key` |
| `users` | Better-Auth-backed staff profiles with `authUserId`, `name`, `email`, `role`, `active`. Created on first sign-in via the `ensureProfile` mutation. | `by_auth_user`, `by_role` |
| `staff` | Lightweight business-roster table that links business titles (e.g. *Lead Printer*) to one or more `applicationRoles`. Powers the "Team" tab of the settings panel. | `by_business_role`, `by_auth_user` |
| `notifications` | Per-user in-app inbox. `recipientAuthUserId` indexed for fast unread listing; status reads use the `by_recipient_read` index. | `by_recipient_created`, `by_recipient_read` |
| `migrations` | One-shot data migration markers. A row is written once a backfill has run so the same migration never executes twice. | `by_key` |

### 5.2 Catalog & machines

| Table | Purpose | Key indices |
| --- | --- | --- |
| `materials` | Canonical material catalog. Carries name, category, base unit, purchase unit, conversion ratio, specifications, reorder threshold, and the *deprecated* `quantity` projection (live balance is the ledger; `materials.quantity` is kept for fast UI display only). | `by_category`, `by_unit` |
| `machines` | Production resources. Each row carries `operatorRole` so role-based access can answer "is this operator allowed to drive this machine?" — see `canAccessMachine` / `canAccessJob` in `convex/authorization.ts:194`. | `by_code`, `by_operator_role` |

### 5.3 Orders, jobs, and production

`customerOrders` (`schema.ts:396`) is the customer-facing order ledger. The schema encodes:

- **Lifecycle** — `status: orderStatus`. The canonical lifecycle is `PENDING_REVIEW → PRICED_AND_PENDING_PAYMENT → CONFIRMED_PAID_OR_CREDIT → JOB_CARD_CREATED → IN_PRODUCTION → COMPLETED → READY_FOR_PICKUP`, with terminal `Expired` and `EXPIRED_JUNK`. Legacy aliases (`"Received"`, `"In Production"`, `"Completed"`, `"Ready for Pickup"`) are kept only as a bridge for `convex/migrations.ts` to read legacy rows and re-case them.
- **Customer organization fields** — `tinNumber` and `companyLegalName` are captured from Telegram orders and shown to reception for copying into the external workflow. The application does not generate invoices or receipts.
- **Telegram binding** — `telegramChatId`, optional `telegramId` not stored (the binding is on `telegramUsers` for verified customers). Indexed by `by_telegram_chat_id` for fast customer look-ups.
- **Pricing + payment** — `amount`, `paymentStatus ∈ {UNPAID, PAID, APPROVED_CREDIT}`, and `paymentConfirmedAt/By`. The first external-touch push to the customer is fired when `paymentDecision = PAID` is recorded (`convex/orders.ts` `confirmOrderAndIssueJobCard`).
- **Cron-friendly indexes** — `by_due_date` (overdue alerts), `by_expires_at` (24-hour unpaid-order expiry). The cron at `convex/crons.ts:7` runs `expireOrdersInternal` every 30 minutes.

`jobCards` (`schema.ts:493`), `productionLogs` (`schema.ts:516`), and the related `offcuts` / `offcutConsumptions` / `scraps` tables chain behind an order. `JobCard.quantity` is the planned base-unit quantity; each `productionLog` row records the operator's per-session *input* and *output* quantities; the ledger difference between them is what's recorded as `PRODUCTION_CONSUMPTION` (or split into `PRODUCTION_CONSUMPTION` + `SCRAP_LOG` + `OFFCUT_RETURN`).

### 5.3.1 Service routing & material recipes

Automatic machine routing and material planning are driven by three tables (see `src/shared/services.ts` and `src/shared/machine-catalog.ts` for the frontend mirrors):

| Table | Purpose | Key indices |
| --- | --- | --- |
| `serviceBOM` | Active per-service bills of material that generate immutable `jobMaterialRequirements` at confirmation. Each row carries `consumptionMode`, `quantityPerUnit`, `wasteAllowancePercent`, `required`, and `active`. | `by_service`, `by_material`, `by_active_service` |
| `serviceMaterialRecipes` | Per-service recommended materials with a `requirementMode`, base quantity, waste allowance, and required flag. Used to resolve candidate materials for a service. | `by_service`, `by_material`, `by_active_service` |
| `materialTypeCatalog` | Maps a `serviceType` to a preferred `materialType` and `preferredMaterialName`, plus the `machineCapabilities` and `operatorRole` expected for that material type. | `by_service_active`, `by_material_type` |

### 5.4 Material-handshake layer

The material flow between a job card and the store is tracked through request groups and per-material lines:

| Table | Purpose | Key indices |
| --- | --- | --- |
| `materialRequests` | Per-job-card aggregate request to the store for a given material. Drives the "Issue / Acknowledge" UI inside the dashboard (`src/components/dashboard/material-requests-panel.tsx`). | `by_job_card`, `by_status` |
| `materialRequestLines` | Line items under a request group. `requestGroupId` links multiple material lines into one request; each line carries `packageUnit`, requested/issued packages, base-unit quantities, and a `conversionRatioSnapshot`. | `by_request_group`, `by_job_card`, `by_material`, `by_status` |
| `jobMaterialRequirements` | Immutable per-job material requirements generated from the active `serviceBOM` at job-card confirmation. Records planned base quantity, approved scrap allowance, packages issued, and status. | `by_job_card`, `by_material`, `by_status` |
| `stockExceptions` | Per-event row for direct exception stock-outs, snapshotting `materialId`, `quantity`, `unit`, `baseQuantity`, `reason`, optional `authorizationNote`, plus the staff member who recorded it. | `by_created` |
| `overuseExceptions` | Flags when actual material usage exceeds the planned `approvedScrapQuantity`. Lifecycle `OPEN → ACKNOWLEDGED → RESOLVED`; links job card, material, and the offending `productionLog`. | `by_status`, `by_job_card`, `by_material` |

### 5.5 Inventory (authoritative)

| Table | Purpose | Key indices |
| --- | --- | --- |
| `stock_movements` | Event-sourced ledger (see §4). | `by_material_created`, `by_event_type`, `by_parent_inventory`, `by_operator_sub_stock`, `by_machine_created`, `by_job_card` |
| `parentInventory` | Whole-unit central projection, keyed by material with `unitType ∈ {ROLL, SHEET, LITER}` and unit-specific conversion factor (`lengthPerRoll`, `areaPerSheet`, `volumePerContainer`). | `by_material`, `by_unit_type` |
| `operatorSubStock` | Active floor projection. Carries `parentInventoryId`, `operatorId`, `machineId`, the issuance counters (`issuedUnits`, `issuedQuantity`, `currentRemaining`), packaging counters, `status ∈ {ACTIVE, PENDING_CLEARANCE, CLEARED, EXHAUSTED}`, and the owner clearance trail (`clearedBy`, `clearedAt`, `clearanceNote`). | `by_parent_inventory`, `by_machine`, `by_operator`, `by_material_machine`, `by_status` |
| `weeklyReconciliations` | Audit log of physical floor counts. Carries `systemCalculatedRemaining`, `physicalActualRemaining`, `discrepancy`, and the unit. The discrepancy is also written as a `RECONCILIATION_ADJUSTMENT` event. | `by_machine`, `by_reconciled_at` |
| `reconciliations` | Central-store physical-count history. Carries `systemQuantity`, `countedQuantity`, `variance`, optional `etbValue` and `monetaryLoss`, the reviewer chain (`reviewedBy`, `reviewedAt`), and the **Owner-only** lifecycle `Open → Reviewed → Resolved`. Reviewing is via `requireRoles(["owner"])` in `convex/reconciliation.ts:139`. | `by_material`, `by_created`, `by_status` |

> **Note.** Earlier versions of this document referenced legacy tables `stockMovements` and `operatorMachineStock`. Those tables are **not** part of the current `convex/schema.ts`; the authoritative event stream is `stock_movements` and the active floor projection is `operatorSubStock`.

### 5.6 External surfaces (Telegram)

| Table | Purpose |
| --- | --- |
| `telegramUsers` | One row per Telegram customer id holding the verified phone (from the `/start` share-contact flow) and optional display name. Distinct from the staff `users` table — these are unmanaged, customer-side identities. |
| `telegramSessions` | One row per `chat:<id>` holding the JSON-serialized grammY session (language, in-progress step, order draft, cached phone, cached `telegramUserId`). Durability across serverless webhook invocations is provided by reading / writing through `convex/telegramSessions.ts` from inside `src/telegram/session-storage.ts`. |

The split between `telegramUsers` (durable profile) and `telegramSessions` (transient in-progress draft) is intentional — the bot can confidently reuse the phone after a customer clear their conversation, while drafts quietly expire.

## 6. Cross-cutting invariants

These are the platform-wide rules a contributor must preserve, summarized here and elaborated in the linked docs:

1. **The ledger is the source of truth.** Materialized balances can be clamped; they cannot be patched directly (see §4.2).
2. **Reception always owns order-status advancement.** A new order enters at `PENDING_REVIEW` and only advances after an `order.manage`-bearer (Owner / Manager / Admin / Receptionist) explicitly prices and confirms it. See `docs/workflows.md`.
3. **Owner clearance is the gate on operator requests.** A machine operator cannot request more stock while *any* of their `operatorSubStock` rows is `ACTIVE` or `PENDING_CLEARANCE`. See `docs/owner-oversight.md`.
4. **Telegram `initData` is HMAC-verified per call.** The bot's mini-app launcher URLs deep-link the verified phone and Telegram id; the Mini App treats them as authoritative and falls back to initData-protected queries only when the deep-link is missing. See `docs/rbac-security.md`.

## 7. Where to read next

- **What does the Owner see and decide?** → [`owner-oversight.md`](./owner-oversight.md).
- **How does an order move from creation to production?** → [`workflows.md`](./workflows.md).
- **Who is permitted to do what, and how is the Telegram bot authenticated?** → [`rbac-security.md`](./rbac-security.md).
