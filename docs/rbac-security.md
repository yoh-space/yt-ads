# Role-Based Access Control & Telegram Security

> **Scope.** This document is the authoritative reference for everything the platform uses to decide **who is allowed to do what** and **how external clients (Telegram Mini App + webhook) prove their identity**. It covers the role permission matrix, attribute-based access around machines and jobs, the HMAC-SHA256 `initData` verification used by every Telegram exchange, the phone-binding handoff on `/start`, and the storage-session strategy that keeps grammY state durable across serverless webhook invocations.

The canonical implementation is split across four files; cross-reference them when extending the system:

- `convex/authorization.ts` — the **server-side** permission union, `ROLE_PERMISSIONS` map, `requirePermission` / `requireRoles` / `requireAnyPermission` helpers, and the attribute-based `canAccessMachine` / `canAccessJob` / `canAccessMaterialRequest` predicates.
- `src/lib/permissions.ts` — the **mirror** used by the React side to render buttons and route views. Kept in lock-step with `convex/authorization.ts` per the `AGENTS.md` guidance.
- `convex/telegramAuth.ts` — the HMAC verifier (`verifyTelegramInitData`) shared by `users.getByTelegramId`, `orders.publicCreate`, `orders.listForTelegramUser`, and the helper `getTelegramProfileForBot`.
- `src/telegram/bot.ts` and `src/telegram/session-storage.ts` — the grammY bot + Convex-backed session adapter that maintains language, step, draft, and the cached phone/telegram user id across webhook invocations.

## 1. Roles and the canonical permission union

The platform runs eleven roles (`convex/schema.ts:4` and `src/lib/operations-types.ts`). The role union is exactly:

```ts
type Role =
  | "owner"
  | "manager"
  | "admin"
  | "storekeeper"
  | "crystal_jet_operator" | "crystek_operator"
  | "ricoh_uv_operator"    | "dtf_operator"
  | "laser_operator"       | "cnc_operator"
  | "receptionist";
```

The permission union is closed; new permissions must be added in **four** places to stay consistent:

1. `convex/authorization.ts` — extend the `Permission` union and add the token to the relevant role arrays.
2. `src/lib/permissions.ts` — mirror the change in the frontend mirror.
3. Any Convex mutation / query that should be gated by the new token — wire it through `requirePermission(ctx, "...")`.
4. Any React surface that renders a gated button / link — check `can(profile, "...")` before showing the action.

### 1.1 The full permission set

The 38 permission tokens grouped by concern:

| Group | Tokens |
| --- | --- |
| Dashboards & visibility | `dashboard.view`, `audit.view`, `reports.view` |
| Materials catalog & stock | `material.view`, `material.create`, `material.edit`, `material.delete`, `stock.record`, `stock.exception` |
| Machines | `machine.view`, `machine.create`, `machine.update`, `machine.delete` |
| Jobs & production | `job.view`, `job.create`, `job.complete`, `job.record_production` |
| Floor offcuts / scrap | `offcut.view`, `offcut.create`, `scrap.view`, `scrap.create` |
| Material request handover | `request.view`, `request.create`, `request.issue`, `request.acknowledge` |
| Customer orders | `order.view`, `order.create`, `order.manage` |
| Reconciliation | `reconciliation.record`, `reconciliation.review`, `reconciliation.operator`, `reconciliation.clearance` |
| Workspace | `team.view`, `team.manage`, `company_settings.update` |

## 2. Role permission matrix

The matrix below is the source of truth for **server-side** access. The React mirror in `src/lib/permissions.ts` mirrors it.

