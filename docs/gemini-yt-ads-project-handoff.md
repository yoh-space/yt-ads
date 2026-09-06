# Gemini Handoff Prompt: YT Advertisement Operations Control

## How to use this document

Copy this entire document into Gemini before asking it to modify the `yt-ads` repository. Assume Gemini has **no prior knowledge** of the project. It should use this document as business and implementation context, then inspect the repository itself before changing code.

> **Important operating rule:** Treat this document as a handoff baseline, not as permission to invent data or redesign the product. Preserve verified business facts, keep operator workflows small, enforce authorization in Convex, and ask for clarification when a requirement is ambiguous.

---

## 1. Your role as the incoming engineering agent

You are taking over an existing Next.js and Convex application for **YT Advertisement**, an advertising and printing workshop. Your first responsibility is to understand the current codebase and distinguish three categories of information:

| Category | Meaning | Required treatment |
|---|---|---|
| Confirmed business input | Information directly captured from the workshop or explicitly confirmed later by the owner | Preserve it and use it as master-data requirements. |
| Implemented behavior | Functionality already present in the repository | Inspect before modifying; avoid duplicating or breaking it. |
| Open question or assumption | Information that is missing, provisional, or mapped for technical compatibility | Keep it visibly provisional and do not present it as confirmed fact. |

Before making a substantial change, inspect the current branch, package scripts, schema, authentication configuration, dashboard shell, relevant Convex modules, and existing documentation. Use the actual repository as the final authority for implementation details when it differs from this handoff.

Do not expose, copy, or commit credentials, access keys, session identifiers, temporary passwords, OAuth secrets, or deployment secrets. Do not create fake historical activity, fake inventory balances, fake production logs, or fake authenticated users merely to make the interface look complete.

---

## 2. Current project identity and release state

### 2.1 Business identity

| Field | Current value |
|---|---|
| Company | **YT Advertisement** |
| Industry | Advertising and printing; source label: `ማስታወቂያ እና ማተሚያ` |
| Workshop location | `የድርጅት አድራሻ ጀሞ ካፍደም ህንጻ` |
| Contact phone captured in requirements | `0951082102` |
| Implementation partner | **YoTech Digitals** |
| Owner | **Yitbarek** |
| General manager name captured in the original workspace form | **Yordanos** |
| Existing communication channels | Telegram groups and WhatsApp groups; these are not application records |

Yitbarek is the confirmed business owner and should have the application `owner` role. The owner oversees the whole activity, assigns and revokes roles, can delegate team-access management to a manager, can activate or deactivate application profiles, and can update company branding such as the company name and logo URL.

The real owner account uses the email address `ytadvert@admin.org`. The temporary bootstrap password is intentionally **not included** in this handoff. It must be supplied only at runtime to the explicit owner-bootstrap mutation and changed immediately after first sign-in. Never place that password in source code, Markdown, JSON, Git history, logs, screenshots, or prompts.

### 2.2 Repository and release state

| Field | Value |
|---|---|
| Repository | `https://github.com/yoh-space/yt-ads` |
| Local project root | `/home/ubuntu/yt-ads` |
| Default branch | `main` |
| Current checked-out commit | `1004916` — `feat(ui): add global error boundary and loading states` |
| Current remote relationship | Local `main` was synchronized with `origin/main` at the same commit when this handoff was prepared |
| Recent merged feature | Pull request #7 added owner controls, targeted notifications, account settings, Google OAuth support, and profile management |
| Current local-only artifact | `docs/yt-advertisement-requirements-analysis.json` is an improved, sanitized requirements artifact and may be uncommitted; check `git status` before making changes |

The codebase is a working prototype/early production slice, not a fully completed ERP. It is buildable and type-safe locally, but it still requires authenticated Convex deployment configuration and end-to-end smoke testing with real users and data.

### 2.3 Stack and package commands

| Concern | Current implementation |
|---|---|
| Web framework | Next.js 15 App Router |
| UI runtime | React 19 and TypeScript |
| Database/backend | Convex reactive queries and mutations |
| Authentication | Better Auth through the Convex Better Auth component |
| Styling | Global CSS in `src/app/globals.css`; no utility CSS framework is the main design system |
| Icons | `lucide-react` |
| Tests | Vitest |
| Package manager | pnpm |

Available package scripts:

```bash
pnpm dev
pnpm build
pnpm start
pnpm check
pnpm test
```

The standard verification sequence is:

```bash
pnpm test
pnpm check
NODE_ENV=production pnpm build
git diff --check
```

The validated suite currently contains **13 passing tests** across confirmed unit conversion and production quantity validation. There is not yet a full Convex integration-test harness.

---

## 3. Raw workshop requirements and business analysis

### 3.1 Main pain points and desired outcomes

The original workspace capture identified these needs:

| Requirement or pain point | Interpretation for the product | Priority |
|---|---|---:|
| Monthly audit | Management needs a reviewable monthly view of jobs, stock activity, production, recovery, and audit events | P0 |
| Daily report | Management needs a daily operational summary | P0 |
| Store requisition | The original form mentioned a signed requisition, but this was later intentionally simplified | P0 |
| Job order tracker | Track, prioritize, assign, and complete customer work | P0 |
| Regular job-card usage | Job cards are already familiar and should remain the central execution record | P0 |
| Stock reconciliation | Management needs visibility into request, issue, receipt, consumption, return, scrap, and remaining balances without forcing a heavy operator workflow | P0 |
| Telegram/WhatsApp | Existing communication channels should remain external communication channels; the application becomes the operational system of record | P1 |

### 3.2 Confirmed workflow decisions

The normal material process must remain intentionally small:

```text
Requested → Issued or Partially Issued → Received
```

Exception states are:

```text
Short Stock
Discrepancy
```

Normal material requests do **not** require mandatory manager approval, a signed store requisition, a recipient signature, or signature evidence. Do not reintroduce a multi-step approval process unless the owner explicitly requests it for a special exception workflow.

The broader target job lifecycle is conceptually:

```text
Draft → Submitted → Approved → Planned → Materials Requested → Materials Issued → In Production → Quality Check → Ready for Delivery → Delivered → Closed
```

The currently implemented job status vocabulary is smaller:

```text
Queued | In production | Completed | Paused
```

The currently implemented production operation records input, good output, waste, operator, machine, and timestamp. The application does not yet implement the full quality-check, delivery, rework, or immutable correction model described in the long-term plan.

### 3.3 Business principles for future work

1. **Keep normal operator workflows minimal.** One clear action is better than a formal approval chain when the requirement does not demand the extra control.
2. **Use the backend as the security boundary.** Hiding buttons is not authorization.
3. **Never manufacture history.** Master data can be seeded from confirmed requirements; production logs, stock movements, scraps, offcuts, requests, and jobs must come from real activity or explicit test fixtures.
4. **Keep units honest.** Inventory separates purchase units from normalized base units and applies only confirmed conversion ratios; a roll, litre, piece, metre, and square metre cannot be added together without a verified rule.
5. **Preserve traceability.** Important mutations should identify the actor and timestamp, and notifications should target relevant users rather than indiscriminately notifying everyone.
6. **Treat assumptions as provisional.** Machine model numbers, staff-to-application-role assignments, roll lengths, opening balances, and some machine meanings still require owner confirmation.

---

## 4. Raw machine input and current application mapping

The original capture provided eight workshop equipment records. The four Crystal manufacturer confirmations below were explicitly confirmed later by the owner and must remain treated as confirmed manufacturer data for application master data.

### 4.1 Machine roster

| Raw machine name | Code | Model | Capability | Manufacturer | Base/display unit | Current application mapping |
|---|---|---|---|---|---|---|
| Large Format Banner Printer | `BAN-01` | `3.2m Eco-Solvent / Solvent Printer` | `3.2m Print Width` | Pending | `m²` | `printer_operator` |
| DTF Printer | `DTF-01` | `60cm Roll-to-Roll DTF` | `0.60m Print Width` | **Crystal confirmed** | `m` | `printer_operator` |
| Print & Cut Eco-Solvent Plotter | `PAC-01` | `1.6m Print & Cut Plotter` | `1.6m Width` | **Crystal confirmed** | `m²` | `plotter_operator` |
| CNC Router 2030 | `CNC-01` | `2000mm x 3000mm Heavy Duty` | `2.0m x 3.0m Bed Size` | Pending | `m²` | `cnc_operator` |
| Laser Cutter 1325 | `LAS-01` | `1300mm x 2500mm CO2 Laser` | `1.22m x 2.44m Standard Board` | **Crystal confirmed** | `m²` | `laser_operator` |
| Pneumatic / Manual Heat Press | `HPR-01` | `Flatbed Heat Press` | `40cm x 60cm Platen` | Pending | `pcs` | `printer_operator` |
| Paper Guillotine Cutter (Conca) | `CON-01` | `Heavy Duty Paper Cutter` | `A3+ Cutting Width` | Pending | `pcs` | `printer_operator`; local meaning still needs confirmation |
| UV Flatbed Printer | `UVF-01` | `Industrial UV Flatbed` | `Direct-to-Rigid Board` | **Crystal confirmed** | `m²` | `printer_operator` |

### 4.2 Important role-mapping caveat

The schema currently supports these roles:

```text
owner
manager
admin
storekeeper
laser_operator
cnc_operator
plotter_operator
printer_operator
```

The revised prompt supplies technical mappings for all eight machines. Print and Cut maps to `plotter_operator`, DTF and UV Flatbed map to `printer_operator`, CNC maps to `cnc_operator`, Laser maps to `laser_operator`, and Heat press/Conca use `printer_operator` with `pcs` pending further operational confirmation. These are machine-role mappings, not proof that the named staff accounts have already been created or assigned.

