# Sidebar Active Route Matching Bugfix Design

## Overview

The `isViewActiveForPathname` function in `src/components/dashboard/sidebar.tsx` incorrectly
determines which sidebar nav item is active when the current URL is a nested or dynamic route.

The core issue is a mismatch between how hrefs are stored (`/inventory/parent` — no workspace
prefix) and how pathnames are structured (`/dashboard/owner/inventory/parent` — workspace-scoped).
The current code attempts to resolve this by calling `segments.includes(viewSegment)`, but when
`viewSegment` is `"inventory/parent"` (a multi-segment string), no single element of the
`pathname.split("/")` array will ever equal it.

The fix reconstructs the full workspace-scoped canonical path from the given href and then uses
a `startsWith` prefix check — matching both exact hits and deeper sub-routes — while enforcing
exact matching for workspace root (overview) routes to prevent false positives.

## Glossary

- **Bug_Condition (C)**: An href that contains more than one path segment AND does not already
  start with `/dashboard/` — causing `segments.includes(viewSegment)` to silently fail.
- **Property (P)**: The sidebar item whose href, when workspace-scoped, is a prefix of (or
  exact match for) the current pathname SHALL be rendered as active.
- **Preservation**: Every nav item that currently highlights correctly (dashboard-prefixed hrefs,
  exact-match root routes, single-segment hrefs) must continue to do so after the fix.
- **`isViewActiveForPathname`**: The pure function in `src/components/dashboard/sidebar.tsx`
  (lines 20–35) that maps `(pathname, href) → boolean`.
- **workspace segment**: The dynamic URL part immediately after `/dashboard/` (e.g., `owner`,
  `storekeeper`, `operator/laser`).
- **workspace-scoped href**: The canonical href with the `/dashboard/<workspace>` prefix prepended,
  e.g., `/inventory/parent` → `/dashboard/owner/inventory/parent`.
- **overview route**: A route that IS the workspace root (`/dashboard/<workspace>`). These must
  only be active on an exact match to prevent false positives on deeper sub-routes.

## Bug Details

### Bug Condition

The bug manifests when `isViewActiveForPathname` is called with an `href` that does not start
with `/dashboard/` and contains more than one path segment (e.g., `/inventory/parent`,
`/inventory/substock`). The function attempts to check whether the single joined multi-segment
string appears as an element in the pathname's segment array — which is structurally impossible.

**Formal Specification:**

```
FUNCTION isBugCondition(pathname, href)
  INPUT:  pathname: string  -- current URL (e.g. "/dashboard/owner/inventory/parent")
          href:     string  -- nav item href (e.g. "/inventory/parent")
  OUTPUT: boolean

  hrefSegments := href.split("/").filter(nonEmpty)

  RETURN NOT href.startsWith("/dashboard/")
         AND hrefSegments.length > 1
         AND pathname CONTAINS the workspace segment
         AND pathname ends with ("/" + JOIN(hrefSegments, "/")) or a sub-path thereof
END FUNCTION
```

### Examples

| Pathname | Href | Bug triggered? | Expected active? |
|---|---|---|---|
| `/dashboard/owner/inventory/parent` | `/inventory/parent` | ✅ Yes | ✅ Yes |
| `/dashboard/owner/inventory/parent/rolls` | `/inventory/parent` | ✅ Yes | ✅ Yes |
| `/dashboard/storekeeper/inventory/parent` | `/inventory/parent` | ✅ Yes | ✅ Yes |
| `/dashboard/owner/inventory/substock` | `/inventory/substock` | ✅ Yes | ✅ Yes |
| `/dashboard/owner` | `/inventory/parent` | ❌ No | ❌ No |
| `/dashboard/owner/jobs` | `/dashboard/owner/jobs` | ❌ No | ✅ Yes (existing path, works) |
| `/orders` | `/orders` | ❌ No | ✅ Yes (single-segment, works) |

**False positive triggered by current code:**

| Pathname | Href | Current result | Should be |
|---|---|---|---|
| `/dashboard/owner/inventory/parent` | `/dashboard/owner` | ✅ Active (wrong!) | ❌ Inactive |

`/dashboard/owner`.startsWith check passes because
`"/dashboard/owner/inventory/parent".startsWith("/dashboard/owner/")` is `true`.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors (Requirements 3.1 – 3.9):**
- Overview SHALL remain active only on an exact match with the workspace root route
  (e.g., `/dashboard/owner`).
