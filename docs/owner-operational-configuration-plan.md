# Owner Operational Configuration: Implementation Plan

## Executive Summary

The project already has a single `systemConfigs` record, an owner operational-configuration route, and a multi-tab configuration form. The recommended implementation is to evolve that foundation into an **Owner Control Center** rather than create a second settings system. The owner should manage operational policies from one page, while the backend remains the authoritative source for every value used by inventory, production, off-cut reuse, scrap review, order expiry, notifications, and reporting.

The design should separate **policy configuration** from **material-specific overrides**. Global policies should be concise and grouped by operational outcome. Per-material values such as reorder level should remain attached to the material because they have different units and physical meanings. The owner interface should make that distinction explicit and show where each value is applied.

The implementation should be delivered in phases: first stabilize the configuration contract and ownership permissions, then build the owner-oriented UX, then migrate all consumers to named policy helpers, and finally validate with focused tests and end-to-end role checks.

## Current State and Main Gaps

The current backend stores pricing, conversion, production, waste, security, order-expiration, and scrap-allowance fields in `systemConfigs`. The mutation is guarded by `company_settings.update`, validates numeric ranges, and persists one row keyed by `default`. The current UI is an operational panel with four tabs: pricing, production, orders, and security.

The owner route at `/dashboard/owner/operational-configuration` currently displays material summaries and reorder information but does not render the editable configuration panel. The editable panel exists under the admin settings component tree even though its copy describes an owner-only workflow. This creates a navigation and ownership mismatch.

The current configuration contract also mixes several concerns. Pricing and financial valuation are stored beside production policy, security controls, order expiration, conversion rules, and per-material scrap allowances. The application already uses many of these values, but consumers do not consistently expose the policy name that they are applying. This makes future changes harder to audit.

The reorder limit requires special treatment. A single global number is not appropriate because materials use different base units. The authoritative reorder value should remain `materials.reorderAt`, configured by the owner in the material catalog. The operational configuration screen should provide a clear reorder-policy explanation and a management entry point, while the material editor should remain the place where the numeric threshold is set.

## Product Goals

| Goal | Result |
|---|---|
| Give the owner one manageable control center | The owner can find and update operational rules without navigating several unrelated settings surfaces. |
| Make configuration authoritative | Every consumer reads the active configuration or a named policy helper rather than duplicating constants or fallback logic. |
| Make risk visible | Each field explains its operational effect, valid range, unit, and affected workflow. |
| Preserve unit correctness | Reorder levels remain material-specific and are converted for package or machine views where necessary. |
| Avoid accidental disruption | Changes are validated, summarized before saving, audited, and applied with an explicit effective-time message. |
| Keep the interface simple | The first screen shows high-impact policies and status; advanced settings remain collapsible or grouped by workflow. |

## Proposed Configuration Model

### 1. Configuration domains

The persisted record can remain a single `systemConfigs` document for this iteration. The code should expose domain-shaped types and helpers so the storage shape does not dictate the UI shape.

| Domain | Proposed owner-facing settings | Scope and notes |
|---|---|---|
| Inventory control | Material reorder levels, default reorder guidance, notification behavior | The numeric reorder threshold is stored on each material because units differ. A global default may be added only for new materials and must not overwrite existing values. |
| Production control | Maximum allowed waste, standard job-card margin, maximum approved scrap limit, material-specific scrap allowances | Percentages must be bounded from 0 to 100 and displayed with examples. |
| Reusable off-cut | Minimum reusable off-cut area, optional minimum width or length if the current calculator supports them, default bleed or trim margin | The UI must distinguish “reusable off-cut threshold” from “scrap allowance.” |
| Order lifecycle | Unpaid order expiration hours, optional warning-before-expiry interval | The expiry range should be bounded and the UI should state which order statuses are affected. |
| Exception and stock risk | Admin PIN requirement, direct stock-out approval value limit, shortage notification behavior | These controls should be visually marked as high impact. |
| Material conversion | Purchase-unit conversion defaults and material-specific conversion overrides | Conversion changes affect future transactions and must not rewrite historical ledger snapshots. |
| Valuation | ETB rates and material price overrides | These are sensitive financial settings and should be separated from routine production policies. |
| Audit and governance | Updated by, updated at, change reason, revision history | The owner should be able to see the latest change and optionally expand the audit history. |

