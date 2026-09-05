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

## Delivery phases

1. Schema and shared physical-package types.
2. Conversion-aware transfer projections and allowance status calculation.
3. Service recipes and multi-material job snapshots.
4. Operator multi-line request interface.
5. Storekeeper multi-line handover interface.
6. Production monitoring, warnings, and reconciliation.
7. Migration, audit verification, and end-to-end tests.

## Phase 2 scope

Phase 2 adds package-aware request and issue fields, preserves legacy requests, updates operator stock projections with package/base balances, and introduces shared allowance-status calculation. It does not yet replace the operator modal or generate service recipes automatically.
