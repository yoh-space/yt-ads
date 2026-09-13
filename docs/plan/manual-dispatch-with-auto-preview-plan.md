# Receptionist-Reviewed Dispatch with Auto Recommendation

## Implementation Plan

**Repository:** `yoh-space/yt-ads`  
**Latest pulled branch:** `main` at `c3a3cdd`  
**Scope:** Replace hidden full auto-dispatch with a visible auto recommendation that Reception reviews, accepts, or overrides before Job Card creation.  
**Implementation status:** Planning only. No application source files were modified for this plan.

---

## 1. Executive Decision

The system should **not** use full automatic machine dispatch as the final authority. The correct production model is:

> **Auto-recommend, human-confirm, audit deviations.**

The auto-router remains useful for load balancing and for reducing routine receptionist work. It should produce a default recommendation rather than silently creating a Job Card from an unverified decision.

The receptionist confirmation step should display:

- The recommended machine.
- The recommended material.
- The calculated quantity and unit.
- The reason for the recommendation.
- Any route, material, capability, or availability warnings.
- A machine and material selector for authorized manual override.

The receptionist may accept the recommendation or select a different valid machine/material combination. The selected values are sent explicitly to `confirmOrderAndIssueJobCard`.

Every override should be recorded with the recommendation, final selection, actor, reason, and timestamp. The override audit is observational rather than a new approval gate.

---

# 2. Current Architecture and Confirmed Gaps

## 2.1 Existing preview path

The current code already provides `api.orders.previewAutoRouting` as a read-only query. It calls:

```text
previewAutoRouting
  → resolveAutoRouting
  → validateDispatchResources
  → material breakdown calculation
```

The preview returns the recommended:

- `machineId`
- `machineName`
- `materialId`
- `materialName`
- `materialType`
- `netBaseQuantity`
- `plannedBaseQuantity`
- `approvedScrapQuantity`
- `unit`
- Waste and scrap limits
- Resource warnings
- Material and ink checks
- Production breakdown

The preview is therefore the correct starting point for a human-reviewed dispatch flow.

## 2.2 Existing confirmation contract

`confirmOrderAndIssueJobCard` already accepts explicit assignment fields:

```text
machineId
materialId
quantity
unit
```

When any explicit assignment field is present, the mutation validates that all four fields are supplied and then creates the Job Card using the explicit values.

This means the backend already contains most of the manual override plumbing. The missing work is primarily:

1. Expose the fields in the Reception UI.
2. Fetch valid machine/material choices.
3. Pass the selected values through the parent callback.
4. Record whether the final choice differs from the recommendation.
5. Ensure explicit selections are validated against service capabilities and Owner-approved route options.

## 2.3 Current UI behavior that must change

The confirmation modal currently has these behaviors:

- It calls `previewAutoRouting`.
- It shows the recommendation as “Auto-Calculated.”
- It sets `dispatchBlocked` when the preview is unavailable or errors.
- It renders the button as “Confirm & Auto-Create Job Card.”
- Its subtitle says manual allocation is disabled per ERP rules.
- Its `onSave` payload contains only payment decision, payment method, advance amount, and priority.
- It does not expose machine or material selectors.

This is the main product gap. The backend supports manual assignment, but the UI prevents Reception from using it.

## 2.4 Current router behavior

The latest `compatibleMachines` implementation now requires operator-role compatibility and checks normalized technical capabilities when capability metadata exists. It also contains a deliberate fallback that allows role matching when a machine has no capability metadata.

The pasted proposal says to keep `resolveAutoRouting` unchanged for this feature. That is appropriate for the first phase. The manual-review flow should not depend on pretending the current recommendation is always correct.

A separate routing-hardening phase should later decide whether the no-capability role fallback is safe after catalog coverage is complete. It should not be silently removed in this feature because incomplete legacy machine records may otherwise become unroutable.

## 2.5 Known failure mode

When the preview cannot resolve a route, active material, or compatible machine, the query returns a diagnosable Convex error. The modal currently blocks confirmation because no preview exists.

That creates a dead end. A human-reviewed flow should distinguish between:

