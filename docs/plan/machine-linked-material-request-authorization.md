# Machine-Linked Material Request Authorization Plan

**Status:** Approved for implementation planning; runtime implementation is not included in this document.

**Repository:** `yoh-space/yt-ads`

**Objective:** Allow machine operators to request raw materials from the main store only when the owner has explicitly linked those exact operational material records to the operator’s machine.

## 1. Executive Decision

`machineMaterialLinks` will become the authoritative machine-level permission for operator material requests.

An operator may request a material only when all of the following conditions are true:

```text
operator is authorized for the machine
AND selected job belongs to that machine
AND exact operational material is active
AND exact machine-material link exists
AND machine-material link is active
AND material is allowed by the selected job
```

The job’s material requirements remain the production-demand boundary. The active machine-material link becomes the machine-compatibility and owner-authorization boundary. Both conditions are required. A material linked to a machine but not required by the selected job must not be requestable for that job.

> **Final rule:** Owner configuration determines which exact materials a machine may request; job configuration determines which of those linked materials are needed for the current production task.

## 2. Current State and Gap

The repository already contains the required foundation:

| Component | Current behavior | Required change |
|---|---|---|
| `machineMaterialLinks` | Stores exact `machineId` and `materialId` relationships with active lifecycle | Use active links during request eligibility and mutation validation |
| Owner machine configuration UI | Allows owners to create, edit, archive, and restore material links | Add clear request-authorization wording and link-state indicators |
| `getMaterialRequestEligibilityInternal` | Builds options from job primary material and `jobMaterialRequirements` | Intersect job materials with active links for the selected machine |
| `createMaterialRequestInternal` | Validates job membership, active material, machine scope, and custody | Revalidate active machine link for every request line |
| Operator request modal | Displays server eligibility options | Display linked-material status and block unlinked options without fallback |
| Main store issue flow | Issues by the requested operational material ID | Preserve the same exact `materials` ID through request, issue, and operator sub-stock |

The current gap is that eligibility and request creation do not consult `machineMaterialLinks`. Consequently, an owner-created link is not sufficient to permit a request, and an unlinked job material may still be requestable if it is present in the job requirements.

## 3. Scope and Non-Goals

### In scope

This phase will implement machine-linked authorization for operator material requests, including query filtering, mutation validation, UI messaging, owner configuration validation, tests, and migration diagnostics.

### Out of scope

This phase will not redesign inventory ledger accounting, change material IDs, rewrite historical requests, introduce service BOM routing, or automatically create job material requirements from machine links. Those systems may consume the same link relationship later, but they must not be silently changed in this phase.

## 4. Target Data Contract

### 4.1 Exact operational material identity

`machineMaterialLinks.materialId` must reference the operational `materials` row used by inventory and requests. The system must not authorize requests using material names, catalog family names, aliases, `materialCatalog.id`, or display labels.

The referenced operational material must be active. Archived materials cannot be linked or requested.

### 4.2 Active link semantics

A link is request-authorizing only when `active === true`. Archived links remain available for audit history but do not authorize new requests.

`relationshipType` controls meaning and display. It does not, by itself, grant request permission beyond the active link. The first implementation should permit all existing relationship types that represent consumable stock:

| Relationship type | Request behavior |
|---|---|
| `primary` | Requestable when required by the selected job |
| `supported` | Requestable when required by the selected job |
| `ink` | Requestable when required by the selected job or ink requirement |
| `solvent` | Requestable when required by the selected job or route requirement |
| `accessory` | Requestable when required by the selected job |
| `consumable` | Requestable when required by the selected job |

The `required` field indicates production criticality and must be returned to the operator UI. It does not make a material globally requestable for every job.

### 4.3 Link uniqueness

There must be at most one active link for a given `(machineId, materialId, relationshipType)` combination. The existing backend check should remain, and a schema index or migration diagnostic should identify duplicate active rows.

If the business later needs multiple versions of the same relationship, the link must use effective dates and a single active version. The request query must never return multiple authorization rows for the same operational material.

## 5. Backend Implementation

### 5.1 Add a shared link resolver

Create a shared internal helper in `convex/machineMaterialAuthorization.ts` or an equivalent module. The helper should accept a machine ID and a set of operational material IDs, then return active authorization records indexed by material ID.

The helper must:

1. Query `machineMaterialLinks` using the machine/material index when possible.
2. Filter `active === true`.
3. Resolve the linked operational material record.
4. Exclude missing or archived material records.
5. Return link metadata such as relationship type, production type, required flag, conversion override, waste margin, and notes.
6. Avoid name-based matching and avoid catalog fallback.

The helper must be reusable by both eligibility queries and request mutations so read and write behavior cannot drift.

### 5.2 Update request eligibility

Update `getMaterialRequestEligibilityInternal` in `convex/materialRequests.ts` as follows:

1. Resolve the operator’s machine and job as currently implemented.
2. Build the candidate material ID set from the job primary material and `jobMaterialRequirements`.
3. Resolve active machine-material links for the selected machine and candidate IDs.
4. Intersect the candidate job materials with active linked materials.
5. Exclude any candidate without an active operational `materials` record.
6. Return link metadata with every allowed material.
7. Return a clear blocking reason when a job requires a material that is not linked to the machine.
8. Preserve custody, shortage, pending-clearance, and active-stock checks.
9. Preserve conversion snapshots from the owner-configured operational material and apply a link conversion override only when the existing production contract explicitly permits it.

Recommended result fields:

```text
{
  id,
  name,
  category,
  catalogFamily,
  inkColor,
  unit,
  baseUnit,
  packageUnit,
  conversionRatio,
  machineLinkId,
  relationshipType,
  productionType,
  required,
  conversionRatioOverride,
  wasteMarginPercent,
  isPrimary,
  isBlocked,
  blockReason
}
```

The query must distinguish these states:

| State | Operator result |
|---|---|
| Job material is active and linked | Selectable unless custody or shortage blocks it |
| Job material is active but not linked | Not selectable; show owner configuration error |
| Link exists but is archived | Not selectable; show inactive-link reason where useful |
| Link exists but material is archived | Not selectable; show inactive-material reason |
| Link exists but material is missing | Not selectable; report referential-integrity error |
| Material is linked but absent from job requirements | Not selectable for that job |

### 5.3 Update request mutation validation

Update `createMaterialRequestInternal` so every request line is validated against the same shared authorization helper before any request row is inserted.

For each line, validate:

- The material is an active operational material.
- The material belongs to the selected job’s primary material or material requirements.
- An active machine-material link exists for the selected machine.
- The submitted unit matches the operational material base unit.
- The submitted package unit matches the owner-configured purchase/package unit.
- The submitted quantity matches the server conversion ratio or approved link override.
- No unresolved shortage, active custody, or pending clearance blocks the request.

The mutation must not trust client-provided material names, category, relationship type, conversion ratio, waste margin, or link IDs. The client should submit exact material IDs, package quantities, units required by the current API contract, and optional notes. The server remains authoritative.

The validation must run before the first `materialRequests` or `materialRequestLines` insert to prevent partial multi-line requests.

### 5.4 Conversion override policy

The existing machine link includes `conversionRatioOverride`. The implementation must define its role explicitly before using it in request calculations.

Recommended policy:

- The operational material conversion ratio remains the main-store package-to-base conversion.
- A link override applies only to machine production consumption, not to central-store issuing, unless the owner configuration explicitly marks the override as a package conversion.
- Request creation stores the operational material conversion snapshot used for store issuance.
- Job consumption may separately snapshot the machine-link override.

This prevents a machine-specific production rate from incorrectly changing how the storekeeper converts rolls, sheets, canisters, or pieces during issuance.

### 5.5 Storekeeper and issuance compatibility

The storekeeper issue flow must continue to use `materialRequests.materialId` and resolve the same operational `materials` row. It does not need to authorize the machine link again for historical requests, but it must reject malformed requests that contain missing or archived material records according to the existing issue policy.

The issued `operatorSubStock` row must retain:

- Exact operational `materialId`.
- Machine ID.
- Operator ID.
- Parent inventory ID.
- Normalized material fields already required by the current stock model.

No material name or catalog ID should be used as a substitute.

## 6. Owner Configuration UX

Update the machine configuration Raw Materials tab so the owner can understand that the link controls operator request authorization.

Recommended labels:

- **Allow operator requests from main store** — derived from active link state.
- **Request relationship** — primary, supported, ink, solvent, accessory, or consumable.
- **Required for eligible jobs** — maps to the existing `required` field.
- **Active link** — controls authorization for new requests.

The material selector should show only active owner-configured operational materials. It should display the material name, category/family, unit, and current operational status.

The UI should warn when:

- A link points to an archived material.
- A material has no parent inventory configuration.
- A duplicate active relationship exists.
- A linked material is not present in any active job requirement yet.
- A required linked material has no valid conversion contract.

The owner should be able to archive a link without deleting the material or historical requests. Restoring a link should immediately make it eligible for future requests, subject to job requirements and other backend gates.

## 7. Job and Production Integration

This phase must not automatically add every linked material to every job. That would allow operators to request materials that are compatible with a machine but unnecessary for a specific task.

The production planning flow should eventually use active machine links when generating `jobMaterialRequirements`:

```text
service/job recipe material
→ exact operational material ID
→ selected machine active link
→ job material requirement
→ operator request option
```

For this phase, existing job requirements remain unchanged. Add diagnostics for jobs whose required material is not actively linked to their machine. The diagnostic should identify the job, machine, material, and missing link ID.

## 8. Migration and Data Integrity

Create an idempotent diagnostic or migration that:

1. Finds active job primary materials without an active machine link.
2. Finds active `jobMaterialRequirements` without an active machine link.
3. Finds active machine-material links pointing to missing or inactive materials.
4. Finds duplicate active links for the same machine, material, and relationship.
5. Finds linked materials without parent inventory configuration.
6. Does not create links automatically from names or static catalogs.
7. Produces an owner-review report before any automatic remediation.