### 2. Recommended field contract

The existing names should be retained where they are already used by backend consumers. New or clarified fields should use explicit names.

| Field | Type | Suggested validation | Effective behavior |
|---|---:|---:|---|
| `maxAllowedWastePercent` | number | 0–100 | Flags production waste above the configured limit. |
| `standardWasteMargin` | number | 0–100 | Adds the standard margin to new standard job-card allocations. |
| `maxAllowedScrapLimit` | number | 0–100 | Caps approved scrap for standard job cards. |
| `minOffcutAreaSquareMetre` | number | greater than or equal to 0 | Determines the smallest off-cut that may be registered as reusable. |
| `defaultMarginSquareMetres` | number | greater than or equal to 0 | Applies the default bleed or trim allowance when no material-specific value exists. |
| `orderExpirationHours` | number | 1–168 | Determines when eligible unpaid or unconfirmed orders expire. |
| `defaultReorderLevel` | number, optional | greater than or equal to 0 | Used only as a default when creating a material; never overrides an existing material threshold. |
| `reorderAlertsEnabled` | boolean | boolean | Enables or disables low-stock notifications without changing threshold calculations. |
| `reorderAlertRoles` | array of roles, optional | permitted operational roles only | Defaults to owner, manager, admin, and storekeeper. Machine operators continue to receive their customized floor-stock view. |
| `reorderAlertCooldownHours` | number, optional | 0–168 | Prevents repeated notifications for the same unresolved low-stock condition. |
| `requireAdminPinForExceptions` | boolean | boolean | Controls exception stock-out authorization. |
| `maxDirectStockOutEtb` | number | greater than or equal to 0 | Determines when direct stock-out approval is required. |

The reorder fields should be introduced only after confirming whether a global default is needed. The current business rule should remain: **the material’s `reorderAt` is the source of truth for that material**. A global default is a creation aid, not a replacement for per-material policy.

### 3. Configuration revision and audit

Add a lightweight revision trail. The active `systemConfigs` row may continue to be updated in place, but each successful save should also create an audit record containing the actor, timestamp, changed field names, old values, new values, and an optional reason. Sensitive financial values may be redacted or summarized in the audit view.

If the existing audit table is not suitable for structured configuration changes, add a `configurationChanges` table with an index by configuration key and creation time. Do not store secrets or authentication material in this record.

## Backend Implementation Plan

### Phase A: Establish the authoritative policy contract

Create `convex/operationalConfig.ts` or an equivalent policy module containing named resolver functions. Examples include `resolveProductionPolicy`, `resolveOffcutPolicy`, `resolveOrderExpiryPolicy`, and `resolveReorderPolicy`. These functions should accept the active system configuration and return validated domain objects.

Move consumer logic toward these helpers. For example, production allocation should call the waste-margin resolver, off-cut registration should call the reusable-off-cut resolver, order automation should call the expiry resolver, and inventory views should call the reorder resolver. The purpose is to eliminate scattered field interpretation and fallback values.

Keep `materials.reorderAt` as the authoritative material-level threshold. Add helpers for central stock, package stock, and machine stock so unit conversion is performed in one place. The existing low-stock policy helper is the correct starting point for this work.

### Phase B: Expand schema and defaults safely

Add only the fields that are needed for the owner workflow. Every new field should be optional initially if existing production data may predate it. Update `DEFAULT_SYSTEM_CONFIG` with conservative defaults, document each default, and extend `ensureSystemConfig` to backfill missing values without changing existing configured values.

Recommended default behavior is:

| Policy | Default strategy |
|---|---|
| Maximum waste | Preserve the current seeded/default value. |
| Standard margin | Preserve the current default used by job-card allocation. |
| Maximum scrap | Preserve the current approved ceiling. |
| Minimum reusable off-cut | Preserve the current minimum registration size. |
| Order expiry | Preserve the current seeded value and enforce the existing maximum of 168 hours. |
| Reorder default | Leave unset unless the owner explicitly chooses a default for new materials. |
| Reorder notifications | Enabled with the current operational roles. |

Add schema validation for relationships between fields. For example, the standard waste margin should not silently exceed the maximum allowed waste policy without a visible warning, and the maximum approved scrap limit should not be accepted above 100 percent.

### Phase C: Split read and write capabilities

Keep the owner as the only role that can update the complete configuration. Decide explicitly whether admin retains access to a restricted operational subset. The current permission name `company_settings.update` should be reviewed because the current UI and backend comments use owner/admin language inconsistently.

Recommended permission model:

| Capability | Owner | Admin | Manager | Storekeeper | Machine operator |
|---|---:|---:|---:|---:|---:|
| Read operational policy summary | Yes | Yes | Limited | Relevant inventory values | Relevant machine values |
| Edit production and inventory policy | Yes | Optional, explicit subset | No | No | No |
| Edit financial valuation | Yes | No by default | No | No | No |
| Edit material reorder level | Yes | Optional, explicit subset | No | No | No |
| View configuration audit history | Yes | Optional | No | No | No |

Expose a safe read query for role-specific summaries. Do not return financial valuation fields to roles that cannot view financial data.

### Phase D: Add safe update behavior

The update mutation should validate the entire payload before writing anything. It should reject invalid numeric values, validate role lists, deduplicate arrays, confirm that material IDs still exist, and ensure that a material-specific reorder value is not negative.

Return a structured result containing the new revision timestamp, changed fields, and effective behavior summary. The UI can use this result to show a concise confirmation such as “Order expiry changed from 72 hours to 48 hours; existing orders are unaffected unless they remain eligible for expiration.”

Use optimistic UI only for local draft state. Persist changes through one explicit Save Changes action. Do not autosave high-impact operational policies.

## UI/UX Design Plan

### 1. Route and information architecture

Make `/dashboard/owner/operational-configuration` the canonical owner route. Move or reuse the existing editable `OperationalPanel` there. If the admin settings route remains, it should either redirect to the owner route for unauthorized users or render a restricted read-only view.

The page should use a two-level layout:

1. **Overview header and status strip.** Show “Configuration healthy,” the last updated time, the last updated actor, and the number of unsaved changes.
2. **Policy sections.** Show five primary cards or tabs: Inventory, Production, Reusable Materials, Orders, and Controls. Financial valuation and conversion rules should be under Advanced or Finance because they are less frequently changed and higher risk.

### 2. Recommended first-screen layout

```text
Owner Control Center
Operational rules that govern inventory, production, orders, and approvals.
Last saved: 09 Sep 2026, 18:44 by Owner                         [View history]

[Inventory health] 12 low-stock items     [Production policy] 12% max waste
[Order lifecycle] 72h expiry              [Reusable material] 0.25 m² minimum

[Inventory] [Production] [Reusable materials] [Orders] [Controls] [Advanced]

Selected section
┌───────────────────────────────────────────────────────────────┐
│ Inventory control                                             │
│ Set how the business identifies and communicates low stock.   │
│                                                               │
│ Reorder levels are configured per material because units vary.│
│ [Open material reorder levels]                                │
│                                                               │
│ Reorder alerts       [Enabled]                                │
│ Alert recipients     Owner · Manager · Admin · Storekeeper    │
│ Cooldown             [24] hours                                │
└───────────────────────────────────────────────────────────────┘

[Reset draft]                                      [Save changes]
```

The interface should keep the primary action visible on desktop and mobile. On mobile, the save bar should become sticky at the bottom after a draft change.

### 3. Field presentation rules

Every editable field should include a label, unit, valid range, and one-sentence operational explanation. Avoid exposing implementation names such as `maxAllowedScrapLimit` in the UI.