| Condition | Correct behavior |
|---|---|
| Recommendation available and valid | Preselect it and allow acceptance or override. |
| Recommendation unavailable but valid manual options exist | Show the reason and allow manual selection. |
| No valid machine/material option exists | Block Job Card creation with an actionable diagnostic. |
| Machine is maintenance/unavailable | Exclude it from choices and explain why. |
| Material is inactive or missing | Exclude it and direct Owner/Admin to catalog configuration. |
| Stock is empty | Do not block Reception Job Card creation; operator stock gating remains downstream. |

The system must not confuse “auto-router cannot decide” with “the order cannot be created.”

---

# 3. Target Dispatch Workflow

## 3.1 Stage A — Order review

Reception opens the order confirmation modal after reviewing customer details and payment decision.

The system loads the routing preview and a list of valid manual options.

The modal displays the recommendation as the initial selection.

## 3.2 Stage B — Recommendation review

The recommendation card should show:

- Machine name and machine code.
- Machine status.
- Service capability matched.
- Material name and variant.
- Planned base quantity.
- Unit.
- Waste and scrap allowance.
- Resource warnings.
- A concise recommendation explanation.

Example explanation:

```text
Recommended because this machine supports PRINT_ROLL_3_2M and currently has the lowest unfinished-job load among Owner-approved banner machines.
```

The explanation should be generated from structured route and load data, not hardcoded per service.

## 3.3 Stage C — Manual override

Reception can choose:

- `Use recommendation`.
- `Choose another machine`.
- `Choose another approved material variant`.

The machine selector must list only machines that are:

- Active.
- Not in maintenance or unavailable state.
- Approved for the service by the database-first machine/service configuration.
- Compatible with the required canonical capability unless the Owner has explicitly configured an exception.

The material selector must list only material options that are:

- Active.
- Approved for the service.
- Compatible with the selected machine and service route.
- Valid for the customer’s selected specifications.

If the selected machine changes the compatible material set, refresh the material options and preserve the selection only if it remains valid.

## 3.4 Stage D — Quantity and unit

When the recommendation is selected, use the preview allocation as the default quantity and unit.

When Reception selects a manual material, recalculate the allocation on the server. The client may show a preview, but the server remains authoritative.

The quantity field should be editable only if the business wants Reception to override the calculated material amount. If quantity editing is exposed, the UI must clearly label it as an explicit production allocation override and require a reason.

The safer first version is:

- Allow machine and material override.
- Keep calculated quantity server-authoritative for the selected material.
- Add manual quantity override only in a later Owner-approved phase.

## 3.5 Stage E — Confirmation

The final button should be contextual:

- `Confirm & Issue Job Card` when using the recommendation.
- `Confirm Override & Issue Job Card` when the selection differs.

The final confirmation payload must include:

```text
paymentDecision
paymentMethod
advancePaidAmount
priority
machineId
materialId
quantity
unit
routingDecision
routingOverrideReason
```

`routingDecision` can be represented as a small structured object or normalized mutation fields:

```text
routingDecision: "RECOMMENDED" | "MANUAL_OVERRIDE"
recommendedMachineId
recommendedMaterialId
finalMachineId
finalMaterialId
routingOverrideReason
```

The server must recompute and validate the routing decision instead of trusting client-supplied recommendation fields.

---

# 4. Backend Design

## 4.1 Add a dispatch-options query

Create a query that returns both the recommendation and valid manual choices:

```text
orders.getDispatchOptions({ orderId })
```

It should return:

```text
{
  order,
  recommendation,
  machineOptions,
  materialOptions,
  warnings,
  canCreateJobCard
}
```

Each machine option should include:

| Field | Purpose |
|---|---|
| `machineId` | Stable database identity. |
| `code` | Owner-facing machine code. |
| `name` | Display name. |
| `status` | Available, running, maintenance, unavailable. |
| `operatorRole` | Responsible operator role. |
| `capabilities` | Canonical capability IDs. |
| `unfinishedJobCount` | Load-balancing context. |
| `eligible` | Whether it can be selected. |
| `ineligibleReason` | Actionable reason when excluded. |
| `isRecommended` | Whether it is the auto-router choice. |

Each material option should include:

| Field | Purpose |
|---|---|
| `materialId` | Stable material identity. |
| `name` | Display name. |
| `materialVariantId` | Canonical variant identity if available. |
| `baseUnit` | Server-authoritative production unit. |
| `calculatedQuantity` | Quantity for the selected order and material. |
| `compatibleMachineIds` | Approved machines. |
| `eligible` | Whether it can be selected. |
| `ineligibleReason` | Actionable exclusion reason. |
| `isRecommended` | Whether it is the recommendation. |

The query should use the database-first `serviceMachineOptions` and machine-service route configuration where available. It should not expose every active machine in the database merely because it shares an operator role.

## 4.2 Refactor shared resolution logic

Avoid duplicating route logic between preview, dispatch options, and confirmation. Extract a shared resolver with two modes:

```text
resolveDispatchRecommendation(ctx, order)
resolveDispatchSelection(ctx, order, explicitSelection)
```

The first resolves the recommendation and load context. The second validates a selected machine/material pair and recalculates the allocation.

Both must use the same:

- Service route.
- Machine option records.
- Capability normalization.
- Material compatibility rules.
- Machine availability rules.
- Owner-configured service options.

## 4.3 Validate manual machine selection

At confirmation time, validate:

1. The machine exists and is active.
2. The machine is not in `Maintenance` or `Unavailable` state.
3. The machine is approved for the order’s service.
4. The machine supports the route’s required canonical capabilities, unless an Owner-configured explicit exception exists.
5. The machine’s operator role is valid for the service route.
6. The selected material exists and is active.
7. The material is approved for the service.
8. The selected material is compatible with the machine and route.
9. The calculated unit matches the material’s base unit.
10. The selected values are still valid at transaction time.

The mutation should reject stale or forged UI options with a structured `INVALID_DISPATCH_SELECTION` error.

## 4.4 Preserve inventory decoupling

Reception dispatch should continue to create and queue the Job Card even if raw materials are currently unavailable. The earlier operator-material dependency design makes the operator responsible for the start-production stock gate.

Therefore:

- Machine/material selection validates production compatibility.
- It does not require central or machine stock.
- Resource shortages appear as warnings.
- Operator `start` remains the authoritative stock gate.

## 4.5 Add override audit data

The current `configChangeLog` is designed for Owner catalog mutations, not operational dispatch decisions. Do not overload it for every Reception override.

Use a dedicated operational audit table, for example `routingDecisionLogs`, with:

```text
orderId
jobCardId
serviceId
recommendedMachineId
recommendedMaterialId
finalMachineId
finalMaterialId
decision: RECOMMENDED | MANUAL_OVERRIDE
reason
actorAuthUserId
createdAt
```

The record should be inserted in the same mutation that creates the Job Card, so a Job Card cannot exist without its dispatch decision log.

If the data model already has an operational event or job audit table suitable for this purpose, extend that table instead of creating a duplicate log.

## 4.6 Override reason policy

The first release should make an override reason required only when the final selection differs from the recommendation.

Use a short controlled reason list plus optional notes:

| Reason code | Example |
|---|---|
| `CUSTOMER_SPECIFICATION` | Customer order requires a specific machine capability. |
| `PRICE_OR_QUOTE_RULE` | Quoted price or package includes a specific production line. |
| `MACHINE_AVAILABILITY` | Recommended machine is unavailable or reserved. |
| `MATERIAL_VARIANT` | Customer or Owner selected a specific material variant. |
| `OPERATOR_INSTRUCTION` | Owner/Manager directed this assignment. |
| `OTHER` | Free-text explanation required. |

The reason should not be used to punish Reception. Its purpose is to generate evidence for future routing improvements.

---

# 5. Frontend Design

## 5.1 Modal state model

Replace the current implicit auto-only state with explicit state:

```text
selectionMode: "RECOMMENDED" | "MANUAL"
selectedMachineId
selectedMaterialId
overrideReasonCode
overrideNote
```

Initialize:

```text
selectionMode = "RECOMMENDED"
selectedMachineId = recommendation.machineId
selectedMaterialId = recommendation.materialId
```

When the recommendation query errors:

- Keep the modal open.
- Show the diagnosable error.
- Load manual options if possible.
- Allow manual dispatch when a valid option exists.
- Block only when no valid option remains.

## 5.2 Recommendation card

Rename the current “Auto-Calculated” badge to “Recommended by routing.”