- `/dashboard/owner/jobs` SHALL continue to highlight Job Cards.
- `/dashboard/owner/machines` SHALL continue to highlight Machines.
- `/orders` and sub-routes SHALL continue to highlight Orders Queue.
- `/reports` and sub-routes SHALL continue to highlight Reports.
- `/dashboard/storekeeper/reconciliation` SHALL continue to highlight Reconciliation.
- Collapsed sidebar state SHALL detect active items identically to expanded state.
- When an explicit `activeView` prop is supplied, it SHALL take precedence over
  pathname-based detection.

**Scope:**
All hrefs that already work (dashboard-prefixed hrefs, single-segment hrefs, exact matches)
must be completely unaffected by this fix. The change is restricted to the code path that
handles multi-segment non-dashboard hrefs.

## Hypothesized Root Cause

Based on analysis of `isViewActiveForPathname` and `ROUTE_DESCRIPTORS`:

1. **Multi-segment string vs. single-segment array element**: `href.slice(1)` for
   `/inventory/parent` produces `"inventory/parent"`. `pathname.split("/")` produces
   `["", "dashboard", "owner", "inventory", "parent"]`. No element equals
   `"inventory/parent"` — the check silently returns `false` for every multi-segment href.

2. **Missing workspace prefix injection**: The hrefs stored in `ROUTE_DESCRIPTORS` are
   intentionally workspace-agnostic (e.g., `/inventory/parent`) but the actual pathnames
   are always workspace-scoped (e.g., `/dashboard/owner/inventory/parent`). The matching
   logic never reconstructs the workspace-scoped form before comparing.

3. **Overview false positive via `startsWith`**: The `/dashboard/owner` route correctly
   uses the `href.startsWith("/dashboard/")` branch, but `pathname.startsWith(href + "/")`
   is true for any deeper route under `/dashboard/owner/...`, causing Overview to light up
   on inventory, jobs, and machines pages. This must be fixed by enforcing exact matching
   for workspace root hrefs.

4. **No workspace segment extraction**: The function receives only `pathname` and `href`; it
   has no access to the workspace string. The workspace segment must be parsed out of the
   pathname itself (the 3rd slash-delimited token after `/dashboard/`).

## Correctness Properties

Property 1: Bug Condition — Multi-Segment Non-Dashboard Href Activation

_For any_ `(pathname, href)` pair where `isBugCondition(pathname, href)` is true — meaning
`href` does not start with `/dashboard/` and contains more than one path segment — the fixed
`isViewActiveForPathname` SHALL return `true` if and only if the normalized pathname equals,
or starts with a `/`-appended form of, the workspace-scoped reconstruction of `href`
(i.e., `/dashboard/<workspace>` + `href`).

**Validates: Requirements 2.1, 2.2, 2.4**

Property 2: Preservation — Existing Active-State Behavior Unchanged

_For any_ `(pathname, href)` pair where `isBugCondition(pathname, href)` is false — meaning
`href` starts with `/dashboard/`, or is a single-segment href, or is an exact match — the
fixed `isViewActiveForPathname` SHALL return the same boolean as the original function,
preserving all currently correct highlights.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

Property 3: Preservation — Overview Exact-Match Only

_For any_ pathname of the form `/dashboard/<workspace>/<anything>` (deeper than the workspace
root), `isViewActiveForPathname` SHALL return `false` for the overview href
(`/dashboard/<workspace>`), ensuring Overview is not falsely highlighted on sub-routes.

**Validates: Requirements 2.3, 3.1, 3.2**

## Fix Implementation

### Changes Required

**File:** `src/components/dashboard/sidebar.tsx`

**Function:** `isViewActiveForPathname(pathname: string, href: string): boolean`

**Specific Changes:**

1. **Normalize both inputs**: Strip trailing slashes from `pathname` and `href` before any
   comparison. This handles edge cases like `/dashboard/owner/` vs `/dashboard/owner`.

   ```
   normalizedPathname := pathname.trimEnd("/")
   normalizedHref     := href.trimEnd("/")
   ```

2. **Exact match fast-path** (unchanged logic, now on normalized values):
   ```
   IF normalizedPathname === normalizedHref RETURN true
   ```

3. **Overview / workspace-root exact-match enforcement**: For dashboard-prefixed hrefs that
   are workspace roots (no additional segments beyond the workspace token), enforce exact
   matching only — never prefix matching. This eliminates the false positive on sub-routes.

   A workspace root href has the form `/dashboard/<one-or-two-segments>` with no further
   path parts (e.g., `/dashboard/owner`, `/dashboard/operator/laser`).

   ```
   IF normalizedHref.startsWith("/dashboard/")
     workspaceDepth := normalizedHref.split("/").filter(Boolean).length
     // workspace roots are at depth 2 (e.g. /dashboard/owner) or
     // depth 3 for operator machines (e.g. /dashboard/operator/laser)
     isWorkspaceRoot := workspaceDepth <= 3 AND no additional view segment present
     IF isWorkspaceRoot RETURN normalizedPathname === normalizedHref   // exact only
     ELSE RETURN normalizedPathname === normalizedHref
                 OR normalizedPathname.startsWith(normalizedHref + "/")
   ```

   In practice, view routes within `/dashboard/` already have the workspace embedded and
   are clearly deeper than root (e.g., `/dashboard/owner/jobs`), so the existing
   `startsWith` logic is safe for them. Only the pure workspace-root hrefs need the
   exact-match guard.