| Permission | owner | manager | admin | storekeeper | crystal_jet_operator | crystek_operator | ricoh_uv_operator | dtf_operator | laser_operator | cnc_operator | receptionist |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `dashboard.view` | ✓ | ✓ | ✓ | ✓ | | | | | | | ✓ |
| `material.view` | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| `material.create` | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| `material.edit` | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| `material.delete` | ✓ | ✓ | ✓ | | | | | | | | |
| `stock.record` | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| `stock.exception` | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| `machine.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `machine.create` | ✓ | ✓ | ✓ | | | | | | | | |
| `machine.update` | ✓ | ✓ | ✓ | | | | | | | | |
| `machine.delete` | ✓ | ✓ | | | | | | | | | |
| `job.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `job.create` | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| `job.complete` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `job.record_production` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `offcut.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `offcut.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `scrap.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `scrap.create` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `request.view` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `request.create` | — **Owner excluded** | ✓ | ✓ | — *excluded* | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `request.issue` | — **Owner excluded** | ✓ | ✓ | ✓ | | | | | | | |
| `request.acknowledge` | — **Owner excluded** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `order.view` | ✓ | ✓ | ✓ | | | | | | | | ✓ |
| `order.create` | ✓ | ✓ | ✓ | | | | | | | | ✓ |
| `order.manage` | ✓ | ✓ | ✓ | | | | | | | | ✓ |
| `reconciliation.record` | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| `reconciliation.review` | — **Manager excluded** | — | ✓ (admin) | | | | | | | | |
| `reconciliation.operator` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| `reconciliation.clearance` | ✓ | ✓ | ✓ | | | | | | | | |
| `team.view` | ✓ | ✓ | ✓ | | | | | | | | |
| `team.manage` | ✓ | ✓ | | | | | | | | | |
| `company_settings.update` | ✓ | — **Manager excluded** | ✓ | | | | | | | | |
| `reports.view` | ✓ | ✓ | ✓ | ✓ | | | | | | | |
| `audit.view` | ✓ | ✓ | ✓ | ✓ | | | | | | | |

Differences from a naïve "everyone gets everything" map:

- **Owner** is `[...ALL]` **minus** `{request.create, request.issue, request.acknowledge}`. The Owner never participates in request lifecycle; see `docs/owner-oversight.md`.
- **Manager** is `[...ALL]` **minus** `{company_settings.update, reconciliation.review, reconciliation.clearance}`. ETB rate cards and final clearance decisions are Owner (or admin, the canonical back-office substitute).
- **Admin** holds **every** permission. It is the operational back-office for the Owner; the audit trail (`clearedBy`, `reviewedBy`) records who actually pressed the buttons.
- **Storekeeper** keeps the central store (`material.edit`, `stock.record`, `stock.exception`) but does not carry `reconciliation.review` — the Owner/manager is the reviewer of the store's counts.
- The six **operator roles** share the `OPERATIONS` array (`authorization.ts:81`). They never write customer orders; they only drive machines and log their own production.
- **Receptionist** carries only the order-management bundle: `dashboard.view`, `order.view`, `order.create`, `order.manage`. They own the order lifecycle and copy customer-provided TIN and organization details from Telegram orders when needed.

The frontend mirror (`src/lib/permissions.ts:100`) keeps the exact same map with one cosmetic difference: the frontend additionally offers `dashboard.view` to all operator roles — UI nicety for the operator workspace landing page.

## 3. Attribute-based access (ABAC)

Some permissions are not enough. Three places implement ABAC predicates in addition to plain role checks:

### 3.1 `canAccessMachine(role, machine)`

```ts
function isManagementOrStore(role: Role): boolean {
  return ["owner", "manager", "admin", "storekeeper"].includes(role);
}

export function canAccessMachine(role: Role, machine: { operatorRole: Role }): boolean {
  if (isManagementOrStore(role)) return true;
  return machine.operatorRole === role;
}
```

Used by queries that list a *single* operator's machine fleet (e.g. `listParentInventory` filtered for an operator's presses). Management / store may see all machines; an operator only sees machines where `machines.operatorRole` matches their role.

### 3.2 `canAccessJob(role, machine)`

```ts
export function canAccessJob(role: Role, machine: { operatorRole: Role } | undefined): boolean {
  if (isManagementOrStore(role)) return true;
  if (!machine) return false;
  return machine.operatorRole === role;
}
```

Used in the operator's job board so a `laser_operator` cannot see `cnc_operator` jobs and vice versa.

### 3.3 `canAccessMaterialRequest(role, identityId, request, machine?)`

```ts
export function canAccessMaterialRequest(
  role: Role,
  identityId: string,
  request: { requestedBy: string },
  machine?: { operatorRole: Role },
): boolean {
  if (isManagementOrStore(role)) return true;
  if (request.requestedBy === identityId) return true;
  if (machine && machine.operatorRole === role) return true;
  return false;
}
```

Used in `api.materialRequests.list` to apply a per-request visibility filter. Operators only see their own requests (or requests tied to a machine they own). This is a defense-in-depth filter; the mutation-level `requirePermission` still applies, but a *list* query has to encode visibility post-`requirePermission`.

## 4. RBAC guardrails in Convex handlers

Every Convex mutation / query that mutates a protected resource opens with one of these guards:

```ts
// Hard guard for a single permission.
await requirePermission(ctx, "order.manage");