Use clear language:

```text
Recommended machine
```

Avoid implying the selection is final until the receptionist confirms it.

Display a small “Change assignment” control next to the recommendation.

## 5.3 Manual assignment panel

The panel should contain:

- Machine selector with code, name, status, capabilities, and load.
- Material selector filtered by the selected machine and service.
- Calculated quantity and unit.
- Warnings for inactive, maintenance, unavailable, or stock-related conditions.
- Override reason selector and note.
- A reset action to return to the recommendation.

Use existing dark ERP styling and shared status badges. Do not introduce a separate visual language.

## 5.4 Error and fallback behavior

The existing ConvexError display is useful and should remain. Extend it so the modal can show two different states:

1. `Recommendation unavailable, manual options available.`
2. `No valid dispatch option available.`

Do not show a generic “contact owner” message when the user can solve the issue by selecting another machine.

## 5.5 Parent callback and mutation wiring

Update the modal `onSave` type to include:

```text
machineId
materialId
quantity
unit
routingDecision
routingOverrideReason
routingOverrideNote
```

Update the Reception page callback to pass these fields to:

```text
api.orders.confirmOrderAndIssueJobCard
```

The mutation should receive the explicit selection even when it equals the recommendation. This makes the final decision unambiguous and avoids hidden fallback behavior.

---

# 6. Observability and Routing Learning Loop

## 6.1 Metrics

Track:

- Total dispatches.
- Recommendation acceptance rate.
- Manual override rate.
- Overrides by service.
- Overrides by recommended machine.
- Overrides by final machine.
- Override reasons.
- Recommendation failures.
- Manual fallback usage after recommendation failure.
- Job reassignments after creation.
- Production start blocks caused by machine/material mismatch.

## 6.2 Operational dashboard

The Owner dashboard should eventually show:

| Metric | Purpose |
|---|---|
| Recommendation acceptance rate | Measures how useful the router is. |
| Override rate | Identifies services where automatic logic is unreliable. |
| Top override reason | Shows missing business context. |
| Recommendation failure rate | Shows catalog or route coverage gaps. |
| Machine load imbalance | Validates load-balancing behavior. |
| Reassignment rate | Detects decisions that looked valid but failed operationally. |

This data should guide a future decision about whether to add quote/price/specification context to routing.

## 6.3 Future price/specification routing

Do not add price-dependent routing rules to the current service-type resolver as hidden conditionals.

If the business later wants automatic routing based on price or customer specifications, model those inputs explicitly:

```text
serviceMachineOptions:
  serviceId
  machineId
  requiredSpecificationRules
  quoteTier
  priceRange
  priority
  active
```

The route must then be deterministic, explainable, and testable. Until that data exists, the human-reviewed override is the correct business behavior.

---

# 7. Implementation Phases

## Phase 0 — Confirm business rules

Confirm with the Owner:

1. Which machines are valid for each service.
2. Whether a selected material can be changed independently of the machine.
3. Whether Reception may override the calculated quantity.
4. Which override reasons should be available.
5. Whether manual dispatch is allowed when the recommendation query fails.
6. Whether all active machines or only database-configured `serviceMachineOptions` are eligible.
7. Whether the explicit machine choice should override load balancing without additional approval.

### Exit criteria

The machine/service/material decision matrix is approved and stored in the Owner configuration model.

## Phase 1 — Backend dispatch options

Implement:

- Shared dispatch recommendation/selection resolver.
- `getDispatchOptions` query.
- Database-configured valid machine/material options.
- Structured eligibility and error codes.
- Server-side selected-machine/material validation.

### Exit criteria

The backend can return a recommendation plus valid manual choices for every active service.

## Phase 2 — Reception UI

Implement:

- Visible recommendation card.
- Machine selector.
- Material selector.
- Manual allocation state.
- Recalculated quantity/unit preview.
- Override reason and note.
- Fallback selection when recommendation fails.
- Contextual confirmation button.

### Exit criteria

Reception can accept a recommendation or select a valid override without editing source data or using hidden APIs.

## Phase 3 — Confirmation and audit

Implement:

- Expanded confirmation payload.
- Atomic routing decision log.
- Override reason persistence.
- Job Card linkage.
- Idempotent confirmation behavior.

