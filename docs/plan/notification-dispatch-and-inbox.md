# Notification Dispatch and Role-Scoped Inbox Implementation Plan

**Status:** Proposed for approval — no implementation changes are included in this plan.

**Repository baseline reviewed:** `yoh-space/yt-ads`, latest `main` at commit `7e21e91`.

## 1. Objective

Replace the current mixed notification behavior with a single, explicit notification policy that combines **role-based access** and **attribute-based scope**. The system must deliver and display only notifications relevant to a user’s operational responsibility, while preserving management visibility where appropriate.

The target behavior is:

- **Receptionist:** order lifecycle notifications only.
- **Storekeeper:** stock-in, stock-out, reorder/low-stock, and material-request notifications; no order, production, account, or unrelated management notifications.
- **Machine operators:** notifications for their own machine role and assigned machine scope, including material requests, stock handover/clearance, production/job updates, machine updates, reconciliation outcomes, and relevant stock exceptions.
- **Owner, manager, and admin:** broad operational visibility according to the management policy, with owner/admin authority retained and financial visibility unchanged.

This plan covers backend dispatch, secure read filtering, category-aware UI, unread counts, marking read, tests, and rollout. It does not include the Phase 2 ink deduction engine.

## 2. Current Architecture Findings

The latest `main` branch already contains several useful building blocks:

1. `convex/notificationHelpers.ts` provides `notifyUser` and `notifyRoles`. Dispatch currently accepts an explicit list of roles and inserts one row per active user.
2. `convex/notifications.ts` already applies a second-layer visibility filter. It recognizes management roles, storekeeper inventory types, receptionist order types, and operator machine context. Operator access also checks `assignedMachineIds`.
3. `convex/schema.ts` stores notification rows with a single `type`, title, message, actor, related table/id, creation timestamp, and read timestamp. Indexes exist for recipient plus creation time and recipient plus read state.
4. `src/components/dashboard/modals/notification-modal.tsx` already provides All, Orders, Inventory, Operations, and Account tabs, but the category list is static and does not adapt to the role. It currently filters the rows already returned by the backend.
5. `src/components/dashboard/shell/topbar.tsx` loads the notification list and unread count globally for the active profile and opens the modal from the notification bell.
6. `src/shared/role-permissions.ts`, `convex/authorization.ts`, and the owner-authority update provide a shared RBAC source and machine-scope attributes. Operator users can have optional `assignedMachineIds`.
7. Notification call sites are distributed across orders, inventory, material requests, reconciliation, job/production flows, and user/team administration. Some currently send to broad role lists, for example order events to owner/manager/admin plus a machine role, and material requests to owner/manager/admin/storekeeper.

The key architectural issue is that **dispatch policy is distributed at call sites**, while **visibility policy is centralized but inferred from notification type and related records**. The implementation should make the central policy authoritative and keep call sites declarative.

## 3. Proposed Policy Model

### 3.1 Notification domains

Introduce a canonical notification domain separate from the existing event `type`:

| Domain | Existing notification types | Intended audience examples |
| --- | --- | --- |
| `orders` | `order_received`, `order_status`, `overdue_order` | Reception, management, assigned machine operator when production-relevant |
| `inventory` | `material_request`, `material_issue`, `material_received`, `short_stock`, `material_overuse`, `discrepancy`, `exception_stock_out` | Storekeeper, relevant operator, management according to policy |
| `operations` | `job_update`, `machine_update`, `clearance_granted`, `clearance_rejected` | Relevant operator, management |
| `account` | `account_update` | Target user only, with management visibility only if explicitly needed |

The domain should be derived from the type in one shared policy module rather than passed inconsistently by each caller. Existing types remain stable to avoid a destructive data migration.

### 3.2 Role policy

The initial policy should be explicit and reviewable:

| Role | Allowed domains | Attribute constraints | Exclusions |
| --- | --- | --- | --- |
| Owner | Orders, inventory, operations, account | Workspace-wide | None, except self-suppression and existing financial rules |
| Manager | Orders, inventory, operations, account | Workspace-wide | No new financial exposure; preserve existing manager authority boundaries |
| Admin | Orders, inventory, operations, account | Workspace-wide | Preserve admin authority and existing financial visibility rules |
| Receptionist | Orders | Workspace-wide order queue | Inventory, operations, account, reconciliation, stock exceptions |
| Storekeeper | Inventory | Workspace-wide central stock and material-request scope | Orders, machine operations, account, unrelated reconciliation events |
| Machine operator roles | Inventory and operations; selected order updates | `related machine.operatorRole === profile.role`; if `assignedMachineIds` exists, machine must be assigned; direct recipient events remain allowed | Other machines, central-only events, unrelated orders, management/account events |

The exact manager/admin treatment of account and exception notifications should remain consistent with the existing management policy. The main user-requested restriction is that non-management operational roles must not receive unrelated categories.

### 3.3 Attribute-based targeting

Each notification should be evaluated against a normalized context:

- `workspace` — current deployment/workspace, implicit in the authenticated Convex database.
- `recipientAuthUserId` — exact target when a notification is user-specific.
- `machineId` and `machineRole` — resolved from `relatedTable` and `relatedId` where applicable.
- `assignedMachineIds` — optional operator scope from the user profile.
- `materialId` / `requestId` / `jobCardId` / `orderId` — related business entity for display and future filtering.
- `audience` — an explicit policy target such as `ROLE`, `USER`, `MACHINE_ROLE`, or `MACHINE_ASSIGNMENT`.

A notification is visible only if both the role/domain rule and the attribute rule pass. This prevents a machine operator from seeing another operator’s job, stock, request, or clearance notification even when the type is otherwise allowed.

## 4. Backend Design

### 4.1 Central policy module

Create a shared backend policy module, for example `convex/notificationPolicy.ts`, containing:

- Notification type-to-domain mapping.
- Role-to-domain mapping.
- Audience/target types.
- A pure `canReceiveNotification(profile, notification, context)` function.
- A `getNotificationCategoriesForRole(role)` function used by the frontend contract.
- A normalization helper that derives machine context from the related record.

The module should be imported by both notification dispatch and notification queries. It must not depend on UI code.

### 4.2 Dispatch API

Refactor `notifyRoles` into a policy-aware dispatcher while keeping a compatibility wrapper during migration:

```ts
notifyByPolicy(ctx, {
  type,
  title,
  message,
  actorAuthUserId,
  relatedTable,
  relatedId,
  audience,
  targetUserId?,
  targetRole?,
  machineId?,
  cooldownHours?,
})
```

Recommended dispatch behavior:

1. Resolve the related context once.
2. Select candidate users by audience rather than by arbitrary caller-supplied roles.
3. Run the same centralized policy predicate used by reads.
4. Suppress the actor as today.
5. Apply cooldown/idempotency before inserting.
6. Insert only recipients who pass the policy.

The dispatcher must fail closed when a machine-scoped notification lacks enough context to prove the target machine. It must not broadcast a machine event merely because the caller included an operator role.

### 4.3 Call-site migration

Migrate notification producers by business domain:

- **Orders:** receptionist order queue events; production handoff events to the relevant machine operator plus management; overdue order events to reception and the configured management audience.
- **Inventory:** central stock-in/out and low-stock/reorder events to storekeeper plus configured management audience; material requests to storekeeper and the requesting/target machine operator as appropriate; issue/receive/clearance events to the affected operator and storekeeper where operationally relevant.
- **Operations:** job status, machine status, production overuse, reconciliation, clearance, and exception events to the relevant machine scope and management audience.
- **Account:** role/access/machine-scope updates only to the affected user; do not broadcast account changes to reception, storekeeping, or operators.

Existing call sites that call `notifyRoles` should either be converted or temporarily route through a compatibility function that translates the old role list into a policy audience. No caller should be able to bypass the central predicate.

