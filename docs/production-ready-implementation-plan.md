# YT Advertisement Operations System
## Production-Ready Implementation Plan

**Client:** YT Advertisement  
**Implementation partner:** YoTech Digitals  
**Purpose:** Upgrade the current `yt-ads` prototype into a reliable production operations system for inventory, signed material requisitions, job-order tracking, machine production, reporting, and audit transparency.

> This is an implementation plan, not proposal language. It is intended to guide development, data onboarding, testing, deployment, and operational adoption.

## 1. Implementation objective

The final system must become the official operational record for YT Advertisement’s advertising and printing workshop. It must replace fragmented tracking across Telegram, WhatsApp, paper records, and informal registers with traceable workflows for job orders, material custody, production activity, stock reconciliation, daily reporting, and monthly audit.

The system must support management, storekeepers, machine operators, relief staff, coordinators, and customer-service users without giving every role unrestricted access. All important actions must be attributable to a person, timestamped, reviewable, and correctable without destroying the original history.

## 2. Confirmed business requirements

| Requirement | Implementation meaning | Priority |
|---|---|---:|
| Job-order tracking | Create, prioritize, assign, execute, review, and close customer work orders. | P0 |
| Job-order prioritization | Support priority, due date, urgency, owner, machine assignment, and exception status. | P0 |
| Daily reporting | Show daily jobs, production, stock movements, waste, requisitions, and unresolved discrepancies. | P0 |
| Monthly audit | Produce opening balance, receipts, issues, consumption, returns, scrap, closing balance, variances, and audit events. | P0 |
| Simple material request | Operator requests material for a job; storekeeper confirms the issued quantity; recipient taps **Received**. No mandatory signature or multi-step approval for normal requests. | P0 |
| Lightweight stock check | Show issued, consumed, returned, and remaining quantity in one simple view. Management reviews exceptions instead of requiring a full manual reconciliation from operators. | P0 |
| Regular job-card use | Preserve job cards as the central execution record, not as a separate disconnected feature. | P0 |
| Telegram and WhatsApp usage | Keep them as communication channels; the application becomes the system of record. | P1 |
| Scrap process | Make scrap quantity, reason, actor, approval, and reinventory policy explicit. | P1 |
| Workshop handoff | Model the transfer from store to workshop as a traceable custody event. | P0 |

## 3. Confirmed workshop machine input types

For application configuration, the following four machines should be entered as **Crystal-manufactured**. This clarification is for machine master data and workflow behavior, not proposal text.

| Machine input type | Manufacturer | Quantity | Initial capability | Required production configuration |
|---|---|---:|---|---|
| Print and Cut | Crystal | 1 | To confirm | Print width, cut width, supported media, operator assignment, and unit. |
| DTF | Crystal | 1 | 0.6m captured | Confirm whether 0.6m means print width, film width, or another capacity measure. |
| Laser Cutter 1325 | Crystal | 1 | 1.20 × 2.44 captured | Confirm dimensions, laser power, supported materials, and operator assignment. |
| UV Flat bed | Crystal | 1 | To confirm | Confirm bed dimensions, print area, supported media, and operator assignment. |

The remaining equipment records must be onboarded separately:

| Machine input type | Manufacturer status | Quantity | Open information |
|---|---|---:|---|
| Banner Printer | To confirm | 1 | Confirm brand, exact model, width, and supported media. |
| CNC Router | To confirm | 1 | Confirm brand, bed size, spindle/power, and supported materials. |
| Heat press | To confirm | 1 | Confirm manufacturer and whether work is measured by piece, job, or time. |
| Conca | To confirm | 1 | Confirm whether this is a machine, paper-work station, or local operational term. |

Exact model numbers and technical specifications remain required for maintenance, assignment, capacity planning, and machine-specific reports.

## 4. Implementation principles