### Exit criteria

Every Job Card has a recorded final dispatch decision and, when applicable, the original recommendation and override reason.

## Phase 4 — Tests and regression protection

Add tests for:

- Recommendation selected without override.
- Valid manual machine override.
- Valid manual material override.
- Invalid machine for service.
- Invalid material for service.
- Inactive machine.
- Maintenance machine.
- Unavailable machine.
- Missing recommendation with valid manual fallback.
- Missing recommendation with no valid fallback.
- Stock empty but Job Card still created.
- Unit mismatch.
- Capability mismatch.
- Operator-role mismatch.
- Override reason required when selection differs.
- No reason required when recommendation is accepted.
- Audit log captures recommendation and final selection.
- Duplicate confirmation does not create duplicate Job Cards.

## Phase 5 — Rollout and monitoring

Roll out in this sequence:

1. Deploy backend options and audit support.
2. Enable the manual-review UI behind a feature flag if available.
3. Compare recommendation and final selection in production.
4. Monitor override and failure metrics.
5. Remove the auto-only UI language.
6. Keep the router as a recommendation engine until sufficient evidence supports further automation.

---

# 8. Acceptance Criteria

The feature is complete when:

1. Reception sees the computed machine/material recommendation before confirmation.
2. The recommendation is preselected but not hidden or final by default.
3. Reception can choose another approved machine.
4. Reception can choose another approved material where business rules permit it.
5. The UI never lists an invalid machine/material combination as selectable.
6. The backend revalidates the final selection at confirmation time.
7. A failed recommendation does not create an opaque dead end when a valid manual option exists.
8. A Job Card is blocked only when no valid dispatch option exists or the order/payment requirements are incomplete.
9. Raw-material stock shortages do not block Reception Job Card creation; operator start-production stock checks remain authoritative.
10. The final selection is passed explicitly to `confirmOrderAndIssueJobCard`.
11. The final quantity and unit are recalculated and validated server-side.
12. Manual overrides require a controlled reason and optional note.
13. Every dispatch records whether it accepted or overrode the recommendation.
14. The current auto-router remains available for load balancing and default selection.
15. No hidden role-only machine fallback is introduced for configured production routes.
16. The existing ConvexError diagnostics remain visible and actionable.
17. Routing tests cover both automatic recommendation and manual selection.
18. The implementation is compatible with the canonical production manifest and database-first machine/service configuration.

---

# 9. Recommended Immediate Action

The first implementation slice should be small and verifiable:

1. Add `getDispatchOptions` using the existing preview and database-configured machine options.
2. Extend `OrderConfirmModal` to show a machine selector with the recommendation preselected.
3. Pass `machineId`, `materialId`, `quantity`, and `unit` through the existing confirmation callback.
4. Reuse the current explicit-assignment branch in `confirmOrderAndIssueJobCard`.
5. Add a routing decision audit record.
6. Add focused tests for recommendation acceptance, valid override, invalid override, and preview failure with manual fallback.

Do not begin by rewriting `resolveAutoRouting`. Do not enable silent full auto-dispatch again. The immediate goal is to make the existing recommendation visible, correctable, and auditable.

---

## References

[1]: /home/ubuntu/yt-ads/convex/orders.ts "Order routing preview and Job Card confirmation mutations"

[2]: /home/ubuntu/yt-ads/convex/orderAutomation.ts "Machine compatibility and load-balancing helpers"

[3]: /home/ubuntu/yt-ads/convex/owner/serviceMachineOptions.ts "Owner-configured service machine option management"

[4]: /home/ubuntu/yt-ads/convex/owner/machineServiceRoutes.ts "Owner-configured machine service route management"

[5]: /home/ubuntu/yt-ads/src/components/dashboard/roles/common/orders.tsx "Reception order confirmation modal and current auto-only dispatch UI"

[6]: /home/ubuntu/yt-ads/convex/test/orders.test.ts "Routing preview diagnostics and order routing tests"

[7]: /home/ubuntu/yt-ads/convex/test/serviceMachineOptions.test.ts "Service machine option validation tests"

[8]: /home/ubuntu/yt-ads/src/shared/production-manifest.ts "Canonical machine, capability, service, and route manifest"