| Backend concept | UI label | Help text example |
|---|---|---|
| `maxAllowedWastePercent` | Maximum reported waste | “Production records above this percentage are flagged for review.” |
| `standardWasteMargin` | Standard job margin | “Added to new standard job-card material allocation.” |
| `maxAllowedScrapLimit` | Maximum approved scrap | “Caps scrap that may be approved against a standard job.” |
| `minOffcutAreaSquareMetre` | Minimum reusable off-cut | “Smaller remnants are recorded as scrap instead of reusable stock.” |
| `orderExpirationHours` | Unconfirmed order expiry | “Eligible unpaid or unconfirmed orders expire after this many hours.” |
| `reorderAt` | Reorder level | “The low-stock alert starts when on-hand stock reaches this value.” |

Numeric fields should reject invalid values inline, preserve precision appropriate to the unit, and show a warning before saving when a change has broad operational impact.

### 4. Draft, dirty-state, and confirmation behavior

The page should maintain a local draft initialized once from the active configuration. It should show a “Draft changes” indicator when values differ from the server. Navigating away with unsaved changes should trigger the existing application-level leave guard if one is available.

Before saving, show a compact change summary rather than a modal for every field. High-impact changes should receive a warning row. Examples include lowering the maximum scrap limit, shortening order expiry, disabling reorder notifications, or changing conversion defaults.

After saving, show the effective timestamp, updated actor, and changed sections. The page should refresh the active configuration and clear the dirty state only after the mutation succeeds.

### 5. Reorder-management UX

Do not place one global reorder number beside all materials. Instead, make the Inventory section explain the unit rule and provide a clear “Manage material reorder levels” action. That action should open the existing material list or a dedicated searchable table with:

| Material | Unit | On hand | Reorder level | Status | Action |
|---|---|---:|---:|---|---|
| Banner vinyl | m² | 18 | 25 | Low stock | Edit |
| White ink | L | 3.2 | 5 | Low stock | Edit |

The owner should be able to edit reorder values inline or through the material modal. The table should display whether the value is inherited from a default or explicitly configured. Existing explicit values must never be overwritten by changing a default.

### 6. Accessibility and visual design

Use the existing shared UI primitives, typography, spacing, border, and color tokens. The design should use color as a secondary signal and include text labels such as “Healthy,” “Needs attention,” and “High impact.” Every input needs an accessible label and error message. Tabs must be keyboard navigable, and the sticky save bar must not obscure focused content.

## Consumer Migration Map

| Consumer | Required change |
|---|---|
| Standard job-card allocation | Read standard margin and scrap ceiling through a policy resolver. |
| Production waste validation | Read maximum waste through the same resolver. |
| Off-cut registration | Read minimum reusable off-cut and margin through the off-cut resolver. |
| Order expiration cron or mutation | Read expiration hours through the order-expiry resolver. |
| Central inventory low-stock alerts | Use material `reorderAt` through the shared low-stock policy. |
| Storekeeper package inventory | Convert material reorder level through the shared package policy. |
| Machine operator stock | Convert the same material threshold to floor units; retain operator-specific presentation only. |
| Admin, manager, and owner dashboards | Consume the same alert predicate and avoid local threshold comparisons. |
| Reports and forecast | Use the same policy predicate for urgency and reorder counts. |
| Configuration page | Display active values, effective timestamp, and changed-field audit information. |

## Testing Strategy

### Unit tests

Add tests for policy resolvers and validation relationships. The test suite should cover valid values, lower and upper bounds, missing legacy fields, default backfilling, and rejection of invalid combinations.

Add tests that prove the same reorder policy produces the same result for central stock, package stock, and machine stock after conversion. Include zero-threshold behavior and conversion ratios that are missing or invalid.

### Backend integration tests

Test the update mutation with owner, admin, manager, storekeeper, and operator identities. Verify that only the intended roles can write each domain. Verify that unauthorized reads do not expose financial configuration.

Test that configuration changes affect only the intended future behavior. For example, an order-expiration change should not rewrite historical order timestamps, and conversion changes should not rewrite historical inventory ledger snapshots.