The system should be implemented around the operational lifecycle rather than around isolated screens. A job order should connect to its machine assignment, simple material request, issue confirmation, optional receipt acknowledgement, production log, quality result, waste, offcut, scrap, and final closure.

Backend authorization must be enforced independently of the interface. Stock changes must be atomic and must reject insufficient quantities. Operational records should not be hard-deleted. Corrections should be represented by a new adjustment or correction event with a reason.

The system must preserve the company’s familiar material names and units while also storing normalized units for calculations. A roll, litre, piece, metre, and square metre must not be added together as if they were the same quantity.

## 5. Target application areas

### 5.1 Administrator workspace

The administrator workspace is the management control center. It must provide company configuration, staff and role administration, machine and material master data, job-order oversight, simple material-request oversight, lightweight stock checks, daily and monthly reporting, audit-log review, and export controls.

The administrator must be able to activate or deactivate users, assign business roles, assign machine permissions, edit machine capabilities, configure material policies, review all exceptions, and inspect the history of changes.

### 5.2 Storekeeper workspace

The storekeeper workspace must provide material receiving, stock balances, material search, request review, one-step issue confirmation, optional receipt acknowledgement, returns, offcut returns, scrap registration, low-stock warnings, and simple balance checks.

A stock issue should reference a job order and material request. The storekeeper confirms the actual quantity, and the operator taps **Received**. The system records issuer, recipient, date and time, quantity, unit, material, job order, and an optional discrepancy note. Manager approval or signature is reserved for exceptions.

### 5.3 Machine-operator workspace

The operator workspace must be filtered by assigned machine and role. It must show the active queue, job details, material received, planned quantity, production input, good output, waste, rework, quality state, and handoff status.

The Crystal Print and Cut, DTF, Laser Cutter 1325, and UV Flat bed workflows should share a common production contract while allowing machine-specific fields such as width, bed size, material type, print mode, cut mode, and operating notes.

### 5.4 Customer-service and order-intake workspace

Authorized customer-service users should create or submit job orders with client, product, requested quantity, material request, due date, priority, notes, and reference attachments. They must not directly adjust stock or approve their own exceptions unless explicitly authorized.

## 6. Target data model

The current application already includes users, materials, machines, stock movements, job cards, production logs, offcuts, scraps, reports, and an activity feed. The next release should extend these records or add the following entities:

| Entity | Required fields and purpose |
|---|---|
| `companySettings` | Company name, address, timezone, report cutoff, and active configuration. |
| `staff` | Person, department, business responsibility, phone/email, active status, and linked application profile. |
| `machineAssignments` | Machine, staff member, role, effective start/end, relief assignment, and assignment history. |
| `machineCapabilities` | Manufacturer, exact model, width/bed size, power, supported materials, units, and operational notes. |
| `materialPolicies` | Storage location, base unit, reorder point, reorder quantity, average use, scrap rule, and approval rule. |
| `jobOrders` or expanded `jobCards` | Customer, product, priority, due date, owner, stages, status, and linked requisitions. |
| `requisitions` | Requester, job order, status, issuer, recipient, timestamps, and optional discrepancy note. |
| `requisitionLines` | Material, requested, issued, consumed, returned, remaining balance, unit, and variance. |
| `stockMovements` | Direction, source entity, source ID, actor, recipient where relevant, reason, and timestamp. |
| `productionLogs` | Job, machine, operator, shift, input, output, waste, rework, quality state, and timestamp. |
| `auditLogs` | Append-only actor, role, action, entity, before/after values, source, reason, and timestamp. |
| `reportRuns` | Period, report type, generated by, generated time, filter state, export location, and checksum if required. |

## 7. Required workflow states

### 7.1 Job order states

Use the following initial state model:

`Draft → Submitted → Approved → Planned → Materials Requested → Materials Issued → In Production → Quality Check → Ready for Delivery → Delivered → Closed`