Recommended remediation policy:

- Do not delete historical links, requests, or stock records.
- Archive invalid links only after owner review.
- Require the owner to create exact ID-based links for valid materials.
- Preserve existing jobs and allow historical reporting even when a link is later archived.

## 9. Frontend Operator Request Flow

The operator request page and modal must consume only the server eligibility response.

Required behavior:

1. Open the request modal with no global material list.
2. Load request options for the selected job and machine.
3. Show only active linked materials that the job requires.
4. Display relationship and required status.
5. Display an explicit configuration error when the job material is not linked.
6. Disable submission while request options are loading.
7. Never fall back to static material definitions, catalog rows, display-name matching, or all active materials.
8. Submit exact material IDs and quantities.
9. Refresh options after a job change or link lifecycle change.

The UI may show a blocked material for explanation, but blocked records must not be submitted and must remain blocked by the mutation.

## 10. Authorization and Security

The following checks remain mandatory:

- The caller is an authenticated machine operator.
- The caller’s role matches the machine operator role.
- The machine is within the caller’s assigned machine scope.
- The job belongs to the selected machine.
- The material is allowed by the job.
- The material is actively linked to the machine.
- The material is active.
- Custody and reconciliation rules permit a new request.

Frontend visibility is not an authorization mechanism. Every rule must be enforced in Convex mutations.

## 11. Testing Plan

### Backend tests

Add or extend tests for:

- Active owner link makes a job-required material eligible.
- Missing link blocks eligibility.
- Archived link blocks eligibility.
- Inactive material blocks eligibility even when the link is active.
- Linked but job-unrequired material is excluded.
- Multi-line requests require an active link for every line.
- Tampered material IDs are rejected.
- Tampered link IDs, relationship types, units, package units, and conversion ratios cannot broaden permission.
- Duplicate active relationships are rejected.
- Restored links become eligible for future requests.
- Historical requests remain readable after link archival.
- Missing parent inventory produces a configuration state without allowing malformed issuance.
- Main-store issuance retains the exact operational material ID.

### Frontend tests

Add tests for:

- No `api.materials.list` fallback in operator request flows.
- Only server eligibility options appear in the selector.
- Unlinked job materials display a configuration error.
- Loading eligibility disables submission.
- Job changes remove options from the previous job.
- Relationship type and required status are visible.

### Manual role matrix

| Actor | Expected behavior |
|---|---|
| Owner | Links exact raw materials to a machine and activates or archives links |
| Machine operator | Requests only active linked materials required by the selected job |
| Storekeeper | Issues the exact operational material requested by the operator |
| Manager/admin | Reviews request history and configuration errors without bypassing material identity rules |

## 12. Implementation Sequence

### Phase 1: Shared authorization helper

Create the active-link resolver and add schema/index diagnostics for duplicate and invalid links.

### Phase 2: Eligibility integration

Update server eligibility to intersect job-required material IDs with active machine links and return link metadata.

### Phase 3: Mutation enforcement

Apply the same shared resolver to every request line before any request insert. Preserve current unit, package, custody, shortage, and machine-scope checks.

### Phase 4: Owner UX clarification

Update the owner machine Raw Materials tab to make the request-authorization effect of active links explicit and display configuration warnings.

### Phase 5: Operator UI verification

Confirm that request screens use only server-scoped eligibility options and show clear missing-link states.

### Phase 6: Reconciliation diagnostics

Run the idempotent missing-link and invalid-link diagnostic. Resolve owner-reviewed configuration gaps.

### Phase 7: Regression verification

Run focused tests, full tests, TypeScript validation, and a manual role-matrix walkthrough.

## 13. Acceptance Criteria

The implementation is complete when:

1. An owner can link an exact active raw-material record to a machine.
2. An operator on that machine can request the linked material when the selected job requires it.
3. An operator cannot request the same material when the link is archived or absent.
4. A linked material that is not required by the selected job is not selectable.
5. Every request line is revalidated server-side against the active machine link.
6. No request flow uses a global material fallback, static catalog fallback, or name-based lookup.
7. Storekeeper issuance preserves the exact operational material ID.
8. Parent inventory and operator sub-stock remain consistent with the owner-configured operational material.
9. Missing links and invalid links are visible through owner diagnostics.
10. Historical requests remain readable after a link is archived.
11. Unit and package conversion snapshots remain stable for existing requests.
12. All focused tests, full tests, and `pnpm check` pass.

## 14. References

[1]: ../../convex/owner/machineMaterialLinks.ts "Owner machine-material link mutations and queries"

[2]: ../../convex/materialRequests.ts "Material request eligibility and request creation logic"

[3]: ../../src/app/(dashboard)/dashboard/owner/machines/configure/[machineId]/page.tsx "Owner machine configuration interface"

[4]: ../../src/components/dashboard/modals/material-request-modal.tsx "Operator material request modal"

[5]: ../../convex/schema.ts "Database schema for materials, machine links, and requests"

[6]: ../../docs/plan/owner-machine-production-service-management-plan.md "Owner machine production and material linkage architecture"