Test that a successful update creates a configuration audit record and that a failed validation creates no partial update.

### UI tests

Add component tests for initial hydration, draft changes, validation errors, reset behavior, save success, save failure, and unsaved-change indicators. Add an accessibility smoke test for labels, keyboard navigation, and focus behavior.

### Manual acceptance checks

An owner can change each policy, save it, reload the page, and see the persisted value. A manager or storekeeper can see relevant operational status but cannot change the policy. A machine operator sees the converted material threshold and does not receive a percentage-based fallback alert. Dashboard counts, notifications, reports, and inventory tables remain consistent after a threshold change.

## Delivery Plan

### Milestone 1: Contract and permission alignment

Confirm the final field list, default values, role capabilities, and whether admins retain any write access. Add domain types, defaults, backfill logic, validation helpers, and configuration audit persistence. Do not change the UI in this milestone.

### Milestone 2: Canonical owner route

Move the editable panel into the owner operational-configuration route. Reuse the current form state and section components, then rename sections and labels for owner-facing language. Add the status strip, dirty-state handling, reset action, and change summary.

### Milestone 3: Policy consumer migration

Replace direct field interpretation with policy resolvers in production, off-cut, orders, inventory, alerts, dashboards, and reports. Keep behavior unchanged unless the owner changes a value. Add focused backend tests for each migrated consumer.

### Milestone 4: Reorder management

Add the owner material reorder table or connect the configuration page to the material editor. Clearly distinguish per-material reorder levels from global defaults. Add bulk review, search, status filtering, and unit-aware validation only if the existing material volume justifies it.

### Milestone 5: Verification and rollout

Run `pnpm check`, `pnpm vitest run`, and the relevant build or route checks. Exercise each role manually. Review the configuration audit trail. Merge only after the owner route, role restrictions, migration behavior, and dashboard consistency are verified.

## Acceptance Criteria

The implementation is complete when the following conditions hold:

1. The owner has one canonical, clean configuration page for operational policies.
2. The backend has one validated active configuration and named policy resolvers.
3. Existing configuration rows are safely backfilled without destructive changes.
4. The owner can configure maximum scrap, standard margin, minimum reusable off-cut, order expiration, exception controls, and other approved operational parameters.
5. Reorder levels remain unit-aware and material-specific, with the owner able to manage them from the configuration workflow.
6. Storekeeper, manager, admin, and owner low-stock behavior uses the same source of truth.
7. Machine operators receive only the intended unit-converted customization.
8. Successful changes are auditable and failed changes are atomic.
9. The UI provides clear units, ranges, explanations, dirty-state feedback, and accessible errors.
10. Type checking and the complete Vitest suite pass before merge.

## Open Decisions Before Implementation

The following decisions should be confirmed during implementation kickoff because they materially affect behavior:

| Decision | Recommended default |
|---|---|
| Should admins be able to edit operational policies? | Owner only for the complete set; optionally grant admins a narrowly defined operational subset later. |
| Should there be a global reorder default? | Yes only as a creation default; existing material values remain authoritative. |
| Should reorder alerts be disable-able? | Yes, but show a high-impact warning and retain dashboard status calculations. |
| Should configuration changes apply immediately? | Yes for new calculations and future events; never rewrite historical ledger snapshots. |
| Should financial valuation remain on the same page? | Keep it under Advanced or Finance with a separate visual warning. |
| Should the owner see full revision history? | Yes, with field-level summaries and sensitive-value redaction where necessary. |

## References

[1]: https://github.com/yoh-space/yt-ads "yt-ads project repository"

[2]: https://github.com/yoh-space/yt-ads/blob/main/convex/systemConfigs.ts "Current system configuration backend"

[3]: https://github.com/yoh-space/yt-ads/blob/main/src/app/%28dashboard%29/dashboard/owner/operational-configuration/page.tsx "Current owner operational configuration route"

[4]: https://github.com/yoh-space/yt-ads/blob/main/src/components/dashboard/roles/admin/settings/operational/operational-panel.tsx "Current operational configuration panel"