The system should also support `Paused`, `Rejected`, `Cancelled`, `Rework Required`, and `Exception` states. Every state transition must record the actor, timestamp, previous state, new state, and reason when required.

### 7.2 Simple material-request states

Use the smallest useful state model:

`Requested → Issued → Received`

The exception states are `Short Stock`, `Partially Issued`, and `Discrepancy`. Normal requests require no manager approval and no mandatory signature. The application records the requester, issuer, recipient, quantities, and timestamps automatically. Optional approval or signature fields can be added later for special cases.

### 7.3 Production states

Use:

`Not Started → Running → Paused → Quality Check → Rework Required → Accepted → Completed`

Production logs must remain immutable. Corrections should create a correction record linked to the original log.

## 8. Phased execution plan

### Phase 0 — Scope and data sign-off

**Goal:** Remove ambiguity before schema and UI work begins.

**Tasks:** Confirm the final General Manager name, confirm the meaning of “Conca,” verify the four Crystal machine plates, record exact model numbers where visible, confirm units for each machine, confirm the simple material-request states, define the report timezone, and approve the first material and staff import template.

**Deliverables:** Approved data dictionary, approved machine roster, approved material roster, approved staff/role matrix, simple workflow-state document, and UAT participant list.

**Exit criteria:** YT Advertisement signs off the master-data template and the first pilot workflow.

### Phase 1 — Production data foundation

**Goal:** Build reliable master data and authorization boundaries.

**Tasks:** Add company settings, staff directory, machine manufacturer/model/capability fields, machine assignments, material policies, localized units, opening balances, profile-to-staff links, role permissions, indexes, and audit events for administrative changes.

**Deliverables:** Production schema, migration/import tools, administrator master-data screens, permission matrix, and opening-balance import report.

**Exit criteria:** An administrator can onboard the four Crystal machines, the remaining equipment, approved materials, and staff without editing the database directly.

### Phase 2 — Job orders and simple material requests

**Goal:** Make job tracking and store-to-workshop custody clear without overloading operators.

**Tasks:** Expand job intake, priority and due-date handling, assignment history, one-tap material request, storekeeper issue confirmation, optional operator receipt acknowledgement, exception handling for short stock or unusual quantities, a simple balance view, and immutable audit events.

**Deliverables:** Job-order board, simple request queue, one-screen store issue flow, optional receipt action, discrepancy queue, and administrator oversight.

**Exit criteria:** A pilot job can move from order creation to material request, store issue, optional receipt acknowledgement, production, and simple balance confirmation in a few clear actions.

### Phase 3 — Crystal machine production workflows

**Goal:** Capture production accurately across the confirmed Crystal machines.

**Tasks:** Create common operator workflow components, add machine-specific input types, assign operators, record production input/output/waste/rework, support pause and maintenance states, perform quality checks, and connect consumption to the requisition and job order.

**Deliverables:** Crystal Print and Cut, DTF, Laser Cutter 1325, and UV Flat bed workspaces; machine assignment controls; production and quality history; machine status dashboard.

**Exit criteria:** Operators can execute and close representative jobs on each of the four Crystal machine types with material and production quantities reconciled.

### Phase 4 — Reports, audit, and reconciliation

**Goal:** Provide management visibility and monthly audit evidence.

**Tasks:** Complete daily report, weekly report, bi-weekly report, monthly audit pack, stock reconciliation, machine utilization, planned-versus-actual analysis, waste and scrap analysis, signed-requisition report, discrepancy report, export, filters, and append-only audit log.

**Deliverables:** Report center, audit-log center, exportable reports, variance explanations, and report-period controls.

**Exit criteria:** Management can reproduce one complete pilot reporting period and explain every material variance.

### Phase 5 — Testing, migration, deployment, and training

**Goal:** Operate safely with real staff and real data.

**Tasks:** Clean and import approved master data, test permissions, test concurrent stock changes, test request/issue/receipt and discrepancy paths, run end-to-end UAT, configure production environments, verify backup and restoration, train users, and publish operating procedures.