### 4.3 Seeded machine behavior

The requirement-based seed initializes all eight machines as `Available` and active, because no historical operating status was supplied. It does not invent active jobs, production logs, machine utilization, or maintenance history. The codes are provisional application codes generated for system uniqueness; they were not supplied by the workshop.

---

## 5. Raw material input and inventory master data

The source capture contains **26 materials**. The application seed preserves the captured names and Amharic display-unit labels while using the current schema’s normalized units for calculation.

### 5.1 Material roster and unit decisions

| # | Material | Captured/display unit | Purchase unit | Base unit | Ratio | Physical basis or note |
|---:|---|---|---|---|---:|---|
| 1 | Banner | `ሮል` | `roll` | `m²` | 160 | `3.2m × 50m` |
| 2 | DTF Film | `ሮል` | `roll` | `m` | 100 | `0.60m × 100m`; Store; running metres |
| 3 | Acrylic | `ቁጥር` | `sheet` | `m²` | 2.977 | `1.22m × 2.44m` |
| 4–7 | DTF Ink, Banner Ink, Print and Cut INK, UV Flat bed Ink | `ሊትር` | `liter` | `L` | 1 | Direct litre count |
| 8 | LED | `ቁጥር` | `pack` | `pcs` | 20 | Pack of 20 modules |
| 9–13 | Normal, Frosted, Transparent, Reflective, Mush Sticker | `ሮል` | `roll` | `m²` | 63.5 | `1.27m × 50m`; prompt conversion rule calls Mush “Mesh” |
| 14 | Mica | `ቁጥር` | `piece` | `pcs` | 1 | Direct count |
| 15 | PVC Film | `ሮል` | `roll` | `m²` | Pending | Physical roll dimensions not confirmed; roll receipt is blocked |
| 16 | Canvas | `ሮል` | `roll` | `m²` | 45.6 | `1.52m × 30m` |
| 17 | Neon Light | `ሜትር` | `roll` | `m` | 5 | Roll of 5m |
| 18–26 | Power Supply, Foam, AMIR, ROLE UP DELUX, ROLE UP STANDARD, VINNER, ZOCOLO, LED LIGHT BOX A1/A2 | `ቁጥር` | `piece` or `sheet` | `pcs` or `m²` | 1 or 2.977 | Direct counts; Foam uses `1.22m × 2.44m` sheet ratio |

### 5.2 Inventory safety rules

The revised schema separates `purchaseUnit`, `baseUnit`, and `conversionRatio`. Stock-in converts the purchase quantity into the normalized base balance; production consumes base units directly. Confirmed ratios are Banner 160, DTF Film 100, Acrylic 2.977, sticker rolls 63.5, Canvas 45.6, LED packs 20, Neon Light rolls 5, Foam sheets 2.977, and direct-count/liquid items 1. PVC Film intentionally has no ratio until its physical roll dimensions are confirmed.

The requirement-based seed still uses `quantity: 0` and `reorderAt: 0`. These are safe placeholders, not physical stock claims or approved reorder policies. Before live use, the storekeeper and owner must enter verified opening quantities and thresholds. The UI does not treat a zero reorder threshold as a low-stock alert.

---

## 6. Staff and ownership context

The capture contains business staff names and responsibilities. Most of these are stored as business-context `staff` records, not automatically as authenticated users. Application accounts should be created through Better Auth and then assigned by the owner or delegated manager.

| Person | Captured business context | Material handling | Application treatment |
|---|---|---|---|
| Yitbarek | Owner; whole-activity oversight and access/company settings | Owner responsibility | Real owner account at `ytadvert@admin.org`; temporary password is runtime-only |
| Yordanos | Management / general manager; staff oversight | No | `manager` application-role context; authentication account still requires onboarding |
| Zewuditu | Storekeeper; `እቃ ተቀባይ እና አከፋፋይ` | Yes | `storekeeper` application-role context; authentication account still requires onboarding |
| Debas melaku | Print and Cut operator, Crystal | Yes | `plotter_operator` application-role context; authentication account still requires onboarding |
| surafel | UV Flat bed operator | Yes | `printer_operator` application-role context; authentication account still requires onboarding |
| SAMUEL GETE | Banner machine operator | Yes | `printer_operator` application-role context; authentication account still requires onboarding |
| Addisu | CNC and Laser Operator | Yes | Both `cnc_operator` and `laser_operator` application-role context; authentication account still requires onboarding |
| Niguse | Relief Coordinator | Yes | Staff context; role model pending |
| abriham | Relief staff | Yes | Staff context; role assignment pending |
| haymanot | Relief staff | Yes | Staff context; role assignment pending |
| Yohannes | Relief Staff | Yes | Staff context; role assignment pending |
| Emebet | Direct sales / customer services; main position customer services | No | Staff context; customer-service role is not yet a dedicated schema role |