### 4.4 Data model and migration

Prefer additive, backward-compatible schema changes:

- Add optional fields such as `domain`, `audience`, `machineId`, `materialId`, or `targetUserId` only if the existing `relatedTable`/`relatedId` context cannot reliably provide them.
- Keep `type`, `relatedTable`, and `relatedId` for existing rows and deep-link/display resolution.
- Add an idempotent migration that backfills `domain` from `type` if the field is introduced.
- Do not delete historical notifications solely because they are no longer visible to a role; secure queries should filter them. A later retention policy can be considered separately.
- Preserve the existing recipient and creation indexes. Add a domain index only if query profiling shows it is needed; role-based filtering should not require scanning other users because recipient is already indexed.

### 4.5 Query and mutation security

Update `list`, `unreadCount`, `markRead`, and `markAllRead` to use the same policy function. The current implementation already performs server-side filtering; this must remain authoritative.

Recommended query contract:

```ts
notifications.list({ category?: NotificationCategory })
notifications.unreadCount({ category?: NotificationCategory })
```

The optional category should be validated against the role’s allowed categories. An unauthorized category must return an empty result or a validation error without exposing counts. `markRead` and `markAllRead` must also reject or ignore notifications outside the caller’s policy scope.

## 5. Frontend Notification Inbox Design

### 5.1 Role-aware tabs

Replace the static all-category tab list with categories returned by the authenticated profile’s allowed notification domains. Suggested tabs:

- Receptionist: **All**, **Orders**.
- Storekeeper: **All**, **Inventory**.
- Machine operator: **All**, **Inventory**, **Operations**; optionally **Orders** only if production-handoff order events are intentionally exposed to operators.
- Owner/manager/admin: **All**, **Orders**, **Inventory**, **Operations**, **Account**.

A category with zero current rows may remain visible if it is relevant to the role, or may be hidden based on the final UX decision. The first implementation should keep role-relevant tabs visible so users understand their notification scope.

The UI must not infer security from hidden tabs. Backend filtering remains mandatory.

### 5.2 Modal and list behavior

Extend the existing `NotificationModal` rather than creating a parallel notification surface:

- Receive the role-allowed category list from the backend or a shared role policy.
- Keep tab counts role-scoped and preferably unread-aware, with total counts clearly labeled if retained.
- Support category selection without allowing unauthorized category values.
- Preserve mark-one-read and mark-all-read behavior within the active role-visible scope.
- Keep the current attention/success visual treatment.
- Add an optional empty state that names the user’s operational scope, such as “No inventory notifications for your storekeeper workspace.”
- Keep the recent-activity strip in the topbar limited to the same role-visible notification feed.

### 5.3 Loading and consistency

The topbar currently loads all notifications and derives the first three activity items client-side. The implementation should either:

1. Keep this behavior and rely on the secure server list, or
2. Add a small `recent` query contract if list payload size becomes a concern.

Do not load unrelated recipients or categories to the browser. Prefer server-side category filtering for large histories, while maintaining the existing maximum page size.

## 6. Testing Strategy

Add tests at four levels:

### 6.1 Policy unit tests

Test every role/domain combination, including:

- Receptionist sees order types and rejects inventory/operations/account.
- Storekeeper sees inventory types and rejects order/operations/account.
- Operators see only their machine role and assigned machine IDs.
- Operators without an explicit machine assignment retain the current role-wide machine behavior only if that is approved; otherwise fail closed.
- Management roles preserve broad visibility.
- Direct account notifications are visible only to the target user unless an explicit management rule says otherwise.
- Missing or stale related records do not accidentally broaden access.

### 6.2 Dispatch tests

Verify candidate selection and insert behavior:

- No duplicate recipient rows when multiple targeting rules overlap.
- Actor suppression remains intact.
- Cooldown/idempotency prevents repeated alerts.
- Machine-scoped dispatch never broadcasts to another machine role.
- Central stock alerts reach storekeeper and configured management roles but not reception or operators unless explicitly targeted.

