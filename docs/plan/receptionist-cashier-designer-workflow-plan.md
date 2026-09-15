# Receptionist, Cashier, and Designer Workflow Plan

## Repository Context

**Repository:** `yoh-space/yt-ads`  
**Branch:** `main`  
**Reviewed commit:** `91b197b` (`fix(notifications): convert chime to mp3 with web audio fallback and wire real-time sound to reception and dashboard shell`)  
**Plan status:** Planning only. This document defines the implementation sequence and does not change runtime behavior.

## Objective

Split the current reception workflow into three focused roles:

- **Receptionist:** Owns customer communication, order intake, order review, pricing, priority management, progress follow-up, and design-work coordination.
- **Cashier:** Owns payment verification and the final payment-gated handoff into production. The cashier creates or issues the job card only after payment or approved credit is verified.
- **Designer:** Owns assigned design work, prepares or updates artwork, and submits the required production-ready files for receptionist review.

The existing receptionist role currently spans order review, price setting, payment confirmation, automatic routing, reservation, and job-card creation. The implementation must separate these responsibilities without losing order history, payment auditability, customer communication, or production safety.

The existing staff accounts should be assigned through the owner team workflow:

| Staff account | Target role | Canonical role code |
|---|---|---|
| `ytadvert+casher@gmail.com` | Cashier | `cashier` |
| `ytadvert+designer@gmail.com` | Designer | `designer` |

The product should use **Cashier** in user-facing labels. The existing `casher` spelling is retained only as the login email address unless the owner explicitly creates a replacement account.

## Current-State Findings

The repository already contains useful order states and backend operations, but the current boundary is too broad for the requested workflow.

### Current order lifecycle

The `customerOrders` table already includes statuses that can support the split:

`PENDING_REVIEW` → `RECEPTION_REVIEW` → `PRICED_AND_PENDING_PAYMENT` → `CONFIRMED_PAID_OR_CREDIT` → `JOB_CARD_CREATED` → production states.

The order also stores payment status, payment methods, payment references, payment timestamps, payment instructions snapshots, price fields, customer-edit locks, priority, attachments, and job-card linkage.

### Current responsibility gap

`confirmOrderAndIssueJobCard` currently combines several important actions:

1. Confirms payment or approved credit.
2. Performs routing and machine validation.
3. Reserves stock.
4. Creates the job card.
5. Creates job-material requirements.
6. Marks the order as `JOB_CARD_CREATED`.
7. Writes the payment confirmation audit fields.

This mutation is currently described as a reception checkout step. It must become a cashier-only operation after the receptionist has completed review and pricing.

### Current role gap

The canonical role-permission map currently defines `receptionist` but does not yet define `cashier` or `designer`. The workspace routing and role catalog similarly need new entries. Existing role and staff assignment flows can be reused so the owner can assign the supplied accounts without creating a second user-management system.

### Final repository review corrections

The current receptionist page still exposes the combined payment and job-card action in `src/app/(dashboard)/dashboard/receptionist/orders/page.tsx`. The implementation must remove that mutation call from the receptionist client only after the cashier queue and cashier mutation are live. Removing the button without replacing the backend path would strand orders, so the cutover must be performed as one migration slice.

The current receptionist layout explicitly allows only the `receptionist` role. The new cashier and designer layouts must use their own role allowlists, and the route policy must reject cross-workspace access even when a user manually enters another dashboard URL.

The current order and payment schema already has the fields needed for the first cashier release, including `paymentStatus`, advance and remaining amounts, payment references, payment confirmation actors, and `jobCardId`. The first implementation should extend these fields only where an audit or concurrency requirement cannot be met through the existing order-event and configuration-audit mechanisms.

The current codebase has no design-task or design-submission tables. These must be added before the receptionist UI offers assignment as a real workflow. A temporary notes-only design flag would not preserve version history or provide reliable readiness validation and is therefore not an acceptable final implementation.

The current payment-gated implementation also performs reservations, routing, BOM expansion, and job-card creation. Those production operations should remain in one shared internal transaction boundary, while the public mutation wrapper and authorization boundary move to the cashier role. This avoids duplicating safety-critical production logic.

## Target Responsibility Model

### Receptionist

The receptionist is the primary customer-facing coordinator. The dashboard should prioritize work by urgency rather than by generic navigation.

The receptionist can:

