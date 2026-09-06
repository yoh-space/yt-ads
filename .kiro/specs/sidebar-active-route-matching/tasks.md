# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Multi-Segment Non-Dashboard Href Activation
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate that `segments.includes("inventory/parent")` never matches
  - **Scoped PBT Approach**: Scope the property to the four known failing cases for reproducibility:
    - `isViewActiveForPathname("/dashboard/owner/inventory/parent", "/inventory/parent")` → expected `true`, actual `false`
    - `isViewActiveForPathname("/dashboard/owner/inventory/parent/rolls", "/inventory/parent")` → expected `true`, actual `false`
    - `isViewActiveForPathname("/dashboard/owner/inventory/substock", "/inventory/substock")` → expected `true`, actual `false`
    - `isViewActiveForPathname("/dashboard/storekeeper/inventory/parent", "/inventory/parent")` → expected `true`, actual `false`
  - Write a property-based test asserting: for any `(pathname, href)` where `href` does not start with `/dashboard/` and has >1 segment, and the pathname is a valid workspace-scoped path ending with or containing `href`'s segments, `isViewActiveForPathname` returns `true`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS — proves that multi-segment hrefs are never matched by `segments.includes()`
  - Document counterexamples found (all four above return `false` instead of `true`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Active-State Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology — observe UNFIXED code behavior for non-buggy inputs
  - Observe and record the following behaviors on UNFIXED code:
    - `isViewActiveForPathname("/dashboard/owner", "/dashboard/owner")` → `true` (overview exact match)
    - `isViewActiveForPathname("/dashboard/owner/inventory/parent", "/dashboard/owner")` → `true` (currently a false positive — NOTE this as the false-positive case to preserve-by-fixing)
    - `isViewActiveForPathname("/dashboard/owner/jobs", "/dashboard/owner/jobs")` → `true`
    - `isViewActiveForPathname("/orders", "/orders")` → `true`
    - `isViewActiveForPathname("/orders/123", "/orders")` → `true`
    - `isViewActiveForPathname("/dashboard/owner/inventory/parent", "/dashboard/owner/jobs")` → `false`
    - `isViewActiveForPathname("/dashboard/storekeeper/reconciliation", "/dashboard/storekeeper/reconciliation")` → `true`
    - `isViewActiveForPathname("/settings", "/settings")` → `true`
  - Write property-based tests for the non-buggy cases (isBugCondition is false):
    - **Property 2a**: For `href` starting with `/dashboard/` — existing `startsWith` / exact behavior is preserved (except overview root, which is intentionally fixed)
    - **Property 2b**: For single-segment hrefs (e.g., `/orders`, `/settings`) — behavior is unchanged
    - **Property 2c**: For mismatched hrefs — always returns `false`
  - Note: the overview false-positive (`/dashboard/owner` active on sub-routes) is addressed by Property 3 below
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS for non-buggy baseline behaviors (confirming the baseline to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [-] 2b. Write overview exact-match preservation test (BEFORE implementing fix)
  - **Property 3: Overview Exact-Match Only** - No False Positives on Sub-Routes
  - **IMPORTANT**: This test will FAIL on unfixed code — that is expected, as this is an additional bug being fixed
  - Write a property-based test asserting: for any pathname of the form `/dashboard/<workspace>/<anything>` (deeper than workspace root), `isViewActiveForPathname` returns `false` when `href` is exactly the workspace root (`/dashboard/<workspace>` or `/dashboard/operator/<machine>`)
  - Concrete cases:
    - `isViewActiveForPathname("/dashboard/owner/inventory/parent", "/dashboard/owner")` → `false`
    - `isViewActiveForPathname("/dashboard/owner/jobs", "/dashboard/owner")` → `false`
    - `isViewActiveForPathname("/dashboard/owner/machines", "/dashboard/owner")` → `false`
    - `isViewActiveForPathname("/dashboard/storekeeper/reconciliation", "/dashboard/storekeeper")` → `false`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (confirms the overview false-positive bug exists)
  - Document the false-positive counterexamples found
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.3, 3.1, 3.2_

- [ ] 3. Fix `isViewActiveForPathname` in `src/components/dashboard/sidebar.tsx`

  - [~] 3.1 Normalize inputs and add exact-match fast-path
    - Strip trailing slashes from both `pathname` and `href` before any comparison
    - `const p = pathname.replace(/\/+$/, "")`
    - `const h = href.replace(/\/+$/, "")`
    - Return `true` immediately if `p === h` (handles all exact-match cases)
    - _Bug_Condition: isBugCondition(pathname, href) — href does NOT start with `/dashboard/` AND href has >1 path segment_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [~] 3.2 Add workspace-root exact-match guard for dashboard-prefixed hrefs
    - When `h.startsWith("/dashboard/")`, split into segments and check depth
    - `isRoot := hSegments.length === 2 OR (hSegments.length === 3 AND hSegments[1] === "operator")`
    - If `isRoot`, return `p === h` only (no prefix matching) — eliminates Overview false positive
    - Otherwise return `p === h OR p.startsWith(h + "/")`
    - _Expected_Behavior: overview href (`/dashboard/owner`) active only on exact match; feature routes (`/dashboard/owner/jobs`) active on exact or prefix match_
    - _Preservation: Requirements 3.1 — Overview exact match only; 3.2 — Jobs, Machines, Reconciliation unaffected_
    - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.6_

  - [~] 3.3 Add workspace reconstruction for multi-segment non-dashboard hrefs
    - When `h` does NOT start with `/dashboard/`, parse workspace from `p`:
      - `pSegments := p.split("/").filter(Boolean)`
      - If `pSegments[0] !== "dashboard"` or `pSegments.length < 2`, return `false`
      - `workspaceId := pSegments[1]`
    - Build candidate workspace bases:
      - Always include `"/dashboard/" + workspaceId`
      - If `workspaceId === "operator"` AND `pSegments.length >= 3`, also include `"/dashboard/operator/" + pSegments[2]` (operator + machine slug)
    - For each candidate base, construct `scopedHref = base + h` and check `p === scopedHref OR p.startsWith(scopedHref + "/")`
    - Return `true` if any candidate matches; otherwise return `false`
    - _Bug_Condition: isBugCondition(pathname, href) where `href = "/inventory/parent"`, `pathname = "/dashboard/owner/inventory/parent"`_
    - _Expected_Behavior: `isViewActiveForPathname` returns `true` for all multi-segment non-dashboard hrefs whose workspace-scoped form matches or prefixes the current pathname_
    - _Preservation: non-dashboard single-segment hrefs (`/orders`, `/settings`) pass through unaffected since their hSegments.length === 1_
    - _Requirements: 2.1, 2.2, 2.4, 3.4, 3.5, 3.7, 3.8, 3.9_

  - [~] 3.4 Handle edge cases
    - Trailing-slash inputs on either side must be normalized (covered by step 3.1)
    - Empty href or pathname — return `false` via the `pSegments[0] !== "dashboard"` guard
    - Operator workspace with machine slug: `/dashboard/operator/laser/inventory/substock` must match `/inventory/substock` using the `/dashboard/operator/laser` candidate base
    - `activeView` prop in `Sidebar` component takes precedence over pathname-based detection and bypasses `isViewActiveForPathname` entirely — confirm this path is not changed
    - _Requirements: 2.4, 3.7, 3.8, 3.9_

  - [~] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Multi-Segment Non-Dashboard Href Activation
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior for the bug condition
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES — confirms multi-segment hrefs are now resolved correctly
    - _Requirements: 2.1, 2.2, 2.4_

  - [~] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Active-State Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS — confirms no regressions in existing nav item highlights
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [~] 3.7 Verify overview exact-match test now passes
    - **Property 3: Overview Exact-Match Only** - No False Positives on Sub-Routes
    - **IMPORTANT**: Re-run the SAME test from task 2b — do NOT write a new test
    - Run the overview exact-match test from step 2b
    - **EXPECTED OUTCOME**: Test PASSES — confirms Overview is no longer falsely highlighted on sub-routes
    - _Requirements: 2.3, 3.1, 3.2_

- [~] 4. Checkpoint — Ensure all tests pass
  - Run `pnpm test` (or the appropriate Vitest command for this spec's test file)
  - Confirm Property 1 (bug condition) passes
  - Confirm Property 2 (preservation) passes
  - Confirm Property 3 (overview exact-match) passes
  - Confirm no other existing tests were broken
  - Ensure all tests pass; ask the user if questions arise.