Do not assume that the names above are authorized application accounts. The current seed creates 12 staff-context records, including Yitbarek’s owner-context record. It does not create authentication records for all named staff.

---

## 7. Current UI/UX implementation

### 7.1 Visual direction

The interface is an **Amharic-first operations dashboard** with English technical labels where they improve clarity. The visual system is compact and operational rather than decorative:

| UI characteristic | Current direction |
|---|---|
| Primary palette | Deep navy shell, cyan accent, white content cards, muted blue-gray text, gold/violet/blue/green secondary accents |
| Typography | Inter for general UI with Noto Sans Ethiopic for Amharic headings and labels; DM Mono for codes, units, and compact metadata |
| Layout | Fixed/collapsible desktop sidebar, 65px topbar, responsive content grid, mobile navigation drawer |
| Interaction density | Small cards, compact tables, direct action buttons, modal forms, status pills, loading states |
| Language style | Amharic-first visible labels with English subtitles or technical names |
| Operator principle | Reduce clicks and avoid a formal enterprise workflow when a direct action is sufficient |

Do not replace the existing style with a generic admin template without explicit direction. Preserve the compact dashboard language, Amharic labels, clear status colors, and mobile responsiveness.

### 7.2 Dashboard shell

The shell is implemented mainly in:

```text
components/dashboard/dashboard-shell.tsx
components/dashboard/owner/owner-workspace.tsx
components/dashboard/manager/manager-workspace.tsx
components/dashboard/reception/reception-workspace.tsx
components/dashboard/storekeeper/storekeeper-workspace.tsx
components/dashboard/sidebar.tsx
components/dashboard/topbar.tsx
components/dashboard/user-menu.tsx
src/app/globals.css
```

The current shell includes:

- A left sidebar with YT Advertisement branding, optional live company name/logo, a Live chip, navigation, running-job count, and a bottom Settings action.
- A collapsible desktop sidebar and mobile open/close behavior.
- A topbar with mobile menu, sidebar collapse button, dynamic company breadcrumb, search field placeholder, notification bell, unread badge, and user menu.
- A user menu showing avatar initials, name, English role label, Account settings, and sign out.
- Route-level loading through `src/app/loading.tsx` and `InventoryLoader`.
- A global client error boundary at `src/app/error.tsx`; auth/profile/session-looking errors redirect to sign-in, while other failures show retry/sign-in actions.

### 7.3 Main dashboard views

The navigation is defined in `components/dashboard/nav-config.ts`. The current views are:

| View | Purpose |
|---|---|
| Overview | Summary cards, machine strip, alerts, active job/activity overview, and high-level inventory/production signals |
| Inventory | Material table, low-stock banner, stock movement, material creation, and simple material request panel |
| Jobs | Job-card board/list, job creation, machine/material assignment, priority, due date, and completion |
| Machines | Machine cards, status, capabilities, operator context, machine creation, offcut/scrap actions, and operator workspaces |
| Offcuts | Reusable offcut records and scrap records |
| Reports | Weekly, bi-weekly, and monthly summary periods |
| Audit | Derived activity feed filtered by all, inventory, production, and recovery categories |

### 7.4 Current modal and workflow UX

Modals use `components/dashboard/modals/modal-shell.tsx` and share the same visual language. Existing forms include:

```text
job-modal.tsx
machine-modal.tsx
material-modal.tsx
material-request-modal.tsx
stock-modal.tsx
offcut-modal.tsx
scrap-modal.tsx
account-settings-modal.tsx
```

The Account settings modal currently contains:

1. Personal profile: update name and profile image URL.
2. Password and sign-in: change password and revoke other sessions; attach Google account.
3. Company branding: owner-only company name and logo URL updates.
4. Team access: owner/manager/admin users can view profiles, change roles, and activate/revoke profiles, with owner-role protections.

The notification modal currently lists up to 40 newest notifications for the signed-in user, shows title/message/actor/time, highlights unread items, supports per-item mark-as-read, and supports mark-all-as-read.

### 7.5 Material request UX

The panel is intentionally compact:

```text
Request → Issue → Received
```

- Any active profile can request material for an active job, subject to backend validation.
- Owner, manager, admin, and storekeeper accounts can see the full request queue and issue materials.
- Operators see requests relevant to themselves or their machine role.
- The issue action accepts a quantity and may produce `Issued` or `Partially Issued`.
- A recipient can mark an issued request as `Received`.
- Partial issue emits a `short_stock` notification to the requester.
- There is no mandatory signature field in the normal flow.

---

## 8. Current backend and Convex implementation

### 8.1 Schema and entities

The authoritative schema is `convex/schema.ts`. Current tables are:

| Table | Purpose | Key fields/notes |
|---|---|---|
| `companySettings` | Company identity and reporting configuration | Key, name, industry, address, phone, owner auth ID, logo URL, timezone, report flags, active |
| `staff` | Business-context staff directory | Person name, department, responsibility, material handling, application-role context, optional auth link, active |
| `users` | Application authorization profile | Better Auth user ID, name, email, optional image, role, active |
| `notifications` | Per-user notification inbox | Recipient auth ID, title, message, notification type, actor, related record, created/read timestamps |
| `materials` | Inventory master data and current balance | Name, category, purchase unit, normalized base unit, conversion ratio, quantity, reorder level, display unit, policy fields, accent, active |
| `machines` | Machine master data and current state | Name, code, type, manufacturer, model, capability, notes, operator role, material/display unit, status, active job, active |
| `materialRequests` | Minimal custody request | Job, material, requested/issued quantities, unit, state, requester/issuer/receiver IDs, timestamps, note |
| `stockMovements` | Inventory movement audit rows | Material, direction, entered quantity/unit, normalized base quantity/unit, note, actor, timestamp |
| `jobCards` | Job/order execution record | Code, client, title, machine, material, quantity/unit, status, due string, priority, creator, timestamp |
| `productionLogs` | Production activity and consumption | Job, machine, input, output, waste, unit, operator, timestamp |
| `offcuts` | Reusable remnants | Material, label, dimensions, area, location, usability, status, actor, timestamp |
| `scraps` | Unusable scrap records | Material, label, quantity/unit, reason, actor, timestamp |

Indexes exist for application user lookup, roles, company key, staff role/auth link, notification recipient/time, machine code/operator role, material category/unit, request job/status, job status/machine, production job/machine, offcut material/status, and scrap material.

### 8.2 Role model and backend authorization

Roles are defined in both `convex/schema.ts` and shared frontend/backend types:

```text
owner
manager
admin
storekeeper
laser_operator
cnc_operator
plotter_operator
printer_operator
```

Current authorization semantics:

| Role | Current authority |
|---|---|
| Owner | Full management, all operational administration, team roles/access, company branding |
| Manager | Delegated team-access and operational management; cannot assign or modify owner role |
| Admin | Legacy administrative management; treated as an operational management role |
| Storekeeper | Inventory movements and material issue workflow; can manage job/material areas allowed by current guards |
| Machine operators | Record production for their assigned machine-role context and see relevant work |

`convex/users.ts` is the authorization source of truth. Important functions include:

```text
getCurrentProfile
getCompanySettings
ensureProfile
listUsers
setRole
setActive
updateApplicationProfile
updateCompanySettings
requireActiveProfile
requireRoles
requireRoleManager
requireOwner
requireAdmin
```

Important behavior:

- `ensureProfile` creates a real application profile on first sign-in and makes the first profile an owner when the users table is empty; later first-time profiles default to storekeeper until assigned.
- Profile lookup can repair identity/profile linkage by matching the authenticated email when an auth identity changes.
- `requireRoles` expands an allowed list containing `admin` to include owner and manager for backward-compatible operational administration.
- `setRole` prevents non-owners from changing an owner or assigning the owner role.
- `setActive` prevents self-deactivation and prevents non-owners from deactivating the owner.
- Personal profile updates synchronize Better Auth profile data and the application profile.
- Company settings updates are owner-only.

### 8.3 Authentication

Relevant files:

```text
convex/auth.ts
convex/auth.config.ts
lib/auth-client.ts
lib/auth-server.ts
src/app/api/auth/[...all]/route.ts
src/app/sign-in/page.tsx
src/app/sign-up/page.tsx
```

Better Auth currently enables email/password authentication without required email verification. Google OAuth is conditionally enabled only when these Convex deployment environment variables exist:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

The sign-in and sign-up pages include `Continue with Google`. The Account settings modal uses Better Auth account linking with `linkSocial({ provider: "google" })`. Google OAuth is not fully usable until client credentials and the callback/base URL are configured in the correct deployment.

Users can change their password through Better Auth with `revokeOtherSessions: true`. The UI does not include a password in source or application profile records.

### 8.4 Notification system

The notification system is split into:

```text
convex/notificationHelpers.ts
convex/notifications.ts
components/dashboard/notification-modal.tsx
components/dashboard/topbar.tsx
```

The helper module provides:

- `notifyUser`: inserts a notification for one auth user unless the recipient is the actor.
- `notifyRoles`: finds active application profiles by role and fans out a notification to each unique recipient.

The query/mutation module provides:

```text
list
unreadCount
markRead
markAllRead
```

The topbar uses Convex reactive queries, so the unread badge updates through the subscription model. The modal is newest-first and includes per-item and mark-all actions.

Current notification producers include:

| Event | Targeting behavior |
|---|---|
| New material request | Owner, manager, admin, and storekeeper roles |
| Material fully issued | Requester |
| Material partially issued / short stock | Requester with `short_stock` type |
| Material received | Issuer or requester |
| Low stock after outbound movement | Owner, manager, admin, and storekeeper |
| Job card created | Assigned machine role plus owner/manager/admin |
| Production recorded | Job creator |
| Job completed | Job creator |
| Machine added/status/availability changed | Assigned machine role plus owner/manager/admin |
| Role updated | Target user |
| Access restored | Target user |