// Hard guard for any of a set (e.g. either a manager or owner).
await requireAnyPermission(ctx, ["stock.exception", "request.issue"]);

// Hard guard for exact role(s).
await requireRoles(ctx, ["owner"]);
```

Helpers live in `convex/users.ts:319` (`requirePermission`), `users.ts:336` (`requireRoles`), and the re-exported `requireAnyPermission`. They always:

1. Call `authComponent.safeGetAuthUser(ctx)` and throw if no identity.
2. Resolve the staff profile via `by_auth_user` index.
3. Reject inactive profiles.
4. Check the permission/role and throw *before any side-effect* if the caller fails the check.

These are the only auth-relevant checks the server enforces on every protected action. The frontend mirror is purely a *render-time hint* — if the React state renders the wrong button, the server still rejects.

### 4.1 `canViewFinancial` (extra Owner-only lock)

```ts
export function canViewFinancial(role: Role): boolean {
  return role === "owner";
}
```

Used by financial readout queries (`api.reconciliation.list`, `api.reconciliation.summary`, `api.reports.getReportsData`, `api.dashboard.financialMetrics`) to redact monetary loss fields, ETB-denominated reconciliation summaries, and the Owner-only financial overview. Even an admin who can call these queries sees `monetaryLoss: 0` for every shortage row. The audit log gets *less* info, not more — the assumption is that the Owner is the canonical financial audience.

## 5. Telegram Mini App authentication

The Mini App at `/` (`src/app/page.tsx` → `<TelegramMiniAppOrder/>`) is exposed inside the Telegram WebView. The platform's trust model for that surface relies on:

1. **HMAC-SHA256 initData signature verification** (`convex/telegramAuth.ts:30`).
2. **Bot-token-gated server-side lookups** for the customer's verified phone (`convex/users.ts` `getTelegramProfileForBot`).
3. **Deep-link URL parameters** for the launcher button (`src/telegram/bot.ts:99` `miniAppLaunchUrl`).
4. **Cross-realm fallback** — if the launcher URL didn't carry the phone, the Mini App falls back to the initData-protected `getByTelegramId` query.

### 5.1 HMAC-SHA256 initData verification

`verifyTelegramInitData(initData, maxAgeSeconds = 24 * 60 * 60)` (`convex/telegramAuth.ts:30`) implements Telegram's official contract:

1. Parse the URL-encoded form `initData`. Extract `hash`, `auth_date`, and `user`.
2. Reject if any are missing, if `auth_date` is non-integer, or if the signed payload is older than `maxAgeSeconds` (24 hours default).
3. Build the `data_check_string` by removing `hash`, lexicographically sorting `key=value` entries, and joining with `\n`.
4. Compute `secret_key = HMAC-SHA-256(token, "WebAppData")`.
5. Compute `expected_hash = hex(HMAC-SHA-256(secret_key, data_check_string))`.
6. Compare in constant time via XOR reduction across the two hex strings. Mismatch → throw `Invalid Telegram signature.`.
7. Parse `user` (JSON), require `id` to be a positive safe integer, return `{ telegramId, user, authDate }`.

Every server touchpoint that needs to trust Mini App data calls this helper before reading any data on behalf of a Telegram id. The Mini App then passes the same `initData` string as an argument to those queries — the server never accepts a Telegram id without the signed envelope.

> There is one exception: the `getTelegramProfileForBot` query is callable by anyone who holds the **bot token** as an argument. The Mini App never holds the bot token; only the grammY webhook does. The query exists so the bot webhook can hydrate the customer's verified phone on `/start` without making the Mini App perform an initData round-trip just to look up its own phone.

### 5.2 Bot webhook authentication in grammY

The bot webhook (`src/app/api/telegram/route.ts`) authenticates Telegram by verifying the bot secret token on incoming updates and consulting `TELEGRAM_BOT_TOKEN` for **outgoing** requests. The webhook's outbound calls are:

- `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/*` for `sendMessage`, `getFile`, etc.
- Convex mutations and queries via `convex/nextjs`'s `fetchMutation` / `fetchQuery`, which are **authenticated via Convex deploy key, not staff identity**. The bot therefore has no Better-Auth identity; Convex still accepts the call because the deploy key resolves to the bot's role. Public queries the bot calls (e.g. `api.users.upsertUser`, `api.orders.createTelegramOrder`) are intentionally written to accept the bot as a valid actor.

> This is the only place the bot acts without a Better-Auth identity. Everywhere else on the platform, every staff-side call resolves to a specific `identity._id`, and the role/permission check ties the action back to a person.

### 5.3 Mini App deep-link from the bot

`miniAppLaunchUrl(ctx)` (`src/telegram/bot.ts:99`) builds the URL the WebApp button posts to:

```
NEXT_PUBLIC_APP_URL/?tgid=<telegram user id>&phone=<verified phone>&name=<display name>
```

The Mini App's `bootstrapTelegramWebApp()` (`src/lib/telegram-webapp.ts`) reads `?tgid`, `?phone`, `?name` first (most authoritative: the bot just verified these against the customer's profile), and falls back to `window.Telegram.WebApp.initDataUnsafe.user` (less authoritative: webview fields). The phone pulled from the query string **never** requires a second `getByTelegramId` round-trip; the order submission therefore succeeds on the first frame. If the URL is missing these params (e.g. someone opens the Mini App from a normal browser), the Mini App shows the gentle *"this form must be opened in Telegram"* notice.

The Mini App's submit flow is shown verbatim in `src/components/public/telegram-mini-app-order.tsx:108`. It uses the verified phone and submits `api.orders.submit({ telegramInitData, telegramId, phone: verifiedPhone, ... })`. The Mini App's calls only happen *after* initData is present (the `useQuery(api.users.getByTelegramId, ...)` is skipped when `launchPhone` is already set), so the phone binding never depends on the WebView at runtime — it depends on the bot-verified deep-link.

## 6. Phone binding handoff (the `/start` → Mini App contract)

When a Telegram customer first messages the bot:

1. The bot webhook receives a `/start` or first message and constructs an empty session (`src/telegram/bot.ts`).
2. The bot runs `/start`'s greeting which includes a "📱 Share your phone number" contact-request keyboard (`src/telegram/types.ts` & `keyboards.ts:74`).
3. Once the customer shares their contact, `handleContact` (`bot.ts:393`) calls `api.users.upsertUser({ telegramId, phone, name? })` (`convex/users.ts:72`). The mutation canonicalises the phone (`replace(/[^+\d]/g, "")`), validates it, and upserts the `telegramUsers` row (`by_telegram_id` index).
4. The bot immediately persists `telegramUserId`, `phone`, and `telegramUserName` into `ctx.session` so future interactions skip the share-contact prompt.

On *any* subsequent message (`/start`, `/menu`, "Place new order", "Mini App"), the bot:

1. Calls `hydrateSessionFromProfile(ctx)` (`bot.ts:127`), a small helper that calls `api.users.getTelegramProfileForBot({ telegramId, botToken })`. The query authenticates the bot's own request via `TELEGRAM_BOT_TOKEN` and returns `{ phone, name, verifiedAt }` only when a profile already exists.
2. If a verified phone is now in the session, `/start` skips the contact keyboard and goes straight to the menu + Mini App launcher.

Because the bot persists the verified phone inside the grammY session (which is itself backed by `telegramSessions` in Convex — `src/telegram/session-storage.ts`), the customer **never has to share their phone twice** across reboots, restarts, or deploys. The Mini App's launcher URL always carries the phone and ID, so the Mini App order form is pre-filled on first paint.

## 7. Convex-backed grammY session

`createConvexStorage()` (`src/telegram/session-storage.ts`) implements the grammY `StorageAdapter<TelegramSessionData>` interface and stores every session write into the `telegramSessions` table (`convex/schema.ts:773`):

```ts
{
  read:  async (key) => { … fetchQuery(telegramSessions.getTelegramSession, { key }) … },
  write: async (key, value) => { … fetchMutation(telegramSessions.setTelegramSession, { key, data: JSON.stringify(value) }) … },
  delete: async (key) => { … fetchMutation(telegramSessions.deleteTelegramSession, { key }) … },
}
```

Properties this gives the bot:

- **Web-safe durability.** Each webhook invocation is serverless; the session state must survive across cold starts. Convex reads / writes provide that.
- **Per-chat isolation.** `sessionKey(ctx)` derives `chat:<id>` from the originating chat, so two simultaneous customers never share state.
- **Schema-flexible.** New fields can be added to `TelegramSessionData` (`src/telegram/types.ts`) without migrating stored payloads — the read path tolerates missing keys (TS still type-checks at write sites), and first-write hydration replaces the row.

The session also caches the *transient* `step`/`draft` fields used by the text-first order flow (chapter 1 of `workflows.md`). Caches are deliberately short-lived and should never be considered a source of truth.

## 8. Order-execution rounding rules

Throughout the codebase, monetary and base-unit quantities are rounded to avoid precision drift on derived projections:

- `convex/inventoryLedger.ts:43` defines a private `round(value, digits = 3)` used for every projection field. Quantity / material / sub-stock values are rounded to 3 dp; monetary values elsewhere are rounded to 2 dp.
- `convex/reconciliation.ts:36` rounds monetary loss to 2 dp.
- Mutations assert that quantity inputs are finite and positive (`convex/orders.ts` `createTelegramOrder`, `confirmOrderAndIssueJobCard`, etc.).

Every server-side guard rejects the input rather than silently clamping — a request with `NaN` or negative quantity is a *programming error* and must not produce a partial state.

## 9. What's visible to my role — quick reference

| If you are … | You can … | You cannot … |
| --- | --- | --- |
| **Owner** | Read everything; review reconciliations; clear operator batches; configure ETB rates / conversions / risk thresholds; reset a day's orders; see all monetary values. | Create or issue material requests; create customer orders; record production. |
| **Manager** | Manage orders and production; see operator-floor summaries; manage team roles; configure operational thresholds. | Review / clear operator floor batches (`reconciliation.clearance`, `reconciliation.review`); update ETB rate cards (`company_settings.update`). |
| **Admin** | Operate as a back-office Owner substitute across all surfaces; the only role besides Owner with `reconciliation.review` / `reconciliation.clearance` / `company_settings.update`. | Be the canonical financial audience for ETB monetary loss (`canViewFinancial` is Owner-only). |
| **Storekeeper** | Receive stock; issue batch to operator; record central physical counts; record exception stock-outs; view materials. | Issue a customer-facing order; modify ETB rates; review or clear operator batches. |
| **Receptionist** | Receive customer orders; copy customer-provided TIN and organization details; price and confirm payment; close orders. | Generate invoices or receipts; receive or issue raw stock; record production; review central reconciliations. |
| **Crystal Jet Operator** | Record production on the Crystal Jet 7K Series; reconcile floor stock; request new material; register offcuts and scrap. | Touch the central store; touch other operators' machines; create customer orders. |
| **Crystek Operator** | Record production on the Crystc Eco-Solvent; reconcile floor stock; request new material; register offcuts and scrap. | Touch the central store; touch other operators' machines; create customer orders. |
| **Ricoh UV Operator** | Record production on the Ricoh Flatbed UV; reconcile floor stock; request new material; register offcuts and scrap. | Touch the central store; touch other operators' machines; create customer orders. |
| **DTF Operator** | Record production on the DTF i3200; reconcile floor stock; request new material; register offcuts and scrap. | Touch the central store; touch other operators' machines; create customer orders. |
| **Laser Operator** | Record production on the CO2 Laser; reconcile floor stock; request new material; register offcuts and scrap. | Touch the central store; touch other operators' machines; create customer orders. |
| **CNC Operator** | Record production on the CNC Router; reconcile floor stock; request new material; register offcuts and scrap. | Touch the central store; touch other operators' machines; create customer orders. |

## 10. Hardening checklist for new surfaces

Whenever the codebase grows a new external surface (a new Telegram command, a new Mini App flow, a new cron, an external API key integration), the implementer must:

1. Decide which role(s) / permission(s) gate the surface.
2. Pick the *lowest* permission consistent with the workflow (e.g. don't grant `order.manage` if the new flow only needs `order.view`).
3. Wire the server through `requirePermission` / `requireRoles` / `requireAnyPermission` before any side-effect.
4. Wire the frontend mirror in `src/lib/permissions.ts` and gate every button with `can(profile, "...")`.
5. For Telegram surfaces, route any customer-facing push through `pushCustomerOrderStatus` (or its smaller sibling for non-order notifications). Never push a customer message from a path that doesn't funnel through the gated helper.
6. For Mini App surfaces, verify `initData` via `verifyTelegramInitData` *or* rely on the bot's deep-link to avoid the round-trip. Never trust a Telegram id without an `initData`-backed lookup.
7. Add a session-level cache in `TelegramSessionData` *only* when the cache is essential for UX (e.g. verified phone). Transient UI state stays in `ctx.session.step` / `ctx.session.draft`.

This checklist is the operational contract of the platform's security model. Every push that has gone before conformed to it; every future push must as well.