- View newly submitted and customer-edited orders.
- Accept an order into receptionist review.
- Lock customer editing when review begins.
- Review customer details, service, specifications, dimensions, attachments, due date, and notes.
- Mark missing information and request clarification from the customer.
- Assign or reassign a design request to a designer.
- Review submitted artwork and return it for correction when necessary.
- Set or revise the final customer price before payment verification.
- Set order priority and due-date urgency.
- Track payment-pending, design-pending, production, and customer-follow-up states.
- Send or trigger customer-facing progress updates through existing channels.
- Return an order to correction before cashier handoff when the order is incomplete or the price must change.

The receptionist must not:

- Confirm a customer payment as received.
- Approve credit unless a separately authorized role is introduced later.
- Create or issue the production job card.
- Reserve production stock as part of payment confirmation.
- Bypass missing design or material configuration requirements.

### Cashier

The cashier has a narrow, payment-focused workspace. The default cashier dashboard should display only orders that are ready for payment verification.

The cashier can:

- View orders in `PRICED_AND_PENDING_PAYMENT`.
- Inspect the approved price, advance amount, remaining amount, payment instructions snapshot, customer identity, order files, and receptionist notes.
- Record the payment method and payment reference.
- Confirm the received advance payment.
- Record or approve the configured credit path if the business explicitly allows it.
- Trigger the final payment-gated job-card creation and production handoff.
- View the resulting job card and routing outcome.
- Return an order to the receptionist with a reason when the payment is insufficient, the reference is unclear, or the price/order details do not match.
- View payment history for orders that have already passed through the cashier.

The cashier must not:

- Change the customer price.
- Edit service specifications or customer data except through a controlled return-to-reception action.
- Assign designers.
- Change machine routes or production configuration.
- Create a job card for an order that is not priced and ready for payment.

### Designer

The designer owns only assigned design work. A designer should not receive the entire customer order queue by default.

The designer can:

- View design tasks assigned to them.
- Open the customer brief, service specifications, dimensions, references, notes, and attachments needed for design.
- Accept or decline a task with a reason.
- Ask the receptionist for clarification.
- Upload a draft or production-ready design file.
- Record design notes and version information.
- Submit artwork for receptionist review.
- Mark the task as blocked when required information is missing.
- See review feedback and resubmit a corrected version.

The designer must not:

- Set or change the customer price.
- Confirm payments.
- Create job cards.
- Change machine, material, or service routing.
- Publish customer-facing service catalog changes.

## Target Workflow

### Stage 1: Customer intake

A customer order enters `PENDING_REVIEW`. The receptionist dashboard places it in the highest-priority intake queue based on order priority, due date, source, and age.

The receptionist accepts the order. The backend changes the order to `RECEPTION_REVIEW`, records the receptionist identity and timestamp, and locks customer editing. A customer-edit lock must continue to use the existing concurrency and revision mechanisms.

### Stage 2: Reception review

The receptionist verifies customer identity, service selection, dimensions, quantity, files, specifications, delivery expectations, and required business fields. The review view must show a clear checklist rather than relying on free-form notes.

If the order needs design work, the receptionist creates a design task before pricing or marks the order as `DESIGN_REQUIRED`. If the customer supplied production-ready artwork, the receptionist can mark design as not required after validating the file.

If required information is missing, the receptionist returns the order to a customer-follow-up state. The reason must be stored and visible to the next staff member who handles the order.

### Stage 3: Design coordination

The receptionist assigns a design task to the designer. The assignment includes the order ID, customer brief, service and specifications snapshot, dimensions, due date, priority, reference files, and requested output format.

The designer accepts the task and works through versioned submissions. Each submission records the designer, storage file IDs, canonical filenames, version number, notes, and submitted timestamp.

The receptionist reviews the latest submission. The receptionist can approve it for pricing and production or return it to the designer with structured feedback. The order cannot move to payment-ready status while a required design task is unresolved.

### Stage 4: Pricing

Once the order review and required design checks are complete, the receptionist sets the final price. The existing pricing mutation should remain the authoritative price operation, but its authorization must be changed to allow `receptionist` and owner/admin oversight while excluding `cashier` and `designer`.

Pricing must snapshot:

- Total amount.
- Advance due amount.
- Remaining due amount.
- Payment instructions shown to the customer.
- Pricing notes and any approved discount or adjustment.
- Receptionist identity and timestamp.
- Order revision used to calculate the price.

The order then moves to `PRICED_AND_PENDING_PAYMENT`. The cashier queue is driven by this state, not by a frontend filter over a broad order list.

