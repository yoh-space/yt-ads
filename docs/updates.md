# Raw Material Custody and Usage Architecture

## Objective

Operators request physical packages, storekeepers transfer physical packages, and production records actual usage in conversion units. Physical custody remains the operational truth while conversion units support usage, remaining balance, scrap monitoring, reconciliation, and audit.

## Core rules

- Requests and transfers use rolls, sheets, packages, canisters, or pieces.
- Conversion ratios are not the primary transfer/status language.
- Conversion ratios are snapshotted for usage and audit history.
- Production usage uses normal output metrics such as m², metres, litres, or pieces.
- The UI displays physical custody first and actual converted usage/remaining second.
- No stock cycle may be silently cleared when usage exceeds the approved allowance.

## Data model

- Materials carry physical package metadata and conversion information.
- Operator stock stores package balances separately from converted balances.
- Material requests support a request header and multiple material lines.
- Service recipes define fixed, area-based, linear, and quantity-based raw-material requirements.
- Job material requirements store an immutable recipe calculation snapshot.
- Production logs store planned usage, approved scrap allowance, and allowance status.

## Transfer flow

1. An operator selects an active job.
2. The operator requests one or more physical package quantities.
3. Clearance rules block new requests while prior stock is active or awaiting review.
4. The storekeeper issues whole or partial packages.
5. A transaction updates parent package stock, operator custody, converted audit balance, and the stock ledger.
6. The operator receives the issue notification and can reconcile the assigned stock.

## Production and monitoring

Production deductions consume converted units from operator stock. The system retains the physical package count and displays actual usage and converted remaining quantity. It does not describe inventory as partially used.

Allowed consumption is:

```text
planned production usage + owner/admin approved scrap allowance
```

Usage states are:

- `NORMAL`: at or below 80% of allowed usage.
- `WATCH`: above 80%.
- `CRITICAL`: above 95%.
- `EXCEEDED`: above 100%.

Exceeded usage creates an auditable exception and notifies owner, admin, and manager. The original ledger events remain immutable.

## Multi-material services

Services such as Light Box may reference multiple raw materials. When a job is created, the active service recipe is calculated and snapshotted into job material requirements. Later recipe edits do not change existing jobs.

## Authorization

- Owner/admin manage recipes, conversion rules, and scrap allowances.
- Managers monitor usage but cannot change protected thresholds.
- Storekeepers issue physical packages but cannot alter historical conversion snapshots.
- Operators request, consume, and reconcile assigned materials but cannot approve their own exceptions.

## Complete delivery plan

### Phase 1 — Physical-package foundation

- Add package units and package metadata without removing legacy base-unit fields.
- Add package-aware shared frontend/backend types and canister conversion support.
- Preserve existing requests, jobs, stock movements, and material records during migration.
- Verify schema compatibility, type safety, and unit conversion behavior.

### Phase 2 — Conversion-aware custody projections

- Store requested and issued package quantities on material requests.
- Track issued, remaining, consumed, and converted base quantities on operator sub-stock.
- Snapshot conversion ratios on custody and production events.
- Calculate `NORMAL`, `WATCH`, `CRITICAL`, and `EXCEEDED` allowance states.
- Record planned usage and approved scrap allowance on production logs.
- Keep physical packages primary in transfer workflows and converted units primary for usage/audit.

### Phase 3 — Service recipes and multi-material job snapshots

- Allow owner/admin users to create, update, activate, deactivate, and list service material recipes.
- Support fixed, area-rate, linear-rate, and quantity-rate recipe requirements.
- Validate materials, ratios, allowance percentages, and duplicate active recipe lines.
- Extend job creation with an optional service type and dimensions.
- Calculate each job's material requirements from the active recipe and snapshot them immutably.
- Convert planned base quantities into suggested physical package quantities using the material ratio.
- Keep the legacy primary `jobCards.materialId` path working for jobs without recipes.

### Phase 4 — Operator multi-line request interface

- Replace the single-material request modal with a multi-line physical-package builder.
- Show package quantities as the editable primary value.
- Show conversion equivalents as read-only planning information.
- Validate line quantities, active jobs, clearance rules, and duplicate materials.
- Create one grouped request with line-level records and preserve legacy compatibility.

### Phase 5 — Storekeeper multi-line handover

- Add a grouped requisition queue for pending operator requests.
- Support full issue, partial issue, shortages, and line-level status.
- Decrement parent packages transactionally and create operator custody projections.
- Require storekeeper/manager/owner authorization and preserve immutable conversion snapshots.
- Show package custody first, converted usage/remaining second.

### Phase 6 — Production monitoring and asset protection

- Deduct converted usage from the correct operator material line.
- Surface usage and remaining balances in operator, storekeeper, manager, and owner workspaces.
- Show proactive warnings before and after approved scrap allowances are exceeded.
- Create auditable overuse exceptions and notify owner, admin, and manager.
- Add reconciliation actions that never erase original ledger events.

### Phase 7 — Migration, audit, and release verification

- Backfill package metadata and recipe data where source data is reliable.
- Rehearse legacy-to-package migration on a preview deployment.
- Verify wrong-role, over-issue, duplicate-line, and overuse rejection cases.
- Run end-to-end tests for Light Box and other multi-material services.
- Run `pnpm check`, `pnpm test`, production build, Convex code generation, and deployment validation.
- Deploy only after explicit production approval and confirm rollback/audit procedures.

## Completed scope

Phase 1 and Phase 2 are complete. They established package-aware custody, converted usage projections, allowance status calculation, and backward-compatible schema fields. Phase 3 is the current implementation scope; operator and storekeeper UI changes remain intentionally deferred to Phases 4 and 5.