**Deliverables:** Production deployment, migration log, test evidence, backup/recovery runbook, user guides, training record, and acceptance certificate.

**Exit criteria:** YT Advertisement signs acceptance and can complete the pilot workflow without developer intervention.

## 9. Test strategy

| Test category | Minimum coverage |
|---|---|
| Unit tests | Unit conversion, quantity validation, waste calculation, report-period boundaries, and state-transition rules. |
| Authorization tests | Each role can perform only its approved actions; UI restrictions are not considered sufficient. |
| Inventory integration tests | Receiving, issue, partial issue, return, scrap, offcut, correction, insufficient stock, and concurrent movement cases. |
| Material-request tests | Request, issue, receipt acknowledgement, short stock, partial issue, discrepancy, and simple balance confirmation. |
| Production tests | Four Crystal machine types, production logs, rework, quality, material consumption, and completion. |
| Audit tests | Actor, timestamp, source record, before/after values, correction history, and append-only behavior. |
| Report tests | Daily, weekly, bi-weekly, and monthly boundaries; opening/closing balance; empty periods; and seeded/opening data separation. |
| End-to-end tests | Order → material request → issue → optional receipt acknowledgement → production → quality → closure → report. |
| Security tests | Session handling, inactive user access, role escalation, secret exposure, and unauthorized mutation attempts. |
| Operational tests | Backup, restore, deployment rollback, mobile browser use, slow network, and offline/retry behavior. |

## 10. Production-readiness checklist

The system is ready for production only when:

- Real production and development environments are separated.
- No access keys, session identifiers, passwords, or secrets are stored in source control or seed data.
- Every backend mutation validates the active profile and role.
- Stock changes are atomic, indexed, and protected against insufficient quantity and duplicate submission.
- Operational records are not hard-deleted.
- Audit events are append-only and include actor, timestamp, source, and reason.
- The Ethiopia reporting timezone and daily/monthly cutoff are configured and tested.
- Opening balances are imported with a documented migration report.
- The four Crystal machines and all approved materials are onboarded with verified master data.
- Daily, weekly, bi-weekly, and monthly reports reconcile against source records.
- Backup restoration has been tested successfully.
- UAT is completed by the General Manager, storekeeper, and representative operators.
- Staff are trained on material requests, one-step issue/receipt actions, production logs, corrections, and audit review.

## 11. Immediate next actions

1. Confirm the final General Manager name and the meaning of “Conca.”
2. Photograph or record the nameplate/model details for the four Crystal machines.
3. Confirm the exact DTF width and Laser Cutter 1325 dimensions/specification.
4. Confirm the lightweight material flow: request → issue → optional receipt acknowledgement, with approval or signature only for exception cases.
5. Approve the first pilot users and machine operators.
6. Prepare the approved 26-material import sheet with normalized units, storage locations, opening quantities, reorder rules, and scrap rules.
7. Select one banner-printer or Crystal-machine pilot job and one simple balance-check period.
8. Implement Phase 1 before importing live balances or allowing production stock movements.

## References

[1]: https://github.com/yoh-space/yt-ads "Current YT Advertisement operations-control repository"
[2]: https://github.com/yoh-space/yt-ads/blob/main/convex/schema.ts "Current Convex data schema"
[3]: https://github.com/yoh-space/yt-ads/blob/main/convex/seed.ts "Current demo seed records"
[4]: https://github.com/yoh-space/yt-ads/blob/main/convex/jobs.ts "Current job and production handlers"
[5]: https://github.com/yoh-space/yt-ads/blob/main/convex/materials.ts "Current material and stock handlers"
[6]: https://github.com/yoh-space/yt-ads/blob/main/convex/reports.ts "Current report aggregation"
[7]: https://github.com/yoh-space/yt-ads/blob/main/convex/audit.ts "Current activity feed"