### Stage 5: Cashier payment verification

The cashier opens a payment-ready order and verifies the payment evidence or physical payment. The cashier records payment method, reference, received amount, and notes.

The payment confirmation mutation must be separate from the receptionist pricing mutation. It must be idempotent and must reject:

- Orders that are not `PRICED_AND_PENDING_PAYMENT`.
- Orders without a positive final price.
- Payments below the required advance amount unless an explicit approved exception exists.
- Duplicate payment confirmation attempts.
- Stale order revisions.
- Orders with unresolved required design work.

### Stage 6: Job-card issue

After successful payment verification, the cashier triggers the production handoff. The backend should use a transactional internal function that:

1. Re-reads the order and validates its current status.
2. Validates the payment decision and payment amount.
3. Validates service, machine, capability, material, and route configuration.
4. Creates or confirms reservations.
5. Creates the job card.
6. Creates job-material requirements and immutable configuration snapshots.
7. Links the job card to the order.
8. Updates payment and confirmation audit fields.
9. Changes the order to `JOB_CARD_CREATED` or `WAITING_FOR_MATERIAL` according to the existing production rules.
10. Emits the appropriate cashier, receptionist, operator, and customer notifications.

The cashier UI should present this as one explicit **Verify payment and issue job card** action. The backend must remain the final authority.

### Stage 7: Production progress and customer follow-up

After job-card creation, the receptionist can track progress and communicate with the customer. The receptionist can see payment, design, material, operator, and production milestones but cannot alter operator production records.

The existing operator and production workflows remain responsible for execution, consumption, waste, stock gates, and completion.

## Status and State-Model Changes

The implementation should avoid replacing existing statuses unnecessarily. Instead, it should add the minimum explicit states needed to distinguish design and cashier work.

Recommended additions:

| State | Purpose | Primary owner |
|---|---|---|
| `DESIGN_REQUIRED` | Order needs artwork before pricing can finish | Receptionist |
| `DESIGN_IN_PROGRESS` | A designer has accepted the task | Designer |
| `DESIGN_SUBMITTED` | Designer submitted artwork for receptionist review | Receptionist |
| `DESIGN_REVISION_REQUIRED` | Receptionist returned artwork with feedback | Designer |
| `PRICED_AND_PENDING_PAYMENT` | Price is final and cashier action is required | Cashier |
| `PAYMENT_REVIEW_REQUIRED` | Cashier returned an unclear or insufficient payment | Receptionist/Cashier |
| `JOB_CARD_CREATED` | Cashier completed payment-gated production handoff | Production |

If introducing order-level design statuses creates too much coupling, keep the order status at `RECEPTION_REVIEW` or `PRICED_AND_PENDING_PAYMENT` and add a separate `designTasks.status`. The preferred design is a separate design-task lifecycle with derived order readiness because one order may later require multiple design outputs.

The order state machine must define allowed transitions explicitly. Frontend buttons must be derived from backend-provided capabilities rather than inferred solely from the status string.

## Data Model Plan

### 1. Role and permission model

Add canonical role codes:

- `cashier`
- `designer`

Add role labels in English and Amharic, workspace IDs, home routes, role catalog seed data, route permissions, and notification visibility policies.

Add purpose-specific permissions rather than granting the broad existing receptionist permission set:

| Permission | Receptionist | Cashier | Designer |
|---|:---:|:---:|:---:|
| `dashboard.view` | Yes | Yes | Yes |
| `order.view` | Yes | Payment-ready and assigned order scope | Assigned design-order scope |
| `order.create` | Yes | No | No |
| `order.review` | Yes | No | No |
| `order.price` | Yes | No | No |
| `order.payment_verify` | No | Yes | No |
| `job.create` | No | Yes | No |
| `design.view` | Assigned and review queue | No | Assigned |
| `design.assign` | Yes | No | No |
| `design.submit` | No | No | Yes |
| `design.review` | Yes | No | No |
| `customer.notify` | Yes | Limited payment confirmation | No |
| `machine.view` | Read-only progress context | Read-only route context | No |

The backend must enforce these permissions independently from navigation visibility.

### 2. Design task table

Add a `designTasks` table with the following fields:

- `orderId`.
- `assignedDesignerId`.
- `createdBy` and `updatedBy`.
- `status`: `UNASSIGNED`, `ASSIGNED`, `IN_PROGRESS`, `SUBMITTED`, `REVISION_REQUIRED`, `APPROVED`, `BLOCKED`, `CANCELLED`.
- Customer brief and production brief snapshots.
- Required output type and dimensions.
- Due timestamp and priority snapshot.
- Current version number.
- Latest submission ID.
- Reception review notes.
- Created, accepted, submitted, approved, and updated timestamps.

Add a `designSubmissions` table or embedded version records. A separate table is preferred because the system must preserve prior artwork versions and review history.

Each submission should store:

- Design task ID.
- Version number.
- File storage ID and canonical filename.
- Designer ID.
- Notes.
- Submission status.
- Reception review decision and feedback.
- Created timestamp.

Reuse the existing attachment naming and storage conventions. A design file must not overwrite an earlier approved or submitted version.

### 3. Order audit fields

Add explicit fields or an order-event record for:

- Accepted by receptionist.
- Review started and completed.
- Price set by receptionist.
- Design requirement and task linkage.
- Returned-to-customer reason.
- Returned-to-reception reason from cashier.
- Payment verified by cashier.
- Job card issued by cashier.

Existing payment fields remain authoritative for monetary facts. New workflow fields must not duplicate the amount or payment status in competing columns.

### 4. Cashier queue read model

Add a dedicated backend query such as `cashier.ordersWaitingForPayment` rather than loading all orders and filtering in the browser.

The query should return only orders that:

- Are in `PRICED_AND_PENDING_PAYMENT` or an explicitly permitted payment-review state.
- Have a valid final amount.
- Have completed required design work.
- Have no existing job card.
- Are visible to the cashier role.

The result should be ordered by payment urgency, due date, priority, and time waiting.

### 5. Receptionist priority read model

Add a dedicated receptionist dashboard query that groups work into:

1. New intake requiring acceptance.
2. Customer follow-up required.
3. Design assignment required.
4. Design review required.
5. Pricing required.
6. Payment waiting.
7. Production progress follow-up.
8. Overdue or at-risk orders.

Each item should include a reason code, age, due-date risk, priority, customer, service, latest owner, and next allowed action. This is more reliable than computing urgent work only in the client.

## Dashboard Plan

### Receptionist dashboard

Replace the generic receptionist overview with a customer-operations cockpit. The first screen should show urgent work before general statistics.

Recommended sections:

- **Urgent customer actions:** overdue, due soon, blocked, or customer waiting.
- **New orders:** not yet accepted or missing information.
- **Design coordination:** unassigned design requests, submitted designs awaiting review, and revision requests.
- **Pricing queue:** reviewed orders without final price.
- **Payment waiting:** priced orders handed to cashier, with payment age.
- **Production progress:** jobs with material, machine, or completion issues.
- **Customer communication history:** recent contact attempts and unresolved follow-ups.

The order drawer should expose a clear timeline and a single next-action area. It should not show cashier-only controls.

### Cashier dashboard

Create `/dashboard/cashier` with a deliberately narrow interface.

The default page should contain:

- Orders waiting for payment verification.
- Payment amount and advance due.
- Customer and order reference.
- Payment instruction snapshot.
- Payment method and reference inputs.
- Evidence attachment or note where applicable.
- Return-to-reception action.
- Verify payment and issue job card action.
- Recently verified payments for audit context.

The cashier navigation should avoid machine administration, inventory management, design queues, and general order editing.

### Designer dashboard

Create `/dashboard/designer` with assigned work as the primary view.

Recommended sections:

- New assignments.
- Accepted and in-progress tasks.
- Tasks due soon.
- Revision requests.
- Submitted work awaiting receptionist review.
- Completed design history.

The designer task page should make the customer brief and production requirements readable without giving access to price, payment, or machine configuration controls.

## Backend API Plan

### Receptionist APIs

Add or refine APIs for:

- `receptionist.listPriorityWork`.
- `receptionist.acceptOrderForReview`.
- `receptionist.returnOrderForCustomerClarification`.
- `receptionist.assignDesignTask`.
- `receptionist.reviewDesignSubmission`.
- `receptionist.priceOrder`.
- `receptionist.returnPaymentOrderToReview`.
- `receptionist.getOrderProgress`.

Existing `lockOrderForReview` and `priceOrderInternal` should be reused where possible. Their authorization and transition guards must be updated instead of duplicating pricing logic.

### Cashier APIs

Add:

- `cashier.listOrdersWaitingForPayment`.
- `cashier.getPaymentReview`.
- `cashier.verifyPaymentAndIssueJobCard`.
- `cashier.returnPaymentToReception`.
- `cashier.listRecentPaymentVerifications`.

Refactor `confirmOrderAndIssueJobCard` into a shared internal implementation with a cashier-facing mutation wrapper. The internal function must not be callable by receptionist or designer clients.

### Designer APIs

Add:

- `designer.listAssignedTasks`.
- `designer.acceptTask`.
- `designer.blockTask`.
- `designer.submitDesign`.
- `designer.resubmitDesign`.
- `designer.getTaskDetails`.

Use storage authorization so a designer can upload files only for an assigned task. The server must verify that the submitted file belongs to the task and that the task is in a valid submission state.

## Staff Provisioning Plan

The owner should assign the existing staff accounts through `/dashboard/owner/team` after the new role catalog is seeded.

### Cashier account

Assign `ytadvert+casher@gmail.com` the canonical `cashier` role. The owner should verify that the account is active and that its home route is `/dashboard/cashier`.

### Designer account

Assign `ytadvert+designer@gmail.com` the canonical `designer` role. The owner should verify that its home route is `/dashboard/designer`.

The implementation must not hard-code these email addresses into authorization logic. They are provisioning inputs for the existing owner directory. The role and permission records remain the source of truth.

If the current Better Auth profile is still marked unassigned, the owner assignment mutation should set the role and active state without creating a duplicate profile. The implementation should include an idempotent provisioning checklist or owner-only seed helper that reports whether each requested account was found and assigned.

## Notifications

Use the existing notification infrastructure with role-specific delivery policies.

| Event | Receptionist | Cashier | Designer | Customer |
|---|---:|---:|---:|---:|
| New order received | Yes | No | No | Optional acknowledgement |
| Order accepted for review | Yes | No | No | Optional |
| Design task assigned | Yes | No | Yes | No |
| Design submitted | Yes | No | Yes | No |
| Design revision requested | Yes | No | Yes | No |
| Order priced and awaiting payment | Yes | Yes | No | Yes |
| Payment verified and job card issued | Yes | Yes | No | Yes |
| Production progress update | Yes | No | No | Optional |
| Payment returned for correction | Yes | Yes | No | No |

Notifications should include an order code and a direct route to the relevant task. Do not expose payment details in designer notifications.

## Migration and Compatibility

The migration must preserve existing receptionist accounts and orders.

1. Add the new role codes and permissions without removing `receptionist`.
2. Keep existing receptionist users as `receptionist`.
3. Add cashier and designer workspace routes and seed records.
4. Move authorization for payment confirmation and job-card issue from receptionist to cashier.
5. Keep a temporary owner/admin override for recovery, audit, and migration support.
6. Mark existing orders in `PRICED_AND_PENDING_PAYMENT` as cashier-ready after validating price and design readiness.
7. Preserve existing orders already in `JOB_CARD_CREATED` and later states.
8. Preserve existing payment audit fields and job-card links.
9. Migrate any existing design-related notes or attachments into design-task records where a reliable order relationship exists.
10. Report ambiguous records instead of assigning them automatically.

The old receptionist payment/job-card button should be removed only after the cashier path is available and existing pending orders have been verified.

## Security and Concurrency Requirements

The role split is a security boundary, not only a navigation change.

The backend must enforce:

- Receptionists cannot call cashier payment mutations.
- Cashiers cannot call pricing or design-assignment mutations.
- Designers cannot call order pricing, payment, or job-card mutations.
- Cashier confirmation uses an expected order revision or updated timestamp.
- Two cashier tabs cannot issue two job cards for the same order.
- A payment confirmation retry is idempotent and returns the existing job card when the same confirmation already completed.
- A receptionist cannot price an order after a conflicting customer revision without reloading.
- A designer cannot submit a task after it has been cancelled, reassigned, or approved.
- Storage files are scoped to the owning order/design task.
- Every transition records actor, timestamp, prior state, next state, and reason.

## Testing Strategy

Add focused tests before enabling the new roles in production.