4. **Multi-segment non-dashboard href — workspace reconstruction**: When `href` does not
   start with `/dashboard/`, extract the workspace segment from the current pathname and
   reconstruct the full scoped path:

   ```
   IF NOT normalizedHref.startsWith("/dashboard/")
     // Extract workspace base from pathname: /dashboard/<workspace>
     // pathname segments: ["dashboard", workspace, ...]
     segments := normalizedPathname.split("/").filter(Boolean)
     IF segments[0] !== "dashboard" OR segments.length < 2
       RETURN false   // not a dashboard route; fall back to exact match only
     workspace := segments[1]   // e.g., "owner"
     // For operator workspaces the machine may form part of the prefix:
     // /dashboard/operator/laser — handled by full prefix reconstruction
     workspaceBase := "/dashboard/" + workspace
     scopedHref := workspaceBase + normalizedHref   // e.g., "/dashboard/owner/inventory/parent"
     RETURN normalizedPathname === scopedHref
            OR normalizedPathname.startsWith(scopedHref + "/")
   ```

   > **Note on operator workspaces**: Operator pathnames include the machine slug
   > (`/dashboard/operator/laser/...`). For these, `segments[1]` is `"operator"` and
   > `workspaceBase` becomes `/dashboard/operator`. Since operator hrefs are typically
   > flat (`/inventory/substock`, `/settings`), the scoped form becomes
   > `/dashboard/operator/inventory/substock`. If the actual pathname is
   > `/dashboard/operator/laser/inventory/substock`, an additional check using the
   > full three-segment operator prefix is needed. The fix should check both
   > `/dashboard/operator` and `/dashboard/operator/<machine>` as candidate bases when
   > the workspace is `"operator"`.

5. **Return false fallback**: If none of the above branches match, return `false`.

### Pseudocode of Complete Fixed Function

```
FUNCTION isViewActiveForPathname(pathname, href)
  p    := pathname.replace(/\/+$/, "")   // strip trailing slash
  h    := href.replace(/\/+$/, "")       // strip trailing slash

  IF p === h RETURN true

  IF h.startsWith("/dashboard/")
    hSegments := h.split("/").filter(Boolean)
    // Guard: workspace-root hrefs must be exact-match only
    // A workspace root has exactly 2 segments (["dashboard","owner"])
    // or 3 for operator machines (["dashboard","operator","laser"])
    // and there is no explicit view name appended.
    isRoot := hSegments.length === 2
              OR (hSegments.length === 3 AND hSegments[1] === "operator")
    IF isRoot
      RETURN p === h
    ELSE
      RETURN p === h OR p.startsWith(h + "/")

  // Non-dashboard href
  pSegments := p.split("/").filter(Boolean)
  IF pSegments[0] !== "dashboard" OR pSegments.length < 2
    RETURN false

  workspaceId := pSegments[1]   // "owner", "storekeeper", "operator", etc.

  // Build candidate base paths to try
  candidates := ["/dashboard/" + workspaceId]
  IF workspaceId === "operator" AND pSegments.length >= 3
    candidates.push("/dashboard/operator/" + pSegments[2])

  FOR base IN candidates
    scopedHref := base + h
    IF p === scopedHref OR p.startsWith(scopedHref + "/")
      RETURN true

  RETURN false
END FUNCTION
```

## Testing Strategy

### Validation Approach

Testing proceeds in two phases:

1. **Exploratory / bug confirmation** — Run tests against the *existing* (unfixed) code to
   confirm the bug manifests as described and to pin down the precise failure mode.
2. **Fix + preservation checking** — After applying the fix, run the same tests to confirm
   the bug is resolved AND that no previously-passing cases regress.

### Exploratory Bug Condition Checking

**Goal**: Surface concrete counterexamples on the unfixed `isViewActiveForPathname` to
confirm root cause before touching the code.

**Test Plan**: Call the existing function directly with the known buggy input pairs and
assert that it returns `true`. These assertions will FAIL on unfixed code, confirming the bug.

**Test Cases:**