### 6.3 Convex integration tests

Cover `list`, `unreadCount`, `markRead`, and `markAllRead` with seeded users and notifications across each role. Verify unauthorized notification IDs behave as not found and category filters cannot bypass server policy.

### 6.4 UI tests

Add component tests for:

- Role-specific tab lists.
- Correct category filtering and counts.
- Mark-all-read operating only on visible notifications.
- Empty states and loading behavior.
- Accessibility semantics for tabs, labels, and modal controls.

## 7. Rollout Sequence

1. Add the central policy types and pure predicate with no call-site behavior change.
2. Add policy-focused tests against the current notification types and related-table resolver.
3. Refactor notification queries/mutations to use the central predicate and optional category filtering.
4. Refactor dispatch helpers with a compatibility path for existing call sites.
5. Migrate order, inventory, material-request, operator, reconciliation, and account call sites domain by domain.
6. Add role-aware category metadata to the frontend and update the existing modal/topbar.
7. Run the full test suite, TypeScript validation, and a manual role matrix review using representative accounts.
8. Deploy the additive schema/migration if fields are introduced, verify historical notification visibility, and monitor duplicate/missing delivery.
9. Remove the compatibility dispatcher only after all call sites are migrated and production behavior is verified.

## 8. Acceptance Criteria

The implementation is ready for approval to deploy when:

- A receptionist cannot query, count, mark, or view inventory, operations, or account notifications.
- A storekeeper cannot query, count, mark, or view order, operations, or unrelated account notifications.
- An operator cannot view another machine’s notifications and cannot expand scope by manipulating category parameters.
- Central stock-in/out, reorder/low-stock, and material-request notifications reach storekeeper users according to the agreed policy.
- Order notifications reach receptionist users according to the order lifecycle policy.
- Category tabs shown in the modal match the authenticated role’s allowed domains.
- Unread counts match the same server-filtered scope as the list.
- Mark-read operations cannot mutate another user’s or an unauthorized notification.
- Existing owner-authority and financial visibility behavior remains unchanged.
- All existing tests plus new role/attribute notification tests pass, and `pnpm check` passes.

## 9. Approval Decisions Requested Before Implementation

Please approve or adjust these policy choices before implementation begins:

1. **Machine operators and order notifications:** Should operators receive only the production-handoff `order_status` events for their assigned machine, or no order-category tab at all?
2. **Storekeeper reconciliation:** Should storekeepers receive central stock reconciliation/exception notifications, or only stock-in/out, reorder/low-stock, and material-request events?
3. **Management visibility:** Should owner, manager, and admin continue seeing all operational/account categories, or should account notifications remain target-user-only for everyone except owner/admin?
4. **Unassigned operators:** Should an operator with no `assignedMachineIds` see all machines for their role as today, or should machine notifications fail closed until a machine is assigned?
5. **Category counts:** Should tabs show total matching notifications, unread matching notifications, or both?
6. **Historical rows:** Should the rollout retain old notifications and filter them by the new policy, or should it archive/delete rows that are no longer relevant? The recommended default is retain and filter.

## 10. Recommended Initial Decisions

To minimize disruption while tightening delivery, the recommended defaults are:

- Operators receive production-handoff order status only when the event is linked to their assigned machine; no general Orders tab.
- Storekeepers receive inventory events including material requests, stock issue/receipt, short stock/reorder, discrepancy, and stock exceptions that concern store operations; operator-only clearance events remain machine-scoped.
- Owner, manager, and admin retain broad operational visibility; account updates remain target-user-only except for explicit audit/management views.
- Operators without `assignedMachineIds` retain role-wide machine visibility during the compatibility window, with a follow-up migration/report to require explicit scope.
- Tabs show unread counts, while the modal header shows the total unread count.
- Historical notification rows are retained and filtered server-side.

**Approval gate:** No implementation work should begin until the requested decisions are confirmed or amended.