The `discrepancy` notification type exists in the schema vocabulary, but the current product slice does not yet expose a complete dedicated discrepancy-flag UI/mutation. Treat discrepancy handling as an explicit future extension, not as already complete.

### 8.5 Inventory and material movement rules

`convex/materials.ts` validates positive movements, active materials, unit conversion, and sufficient outbound balance. It patches the material quantity and inserts a `stockMovements` row. Outbound movements at or below `reorderAt` emit a low-stock notification.

`convex/units.ts` handles conversion from purchase units (`roll`, `sheet`, `pack`, `liter`, `piece`) to normalized base units using `conversionRatio`, with legacy roll/sheet fields retained only for compatibility. Never add a ratio without a verified physical rule.

`convex/jobs.ts` performs production accounting. The current behavior is:

1. Validate the job, machine, material, quantities, unit match, and available stock.
2. Deduct production input from material quantity.
3. Insert an outbound stock movement.
4. Insert a production log.
5. Set the job to `In production` and the machine to `Running` when production begins.
6. On completion, automatically record any remaining planned job quantity as zero-waste production, mark the job `Completed`, and release the machine.

This automatic completion fill is current behavior and should not be changed casually because it affects accounting semantics.

### 8.6 Material request backend

`convex/materialRequests.ts` implements the current minimal lifecycle:

- `list`: enriches requests with job/material/user/machine information and applies role-based visibility.
- `create`: requires an active profile, positive quantity, active job/material, and exact job-material-unit match; inserts `Requested` and notifies management/store roles.
- `issue`: requires a management/store role, validates remaining request quantity and stock, deducts inventory, inserts an outbound movement, and sets `Issued` or `Partially Issued`.
- `acknowledge`: allows `Issued` or `Partially Issued` to become `Received` and records the receiver/time.

No mandatory approval/signature flow should be added to the normal path.

### 8.7 Reports and audit

`convex/reports.ts` currently provides `getSummary` for:

```text
weekly
biweekly
monthly
```

It aggregates active material count, low-stock count, total current base quantity, movement counts and unit totals, machine/job/production counts, quantities, waste rate, offcut returns, reusable offcuts, and scrap totals. Timestamp normalization supports numeric timestamps, parseable date strings, `Yesterday`, and simple `HH:MM` strings.

The report response includes a `seededDataNote`: the requirement seed creates master data, not production logs, stock movements, or scraps. These activity metrics remain empty or zero until real users perform operations.

`convex/audit.ts` currently creates a derived activity feed by reading job cards, stock movements, production logs, offcuts, and scraps. It is **not** a dedicated append-only `auditLogs` table. The Audit view is therefore useful for transparency over existing operational records, but future production-hardening work should consider a first-class immutable audit event model for administrative changes, before/after values, corrections, and security events.

---

## 9. Seeding and data-onboarding behavior

### 9.1 Demo seed

`convex/seed.ts` still contains a legacy `seed` mutation for a controlled demo dataset. It creates:

- 6 demo materials with invented demo balances and conversions.
- 4 demo machines.
- 4 demo job cards.
- 2 demo offcuts.

This is not the real YT Advertisement master-data seed. It is only for demonstrations and must not be confused with live workshop data.

### 9.2 Requirement-based master-data seed

`seedYtAdvertisementWorkspace` is intended for the real captured workspace baseline. It:

- Seeds one `companySettings` record.
- Seeds 8 machine records.
- Seeds 26 materials.
- Seeds 12 staff-context records, including Yitbarek’s owner-context record.
- Initializes machine status as `Available` and active.
- Initializes material quantity and reorder threshold to zero.
- Stores the confirmed purchase/base-unit conversion metadata and preserves source display labels.
- Creates no jobs, production logs, stock movements, material requests, offcuts, scraps, or historical audit activity.
- Uses a company key of `yt-advertisement` for idempotence.
- Refuses to mix with existing operational data unless the explicit force/reset path is used.

The master-data seed uses the current category/unit mapping in `convex/seed.ts`, while the sanitized JSON artifact gives the raw capture, source units, and analysis notes in a tool-independent format.

### 9.3 Owner bootstrap

`seedYitbarekOwner` is a separate explicit mutation. It:

- Is restricted to the confirmed owner email `ytadvert@admin.org`.
- Accepts the temporary password only as a runtime argument.
- Creates a real Better Auth user when none exists.
- Creates or promotes the application profile to `owner`.
- Links `companySettings.ownerAuthUserId` when company settings exist.
- Links the Yitbarek `staff` record when it exists.
- Never returns or persists the password.

Run owner bootstrap only in the intended Convex deployment, then change the temporary password immediately. Do not put the password in a shell history that will be shared, source file, pull request, or documentation.