| Test area | Required coverage |
|---|---|
| Role catalog | Cashier and designer roles seed idempotently with correct home routes |
| Permissions | Each role can perform only its intended actions |
| Reception flow | Accept, lock, review, assign design, approve design, price, and return actions |
| Priority queue | Urgent orders sort correctly and reason codes are stable |
| Design workflow | Assignment, acceptance, submission, revision, approval, cancellation, and reassignment |
| Cashier queue | Only priced and design-ready orders appear |
| Payment verification | Amount validation, references, payment status, duplicate submissions, and return-to-reception |
| Job-card issue | Only cashier-authorized payment confirmation creates a job card |
| Concurrency | Two cashier tabs cannot create duplicate job cards |
| Production safety | Existing routing, reservation, material authorization, and stock gates remain enforced |
| Staff provisioning | Supplied staff emails are assigned idempotently without duplicate users |
| Notifications | Events reach the correct role and do not leak payment details to designers |
| Compatibility | Existing orders and payment histories remain readable |
| UI | Reception priority cockpit, cashier payment queue, and designer task queue render correctly |

The completion gate is:

```text
npm run check
npm test -- --run
npm run build
```

The focused tests should be run after each workflow slice, followed by the complete suite and production build before rollout.

## Implementation Sequence

### Phase 1: Role and permission foundation

Add `cashier` and `designer` role types, labels, permissions, workspace routes, role catalog seed records, role-routing rules, dashboard shell navigation, and owner-team assignment support. Do not change payment behavior yet.

### Phase 2: Receptionist priority cockpit

Create the priority read model and update the receptionist dashboard. Add explicit accept, customer-follow-up, design-required, design-review, pricing, payment-waiting, and progress-follow-up views.

### Phase 3: Design workflow

Add design task and submission tables, backend mutations, storage authorization, designer dashboard, receptionist assignment/review UI, and notifications.

### Phase 4: Cashier payment queue

Create the cashier workspace and payment-ready query. Add payment verification and return-to-reception operations. Keep job-card creation behind a feature flag or owner-only transition while the new queue is validated.

### Phase 5: Split payment and job-card authority

Refactor the current combined confirmation implementation into a cashier-authorized operation. Preserve shared internal routing and reservation logic. Remove receptionist access to payment confirmation and job-card issuance.

### Phase 6: Staff provisioning and migration

Seed role records, assign the supplied accounts through owner team management, migrate eligible pending orders, and produce an unresolved-record report.

### Phase 7: Hardening and rollout

Run authorization, concurrency, transition, notification, full-suite, and build validation. Enable the new workflows for the two staff accounts. Keep owner/admin recovery controls and audit logs available.

## Acceptance Criteria

The implementation is complete when:

1. The owner can assign `ytadvert+casher@gmail.com` to the `cashier` role.
2. The owner can assign `ytadvert+designer@gmail.com` to the `designer` role.
3. Receptionists see an urgency-first customer operations dashboard.
4. Receptionists can accept, review, prioritize, price, and track orders.
5. Receptionists can assign design work and approve or reject submitted artwork.
6. Designers see only assigned design tasks and can submit versioned artwork.
7. Cashiers see only orders ready for payment verification.
8. Cashiers can confirm payment and issue job cards through one guarded workflow.
9. Receptionists cannot confirm payment or issue job cards.
10. Designers cannot change price, payment, routing, or job-card state.
11. Duplicate cashier submissions cannot create duplicate job cards.
12. Payment and design readiness are validated server-side before production handoff.
13. Existing order, payment, attachment, routing, reservation, inventory, and production records remain readable.
14. Role-specific notifications are delivered without exposing sensitive data.
15. `npm run check`, the complete test suite, and `npm run build` pass.

## References

[1]: https://github.com/yoh-space/yt-ads/blob/main/convex/orders.ts "YT Ads order pricing and payment-gated job-card workflow"

[2]: https://github.com/yoh-space/yt-ads/blob/main/convex/schema.ts "YT Ads Convex schema and order lifecycle values"

[3]: https://github.com/yoh-space/yt-ads/blob/main/src/shared/role-permissions.ts "YT Ads canonical role-permission definitions"

[4]: https://github.com/yoh-space/yt-ads/blob/main/convex/owner/team.ts "YT Ads owner staff assignment backend"

[5]: https://github.com/yoh-space/yt-ads/blob/main/src/components/dashboard/roles/receptionist/receptionist-nav.ts "YT Ads receptionist navigation"

[6]: https://github.com/yoh-space/yt-ads/blob/main/convex/notifications.ts "YT Ads notification infrastructure"

[7]: https://github.com/yoh-space/yt-ads/blob/main/convex/attachments.ts "YT Ads order attachment handling"