1. **Multi-segment inventory/parent — owner workspace**
   - Input: `pathname="/dashboard/owner/inventory/parent"`, `href="/inventory/parent"`
   - Unfixed result: `false` (bug) | Expected after fix: `true`

2. **Sub-route under inventory/parent**
   - Input: `pathname="/dashboard/owner/inventory/parent/rolls"`, `href="/inventory/parent"`
   - Unfixed result: `false` (bug) | Expected after fix: `true`

3. **Multi-segment inventory/substock — owner workspace**
   - Input: `pathname="/dashboard/owner/inventory/substock"`, `href="/inventory/substock"`
   - Unfixed result: `false` (bug) | Expected after fix: `true`

4. **Multi-segment inventory/parent — storekeeper workspace**
   - Input: `pathname="/dashboard/storekeeper/inventory/parent"`, `href="/inventory/parent"`
   - Unfixed result: `false` (bug) | Expected after fix: `true`

**Expected Counterexamples:**
- `isViewActiveForPathname` returns `false` for all four cases above on unfixed code.
- Demonstrates that `segments.includes("inventory/parent")` never matches.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function
returns `true`.

**Pseudocode:**
```
FOR ALL (pathname, href) WHERE isBugCondition(pathname, href) DO
  result := isViewActiveForPathname_fixed(pathname, href)
  ASSERT result === true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed
function returns the same boolean as the original function.

**Pseudocode:**
```
FOR ALL (pathname, href) WHERE NOT isBugCondition(pathname, href) DO
  ASSERT isViewActiveForPathname_original(pathname, href)
       === isViewActiveForPathname_fixed(pathname, href)
END FOR
```

**Testing Approach**: Property-based testing is appropriate here because:
- The input space (`pathname × href`) is large; manual cases easily miss edge cases.
- Generating random valid pathnames and hrefs drawn from `ROUTE_DESCRIPTORS` gives high
  coverage with little boilerplate.
- A preserved-behavior failure would mean a nav item that was correct before the fix now
  incorrectly activates or deactivates.

**Preservation Test Cases:**

1. **Overview exact match — owner**
   - `pathname="/dashboard/owner"`, `href="/dashboard/owner"` → `true` (both before and after)

2. **Overview NOT active on sub-route — critical regression guard**
   - `pathname="/dashboard/owner/inventory/parent"`, `href="/dashboard/owner"` → `false`
   - This currently returns `true` (false positive bug); it must return `false` after fix.

3. **Dashboard-prefixed feature route — jobs**
   - `pathname="/dashboard/owner/jobs"`, `href="/dashboard/owner/jobs"` → `true`

4. **Single-segment root href — orders**
   - `pathname="/orders"`, `href="/orders"` → `true`
   - `pathname="/orders/123"`, `href="/orders"` → `true`

5. **Mismatch — inventory vs. overview**
   - `pathname="/dashboard/owner/inventory/parent"`, `href="/dashboard/owner/jobs"` → `false`

6. **Storekeeper reconciliation**
   - `pathname="/dashboard/storekeeper/reconciliation"`, `href="/dashboard/storekeeper/reconciliation"` → `true`

7. **Settings — single-segment**
   - `pathname="/settings"`, `href="/settings"` → `true`

### Unit Tests

- `isViewActiveForPathname` called directly with each input pair in the fix-checking and
  preservation test cases above.
- Edge cases: trailing slashes on both inputs, empty pathname segments, operator workspace
  with machine slug (`/dashboard/operator/laser/inventory/substock`).
- Verify that the `activeView` prop path in `Sidebar` is unaffected (prop takes precedence
  and bypasses `isViewActiveForPathname` entirely).

### Property-Based Tests

- Generate random `role` values from the known role set; derive `href` via
  `getNavItemHref(view, role)` for each `view` in `navItems`; construct realistic
  pathnames by appending sub-paths. Assert the fixed function returns `true` for matching
  pairs and `false` for non-matching pairs.
- Generate pathnames from `ROUTE_CONTRACTS[workspace].allowedPrefixes` and verify no
  cross-contamination (one workspace's pathname doesn't activate another workspace's items).
- Generate random non-inventory hrefs and assert they are unaffected by the multi-segment
  reconstruction path.

### Integration Tests

- Render `<Sidebar>` with `pathname` mocked via `next/navigation` to each known route;
  assert the correct `aria-current="page"` attribute appears on exactly one nav item.
- Switch workspace (change mocked pathname from `/dashboard/owner/...` to
  `/dashboard/storekeeper/...`) and verify active item re-evaluates correctly.
- Verify collapsed sidebar still renders `aria-current="page"` on the correct item
  (visual state is separate from detection logic but must remain consistent).