---

## 10. Current environment and deployment context

The development deployment context supplied by the owner is:

```text
CONVEX_DEPLOYMENT=dev:posh-peacock-678
NEXT_PUBLIC_CONVEX_URL=https://posh-peacock-678.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://posh-peacock-678.convex.site
SITE_URL=http://localhost:3000
```

The Better Auth secret is deployment-only and is intentionally not reproduced here. Use the owner-provided secret through a secure local/deployment environment mechanism, never by committing it.

`.env.example` contains variable names and safe descriptions. The required secret and URL variables include:

```text
NEXT_PUBLIC_CONVEX_URL
NEXT_PUBLIC_CONVEX_SITE_URL
BETTER_AUTH_SECRET
SITE_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
```

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are optional for local code compilation but required for Google sign-in and account linking.

A previous Convex code-generation attempt failed because the sandbox lacked an authenticated Convex CLI access token. The repository contains checked-in generated API declarations, and new API modules may require careful declaration updates until authenticated codegen is available. Do not treat a local type-safe build as proof that the remote Convex deployment has been migrated or smoke-tested.

---

## 11. Known limitations and incomplete areas

The current application is an early production slice. The following items are known and should be represented honestly:

1. **Opening balances are not real.** Requirement-based seeded material quantities and reorder levels are zero placeholders.
2. **PVC Film conversion is unknown.** Confirm its physical roll dimensions before receiving it by roll; other ratios in the revised prompt are explicitly implemented.
3. **Some machine details remain operationally open.** Banner Printer/CNC/Heat press/Conca manufacturer and final assignments still need owner or workshop confirmation, even though the revised prompt supplies their working model/capability mappings.
4. **Staff application roles are not fully assigned.** Business-context staff records are not equivalent to authenticated accounts.
5. **Google OAuth requires deployment credentials and callback configuration.** The UI is present, but provider configuration is environment-dependent.
6. **Logo management is URL-based.** The current owner settings form accepts a logo URL; it does not yet upload files to Convex storage.
7. **Audit is derived, not first-class.** A dedicated append-only audit event table with before/after values and correction chains is future work.
8. **Discrepancy handling is incomplete.** The schema includes a discrepancy status/type, but there is not yet a complete dedicated mutation and UI action.
9. **Job lifecycle is simplified.** Quality check, delivery, rework, correction records, and full state-transition history are future work.
10. **Reports are summaries, not a full audit pack.** Daily/weekly/bi-weekly/monthly summaries exist, but complete reconciliation, export, variance explanations, and report-run history are not fully implemented.
11. **Convex integration tests are missing.** Unit tests pass, but authorization, notification targeting, concurrent stock movement, and remote deployment behavior need authenticated testing.
12. **The legacy demo seed still exists.** Keep it clearly separated from the requirement-based master-data seed and do not run it against live workshop data.

---

## 12. Recommended first actions for Gemini

When you receive a new implementation request, follow this sequence unless the user explicitly requests another order:

1. Read `README.md`, `convex/README.md`, `docs/production-ready-implementation-plan.md`, `convex/schema.ts`, `convex/users.ts`, `convex/seed.ts`, and the relevant UI/backend files.
2. Run `git status --short --branch` and inspect the latest commit before changing anything. Preserve uncommitted user artifacts.
3. Compare the requested change against the current implementation described above. Identify whether it is a new feature, a bug fix, a schema migration, a UI refinement, or a documentation change.
4. Check role boundaries in the backend before adding UI controls. Every sensitive operation must have a Convex guard.
5. Preserve the minimal operator flow, especially `Request → Issue → Received`.
6. Avoid adding fake seed history or fake users. If test data is needed, label it clearly as test/demo data and keep it out of the real workspace seed.
7. For schema changes, inspect all dependent queries, mutations, generated API declarations, frontend types, and seed paths before editing.
8. For notification changes, define who receives the event, whether the actor should be excluded, how unread state behaves, and whether the event needs a related entity reference.
9. For authentication changes, use Better Auth’s installed version and exact APIs. Never log or commit passwords, OAuth secrets, or session material.
10. Update documentation when behavior changes.
11. Run `pnpm test`, `pnpm check`, `NODE_ENV=production pnpm build`, and `git diff --check` before reporting completion.
12. Report what was implemented, what was validated, what remains deployment-dependent, and whether changes are uncommitted or released.

If a requirement conflicts with the confirmed decisions in this handoff, explain the conflict and ask the owner before silently changing the workflow.

---

## 13. Suggested Gemini response format for future tasks

When beginning a new task, first respond with:

1. A short understanding of the requested change.
2. The exact files and data contracts likely affected.
3. Security, migration, or backward-compatibility risks.
4. A concise implementation plan.
5. Any blocking clarification question.

After implementation, report:

- Changed files and behavior.
- Backend authorization implications.
- Seed/data impact.
- Tests and build checks run.
- Deployment/configuration steps still required.
- Git branch/commit state.

Do not claim a feature is deployed merely because `pnpm build` passes. Distinguish local compilation, committed code, merged code, and remote Convex deployment/smoke-test status.

---

## 14. Source-of-truth file map

| Path | Why it matters |
|---|---|
| `README.md` | Project overview, capabilities, commands, environment, release status |
| `convex/README.md` | Convex/Better Auth setup, seeding, permissions, verification |
| `docs/production-ready-implementation-plan.md` | Long-term business and production roadmap |
| `docs/yt-advertisement-seed-data.md` | Seed-specific onboarding notes and unit decisions |
| `docs/yt-advertisement-requirements-analysis.json` | Sanitized raw requirements and analysis artifact; currently local/uncommitted unless status says otherwise |
| `convex/schema.ts` | Authoritative current Convex entities, enums, and indexes |
| `convex/users.ts` | Authorization, profile, owner, manager, branding, and access-control backend |
| `convex/seed.ts` | Demo seed, real workspace master-data seed, reset behavior, owner bootstrap |
| `convex/auth.ts` | Better Auth server configuration and optional Google provider |
| `convex/materials.ts` | Material creation, stock movements, conversions, and low-stock notification |
| `convex/materialRequests.ts` | Minimal Request → Issue/Partial → Received lifecycle |
| `convex/jobs.ts` | Job creation, production accounting, completion, and job notifications |
| `convex/machines.ts` | Machine creation, status/activation, and machine notifications |
| `convex/notificationHelpers.ts` | Targeted notification fan-out helpers |
| `convex/notifications.ts` | Notification list, unread count, and read-state mutations |
| `convex/reports.ts` | Weekly, bi-weekly, and monthly summary aggregation |
| `convex/audit.ts` | Derived activity feed, not a dedicated audit table |
| `convex/dashboard.ts` | Aggregate reactive dashboard state query |
| `components/dashboard/dashboard-shell.tsx` | Authenticated dashboard shell, layout, and global modal wiring |
| `components/dashboard/*/*-workspace.tsx` | Role/workspace-specific dashboard orchestration |
| `components/dashboard/sidebar.tsx` | Navigation, branding, responsive sidebar, settings entry |
| `components/dashboard/topbar.tsx` | Header, breadcrumb, search placeholder, notification bell, user menu |
| `components/dashboard/user-menu.tsx` | Account settings and sign-out popover |
| `components/dashboard/modals/account-settings-modal.tsx` | Personal profile, password, Google linking, company branding, team access |
| `components/dashboard/notification-modal.tsx` | Newest-first notification presentation and read actions |
| `components/dashboard/material-requests-panel.tsx` | Minimal material custody UI |
| `components/dashboard/views/*` | Overview, inventory, jobs, machines, offcuts, reports, and audit views |
| `src/app/sign-in/page.tsx` | Email/password and Google sign-in entry |
| `src/app/sign-up/page.tsx` | Email/password and Google sign-up entry |
| `src/app/error.tsx` | Global error recovery/auth redirect UX |
| `src/app/loading.tsx` | Route-level loading UX |
| `src/app/globals.css` | Full visual system, responsive layout, modal/form styling |
| `lib/operations-types.ts` | Frontend shared domain types and role labels |
| `lib/auth-client.ts` | Better Auth browser client |

---

## 15. Final instruction to Gemini

You are not starting a greenfield project. You are continuing a real, partially implemented operations system for YT Advertisement. Respect the collected workshop vocabulary, the confirmed Crystal machine data, Yitbarek’s ownership, the simplified operator workflow, the existing Amharic-first interface, and the current Convex/Better Auth architecture.

> Build only from verified requirements, current repository contracts, and explicit owner decisions. When data is missing, make the uncertainty visible rather than filling it with invented facts.

## References

[1]: https://github.com/yoh-space/yt-ads "YT Advertisement Operations Control repository"
[2]: https://github.com/yoh-space/yt-ads/blob/main/README.md "Current project overview"
[3]: https://github.com/yoh-space/yt-ads/blob/main/convex/schema.ts "Current Convex schema"
[4]: https://github.com/yoh-space/yt-ads/blob/main/convex/seed.ts "Current seed and owner bootstrap implementation"
[5]: https://github.com/yoh-space/yt-ads/blob/main/convex/users.ts "Current authorization and profile management"
[6]: https://github.com/yoh-space/yt-ads/blob/main/convex/materialRequests.ts "Current material request lifecycle"
[7]: https://github.com/yoh-space/yt-ads/blob/main/convex/notifications.ts "Current notification query and mutation API"
[8]: https://github.com/yoh-space/yt-ads/blob/main/convex/reports.ts "Current report aggregation"
[9]: https://github.com/yoh-space/yt-ads/blob/main/convex/audit.ts "Current derived audit/activity feed"
