/**
 * Bug Condition Exploration Test — Task 1
 *
 * Property 1: Multi-Segment Non-Dashboard Href Activation
 *
 * CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
 * Failure here CONFIRMS the bug exists.
 *
 * DO NOT fix the code or the test when it fails.
 *
 * Validates: Requirements 2.1, 2.2, 2.4
 */

import { describe, it, expect } from "vitest";
import { isViewActiveForPathname } from "./sidebar";

// ---------------------------------------------------------------------------
// Inline copy of the CURRENT (unfixed) isViewActiveForPathname implementation
// from src/components/dashboard/sidebar.tsx (lines 20-35).
// We copy it here so the test targets the exact buggy logic without modifying
// the source file. This is the authoritative snapshot of the unfixed function.
// ---------------------------------------------------------------------------
function isViewActiveForPathname_unfixed(pathname: string, href: string): boolean {
  // Exact match
  if (pathname === href) return true;

  // If href is just a view path (no workspace prefix), check if pathname contains it as a segment
  // e.g., href="/reconciliation", pathname="/dashboard/owner/reconciliation" -> true
  if (!href.startsWith("/dashboard/") && href !== "/dashboard") {
    const viewSegment = href.startsWith("/") ? href.slice(1) : href;
    const segments = pathname.split("/").filter(Boolean);
    return segments.includes(viewSegment);
  }

  // For dashboard-prefixed hrefs (workspace routes), only match if:
  // 1. pathname is exactly the href, OR
  // 2. pathname starts with href/ (i.e., href is a prefix followed by more segments)
  if (href.startsWith("/dashboard/")) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return false;
}

// ---------------------------------------------------------------------------
// Helper: isBugCondition — identifies the inputs where the bug manifests.
// An href triggers the bug when it does NOT start with /dashboard/ AND it
// contains more than one path segment (e.g. "/inventory/parent").
// ---------------------------------------------------------------------------
function isBugCondition(href: string): boolean {
  const segments = href.split("/").filter(Boolean);
  return !href.startsWith("/dashboard/") && segments.length > 1;
}

// ---------------------------------------------------------------------------
// The four concrete failing cases identified in the bug report.
// ---------------------------------------------------------------------------
const BUG_CASES: Array<{ pathname: string; href: string }> = [
  {
    pathname: "/dashboard/owner/inventory/parent",
    href: "/inventory/parent",
  },
  {
    pathname: "/dashboard/owner/inventory/parent/rolls",
    href: "/inventory/parent",
  },
  {
    pathname: "/dashboard/owner/inventory/substock",
    href: "/inventory/substock",
  },
  {
    pathname: "/dashboard/storekeeper/inventory/parent",
    href: "/inventory/parent",
  },
];

// ---------------------------------------------------------------------------
// Property 1 — Bug Condition exploration tests
//
// These tests assert the EXPECTED (correct) behaviour. They will FAIL on
// unfixed code, which is precisely the goal: failure proves the bug exists.
// ---------------------------------------------------------------------------
describe("Property 1 — Bug Condition: multi-segment non-dashboard href activation", () => {
  describe("isBugCondition helper — sanity checks", () => {
    it("correctly identifies /inventory/parent as a bug-condition href", () => {
      expect(isBugCondition("/inventory/parent")).toBe(true);
    });

    it("correctly identifies /inventory/substock as a bug-condition href", () => {
      expect(isBugCondition("/inventory/substock")).toBe(true);
    });

    it("does NOT flag single-segment hrefs as bug-condition", () => {
      expect(isBugCondition("/orders")).toBe(false);
      expect(isBugCondition("/settings")).toBe(false);
      expect(isBugCondition("/reconciliation")).toBe(false);
    });

    it("does NOT flag dashboard-prefixed hrefs as bug-condition", () => {
      expect(isBugCondition("/dashboard/owner/jobs")).toBe(false);
      expect(isBugCondition("/dashboard/owner")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // The four concrete counterexamples from the bug report.
  // Each assertion is expected to FAIL on unfixed code.
  // -------------------------------------------------------------------------
  describe("Concrete counterexamples — EXPECTED TO FAIL on unfixed code", () => {
    it(
      "Case 1: /dashboard/owner/inventory/parent with href /inventory/parent → should be active",
      () => {
        const result = isViewActiveForPathname_unfixed(
          "/dashboard/owner/inventory/parent",
          "/inventory/parent",
        );
        // Bug: segments.includes("inventory/parent") never matches a single-segment array element.
        // Actual (unfixed) result: false. Expected (correct) result: true.
        expect(result).toBe(true); // FAILS on unfixed code ← confirms bug
      },
    );

    it(
      "Case 2: /dashboard/owner/inventory/parent/rolls with href /inventory/parent → should be active (sub-route)",
      () => {
        const result = isViewActiveForPathname_unfixed(
          "/dashboard/owner/inventory/parent/rolls",
          "/inventory/parent",
        );
        // Bug: sub-route of a multi-segment non-dashboard href is also never matched.
        // Actual (unfixed) result: false. Expected (correct) result: true.
        expect(result).toBe(true); // FAILS on unfixed code ← confirms bug
      },
    );

    it(
      "Case 3: /dashboard/owner/inventory/substock with href /inventory/substock → should be active",
      () => {
        const result = isViewActiveForPathname_unfixed(
          "/dashboard/owner/inventory/substock",
          "/inventory/substock",
        );
        // Bug: same root cause — "inventory/substock" is never an element in the segments array.
        // Actual (unfixed) result: false. Expected (correct) result: true.
        expect(result).toBe(true); // FAILS on unfixed code ← confirms bug
      },
    );

    it(
      "Case 4: /dashboard/storekeeper/inventory/parent with href /inventory/parent → should be active",
      () => {
        const result = isViewActiveForPathname_unfixed(
          "/dashboard/storekeeper/inventory/parent",
          "/inventory/parent",
        );
        // Bug: workspace-agnostic: the bug affects ALL workspace roles, not just owner.
        // Actual (unfixed) result: false. Expected (correct) result: true.
        expect(result).toBe(true); // FAILS on unfixed code ← confirms bug
      },
    );
  });

  // -------------------------------------------------------------------------
  // Scoped property-based test: for any (pathname, href) pair where
  // isBugCondition(href) is true and pathname is a workspace-scoped path
  // that ends with the href's segments (or contains them as a prefix), the
  // function SHALL return true.
  //
  // We enumerate a representative set of bug-condition inputs to demonstrate
  // the structural impossibility: segments.includes(multiSegmentString) always
  // returns false because no split("/") element ever equals a string containing "/".
  // -------------------------------------------------------------------------
  describe("Structural property: segments.includes(multiSegment) is always false", () => {
    const additionalBugCases: Array<{ pathname: string; href: string }> = [
      // Additional multi-segment hrefs across workspace variants
      { pathname: "/dashboard/owner/inventory/parent/rolls", href: "/inventory/parent" },
      { pathname: "/dashboard/manager/inventory/parent", href: "/inventory/parent" },
      { pathname: "/dashboard/storekeeper/inventory/substock", href: "/inventory/substock" },
      // Operator workspace with machine slug
      { pathname: "/dashboard/operator/laser/inventory/substock", href: "/inventory/substock" },
    ];

    it.each([...BUG_CASES, ...additionalBugCases])(
      "pathname=$pathname, href=$href → isViewActiveForPathname should return true",
      ({ pathname, href }) => {
        // Precondition: confirm this is indeed a bug-condition input
        expect(isBugCondition(href)).toBe(true);

        // The multi-segment viewSegment will NEVER appear as a single element in
        // pathname.split("/"), so this always returns false on unfixed code.
        const result = isViewActiveForPathname_unfixed(pathname, href);
        expect(result).toBe(true); // FAILS on unfixed code ← confirms bug
      },
    );
  });

  // -------------------------------------------------------------------------
  // Diagnostic: explicitly prove WHY the bug occurs.
  // These tests demonstrate the structural impossibility that causes the bug.
  // -------------------------------------------------------------------------
  describe("Root-cause diagnostic: why segments.includes fails for multi-segment hrefs", () => {
    it('pathname.split("/") never contains a slash — multi-segment strings are impossible members', () => {
      const pathname = "/dashboard/owner/inventory/parent";
      const segments = pathname.split("/").filter(Boolean);
      // Each element is a single URL token with no slash
      for (const seg of segments) {
        expect(seg.includes("/")).toBe(false);
      }
      // Therefore, "inventory/parent" (which contains a slash) can never be found
      expect(segments.includes("inventory/parent")).toBe(false);
      expect(segments.includes("inventory/substock")).toBe(false);
    });

    it("the bug affects all workspace roles uniformly — storekeeper, owner, manager", () => {
      const workspaces = ["owner", "storekeeper", "manager", "operator"] as const;
      const href = "/inventory/parent";
      for (const ws of workspaces) {
        const pathname = `/dashboard/${ws}/inventory/parent`;
        const viewSegment = href.slice(1); // "inventory/parent"
        const segments = pathname.split("/").filter(Boolean);
        // Structural proof: no single segment matches the multi-segment string
        expect(segments.includes(viewSegment)).toBe(false);
        // And therefore the unfixed function returns false for all workspaces
        expect(isViewActiveForPathname_unfixed(pathname, href)).toBe(false);
      }
    });
  });
});

// ==========================================================================
// Property 2 — Preservation: Existing Active-State Behavior Unchanged
//
// Task 2: Write preservation property tests (BEFORE implementing fix)
//
// These tests target the non-buggy cases — inputs where isBugCondition(href)
// is FALSE. They assert the EXISTING (correct) behaviour of the unfixed
// function so we have a verified baseline to protect during the fix.
//
// EXPECTED OUTCOME: All tests in this section PASS on unfixed code.
//
// NOTE: The overview false-positive (`/dashboard/owner` active on sub-routes
// under it) is intentionally excluded here. That bug is documented and tested
// by Property 3 (task 2b). We only assert correct baseline behaviours here.
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9
// ==========================================================================

describe("Property 2 — Preservation: existing active-state behavior unchanged", () => {
  // ------------------------------------------------------------------------
  // Property 2a — Dashboard-prefixed hrefs: startsWith / exact behavior is
  // preserved.
  //
  // For any href that already starts with /dashboard/, the unfixed function
  // uses pathname === href OR pathname.startsWith(href + "/"). We record and
  // verify these cases so the fix must not change them.
  // ------------------------------------------------------------------------
  describe("Property 2a — dashboard-prefixed hrefs: exact and startsWith behaviour preserved", () => {
    // Overview exact match (requirement 3.1 / 3.2)
    it("overview exact match — /dashboard/owner is active on /dashboard/owner", () => {
      expect(isViewActiveForPathname_unfixed("/dashboard/owner", "/dashboard/owner")).toBe(true);
    });

    it("overview exact match — /dashboard/storekeeper is active on /dashboard/storekeeper", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/storekeeper", "/dashboard/storekeeper"),
      ).toBe(true);
    });

    // Feature-route exact match (requirement 3.3)
    it("jobs href is active on exact pathname — /dashboard/owner/jobs", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/owner/jobs", "/dashboard/owner/jobs"),
      ).toBe(true);
    });

    // Feature-route prefix match — a sub-route of jobs activates the jobs item
    it("jobs href is active on a sub-route — /dashboard/owner/jobs/123", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/owner/jobs/123", "/dashboard/owner/jobs"),
      ).toBe(true);
    });

    // Machines (requirement 3.4)
    it("machines href is active on exact pathname — /dashboard/owner/machines", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/owner/machines", "/dashboard/owner/machines"),
      ).toBe(true);
    });

    // Reconciliation (requirement 3.7)
    it("reconciliation href is active on exact pathname — /dashboard/storekeeper/reconciliation", () => {
      expect(
        isViewActiveForPathname_unfixed(
          "/dashboard/storekeeper/reconciliation",
          "/dashboard/storekeeper/reconciliation",
        ),
      ).toBe(true);
    });

    // NOTE: The case where /dashboard/owner is active while browsing a deeper
    // route (e.g. /dashboard/owner/inventory/parent) is a known false positive.
    // We deliberately do NOT assert it here — it is addressed by Property 3
    // (task 2b), which documents it as a bug to fix.
  });

  // ------------------------------------------------------------------------
  // Property 2b — Single-segment hrefs: behavior is unchanged.
  //
  // Single-segment hrefs (e.g. /orders, /settings) use the
  // segments.includes(viewSegment) branch — each produces a single-token
  // viewSegment that IS found as an individual array element, so the unfixed
  // function handles these correctly. We pin that behaviour here.
  // ------------------------------------------------------------------------
  describe("Property 2b — single-segment hrefs: exact and prefix behaviour preserved", () => {
    // Orders — exact match (requirement 3.5)
    it("/orders is active on exact pathname /orders", () => {
      expect(isViewActiveForPathname_unfixed("/orders", "/orders")).toBe(true);
    });

    // Orders — sub-route prefix match (requirement 3.5)
    it("/orders is active on sub-route /orders/123", () => {
      expect(isViewActiveForPathname_unfixed("/orders/123", "/orders")).toBe(true);
    });

    // Reports (requirement 3.6)
    it("/reports is active on exact pathname /reports", () => {
      expect(isViewActiveForPathname_unfixed("/reports", "/reports")).toBe(true);
    });

    it("/reports is active on sub-route /reports/monthly", () => {
      expect(isViewActiveForPathname_unfixed("/reports/monthly", "/reports")).toBe(true);
    });

    // Settings (requirement 3.9 / general)
    it("/settings is active on exact pathname /settings", () => {
      expect(isViewActiveForPathname_unfixed("/settings", "/settings")).toBe(true);
    });

    // Reconciliation as single-segment (requirement 3.7)
    it("/reconciliation is active when pathname contains the reconciliation segment", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/storekeeper/reconciliation", "/reconciliation"),
      ).toBe(true);
    });
  });

  // ------------------------------------------------------------------------
  // Property 2c — Mismatched hrefs always return false.
  //
  // When the current pathname belongs to a completely different route, no nav
  // item should light up. This must hold for both dashboard-prefixed and
  // non-dashboard hrefs.
  // ------------------------------------------------------------------------
  describe("Property 2c — mismatched hrefs always return false", () => {
    it("inventory pathname does NOT activate jobs href", () => {
      expect(
        isViewActiveForPathname_unfixed(
          "/dashboard/owner/inventory/parent",
          "/dashboard/owner/jobs",
        ),
      ).toBe(false);
    });

    it("jobs pathname does NOT activate machines href", () => {
      expect(
        isViewActiveForPathname_unfixed(
          "/dashboard/owner/jobs",
          "/dashboard/owner/machines",
        ),
      ).toBe(false);
    });

    it("storekeeper pathname does NOT activate owner-scoped href", () => {
      expect(
        isViewActiveForPathname_unfixed(
          "/dashboard/storekeeper/reconciliation",
          "/dashboard/owner/jobs",
        ),
      ).toBe(false);
    });

    it("/orders pathname does NOT activate /settings href", () => {
      expect(isViewActiveForPathname_unfixed("/orders", "/settings")).toBe(false);
    });

    it("/settings pathname does NOT activate /orders href", () => {
      expect(isViewActiveForPathname_unfixed("/settings", "/orders")).toBe(false);
    });

    it("completely unrelated pathnames return false regardless of href format", () => {
      // dashboard-prefixed href vs. non-matching pathname
      expect(
        isViewActiveForPathname_unfixed("/dashboard/owner/machines", "/dashboard/owner/jobs"),
      ).toBe(false);
      // single-segment href vs. non-matching pathname
      expect(isViewActiveForPathname_unfixed("/reports", "/orders")).toBe(false);
    });
  });

  // ------------------------------------------------------------------------
  // Observation record — baseline values captured from the unfixed function.
  //
  // These serve as a written audit trail of what the unfixed code returns for
  // each case listed in the task, so future reviewers can see exactly what
  // "baseline to preserve" means.
  // ------------------------------------------------------------------------
  describe("Observation record — baseline values on unfixed code", () => {
    it("records: /dashboard/owner + /dashboard/owner → true (overview exact match)", () => {
      expect(isViewActiveForPathname_unfixed("/dashboard/owner", "/dashboard/owner")).toBe(true);
    });

    it(
      "records: /dashboard/owner/inventory/parent + /dashboard/owner → true (KNOWN FALSE POSITIVE — addressed by Property 3)",
      () => {
        // This is a bug: overview should NOT be active here. We record the CURRENT
        // unfixed behaviour (true) only as documentation. Property 3 will assert it
        // must become false after the fix. We do NOT change this behaviour here.
        expect(
          isViewActiveForPathname_unfixed(
            "/dashboard/owner/inventory/parent",
            "/dashboard/owner",
          ),
        ).toBe(true); // unfixed returns true — documented bug, NOT preserved by the fix
      },
    );

    it("records: /dashboard/owner/jobs + /dashboard/owner/jobs → true", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/owner/jobs", "/dashboard/owner/jobs"),
      ).toBe(true);
    });

    it("records: /orders + /orders → true", () => {
      expect(isViewActiveForPathname_unfixed("/orders", "/orders")).toBe(true);
    });

    it("records: /orders/123 + /orders → true", () => {
      expect(isViewActiveForPathname_unfixed("/orders/123", "/orders")).toBe(true);
    });

    it("records: /dashboard/owner/inventory/parent + /dashboard/owner/jobs → false (mismatch)", () => {
      expect(
        isViewActiveForPathname_unfixed(
          "/dashboard/owner/inventory/parent",
          "/dashboard/owner/jobs",
        ),
      ).toBe(false);
    });

    it(
      "records: /dashboard/storekeeper/reconciliation + /dashboard/storekeeper/reconciliation → true",
      () => {
        expect(
          isViewActiveForPathname_unfixed(
            "/dashboard/storekeeper/reconciliation",
            "/dashboard/storekeeper/reconciliation",
          ),
        ).toBe(true);
      },
    );

    it("records: /settings + /settings → true", () => {
      expect(isViewActiveForPathname_unfixed("/settings", "/settings")).toBe(true);
    });
  });
});

// ==========================================================================
// Property 3 — Overview Exact-Match Only: No False Positives on Sub-Routes
//
// Task 2b: Write overview exact-match preservation test (BEFORE implementing fix)
//
// CRITICAL: This test is EXPECTED TO FAIL on unfixed code.
// Failure here CONFIRMS the overview false-positive bug exists.
//
// The current `pathname.startsWith(href + "/")` logic in the dashboard-prefixed
// branch causes the workspace root href (e.g. "/dashboard/owner") to be
// considered active whenever the pathname begins with "/dashboard/owner/" —
// which is true for ALL deeper routes like /dashboard/owner/jobs,
// /dashboard/owner/inventory/parent, etc.
//
// DO NOT fix the code or the test when it fails.
//
// Validates: Requirements 2.3, 3.1, 3.2
// ==========================================================================

describe("Property 3 — Overview Exact-Match Only: no false positives on sub-routes", () => {
  // -------------------------------------------------------------------------
  // Concrete counterexamples from the bug report.
  // Each assertion expects false — but unfixed code returns true (false positive).
  // -------------------------------------------------------------------------
  describe("Concrete counterexamples — EXPECTED TO FAIL on unfixed code", () => {
    it(
      "Case 1: /dashboard/owner/inventory/parent with overview href /dashboard/owner → should NOT be active",
      () => {
        const result = isViewActiveForPathname_unfixed(
          "/dashboard/owner/inventory/parent",
          "/dashboard/owner",
        );
        // Bug: pathname.startsWith("/dashboard/owner/") is true for ALL sub-routes,
        // so overview is falsely activated. Unfixed result: true. Expected: false.
        expect(result).toBe(false); // FAILS on unfixed code ← confirms bug
      },
    );

    it(
      "Case 2: /dashboard/owner/jobs with overview href /dashboard/owner → should NOT be active",
      () => {
        const result = isViewActiveForPathname_unfixed(
          "/dashboard/owner/jobs",
          "/dashboard/owner",
        );
        // Bug: same false-positive — jobs route activates the overview item.
        // Unfixed result: true. Expected: false.
        expect(result).toBe(false); // FAILS on unfixed code ← confirms bug
      },
    );

    it(
      "Case 3: /dashboard/owner/machines with overview href /dashboard/owner → should NOT be active",
      () => {
        const result = isViewActiveForPathname_unfixed(
          "/dashboard/owner/machines",
          "/dashboard/owner",
        );
        // Bug: machines route falsely activates the overview item.
        // Unfixed result: true. Expected: false.
        expect(result).toBe(false); // FAILS on unfixed code ← confirms bug
      },
    );

    it(
      "Case 4: /dashboard/storekeeper/reconciliation with overview href /dashboard/storekeeper → should NOT be active",
      () => {
        const result = isViewActiveForPathname_unfixed(
          "/dashboard/storekeeper/reconciliation",
          "/dashboard/storekeeper",
        );
        // Bug: storekeeper reconciliation route falsely activates the storekeeper overview.
        // Unfixed result: true. Expected: false.
        expect(result).toBe(false); // FAILS on unfixed code ← confirms bug
      },
    );
  });

  // -------------------------------------------------------------------------
  // Structural property: for any pathname deeper than the workspace root,
  // the workspace root href must NOT be considered active.
  //
  // We enumerate the known workspace roles and representative sub-routes to
  // demonstrate the structural false-positive: startsWith(href + "/") will
  // match every sub-route under that workspace root.
  // -------------------------------------------------------------------------
  describe("Structural property: workspace root href is NOT active on any deeper route", () => {
    const deeperRoutes: Array<{ pathname: string; workspaceHref: string }> = [
      // owner workspace — multiple sub-routes
      { pathname: "/dashboard/owner/jobs", workspaceHref: "/dashboard/owner" },
      { pathname: "/dashboard/owner/machines", workspaceHref: "/dashboard/owner" },
      { pathname: "/dashboard/owner/inventory/parent", workspaceHref: "/dashboard/owner" },
      { pathname: "/dashboard/owner/inventory/substock", workspaceHref: "/dashboard/owner" },
      { pathname: "/dashboard/owner/jobs/123", workspaceHref: "/dashboard/owner" },
      // storekeeper workspace
      {
        pathname: "/dashboard/storekeeper/reconciliation",
        workspaceHref: "/dashboard/storekeeper",
      },
      { pathname: "/dashboard/storekeeper/inventory/parent", workspaceHref: "/dashboard/storekeeper" },
      // manager workspace
      { pathname: "/dashboard/manager/reports", workspaceHref: "/dashboard/manager" },
    ];

    it.each(deeperRoutes)(
      "pathname=$pathname with workspace root $workspaceHref → should NOT be active",
      ({ pathname, workspaceHref }) => {
        const result = isViewActiveForPathname_unfixed(pathname, workspaceHref);
        // Unfixed: startsWith(workspaceHref + "/") is always true for sub-routes → returns true (bug)
        // Expected: false — workspace root is active ONLY on exact match
        expect(result).toBe(false); // FAILS on unfixed code ← confirms bug
      },
    );
  });

  // -------------------------------------------------------------------------
  // Positive control: overview IS active on exact match.
  // These must PASS on both unfixed and fixed code — they confirm the
  // exact-match path still works correctly.
  // -------------------------------------------------------------------------
  describe("Positive control: workspace root href IS active on exact pathname match", () => {
    it("overview IS active on exact match — /dashboard/owner", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/owner", "/dashboard/owner"),
      ).toBe(true); // PASSES on unfixed code — exact match branch fires first
    });

    it("overview IS active on exact match — /dashboard/storekeeper", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/storekeeper", "/dashboard/storekeeper"),
      ).toBe(true); // PASSES on unfixed code
    });

    it("overview IS active on exact match — /dashboard/manager", () => {
      expect(
        isViewActiveForPathname_unfixed("/dashboard/manager", "/dashboard/manager"),
      ).toBe(true); // PASSES on unfixed code
    });
  });

  // -------------------------------------------------------------------------
  // Root-cause diagnostic: explicitly prove WHY the false positive occurs.
  // -------------------------------------------------------------------------
  describe("Root-cause diagnostic: why startsWith causes the false positive", () => {
    it("demonstrates that /dashboard/owner/jobs starts with /dashboard/owner/ — the structural cause", () => {
      const pathname = "/dashboard/owner/jobs";
      const href = "/dashboard/owner";
      // The unfixed branch: pathname.startsWith(href + "/")
      expect(pathname.startsWith(href + "/")).toBe(true); // this is why the bug fires
      // And therefore the unfixed function incorrectly returns true
      expect(isViewActiveForPathname_unfixed(pathname, href)).toBe(true); // bug confirmed
    });

    it("documents all four false-positive counterexamples from the bug report", () => {
      const falsePositives = [
        { pathname: "/dashboard/owner/inventory/parent", href: "/dashboard/owner" },
        { pathname: "/dashboard/owner/jobs",             href: "/dashboard/owner" },
        { pathname: "/dashboard/owner/machines",         href: "/dashboard/owner" },
        { pathname: "/dashboard/storekeeper/reconciliation", href: "/dashboard/storekeeper" },
      ];

      for (const { pathname, href } of falsePositives) {
        // Document that unfixed code returns true (false positive)
        expect(isViewActiveForPathname_unfixed(pathname, href)).toBe(true); // EXPECTED — documents the bug
        // The CORRECT answer should be false — asserted separately in the concrete cases above
      }
    });
  });
});

// ==========================================================================
// Verification — Fix Validation (Task 3.5, 3.6, 3.7)
//
// These tests import the FIXED isViewActiveForPathname from sidebar.tsx and
// verify that:
//   - Property 1 (bug condition) now passes
//   - Property 2 (preservation) still passes
//   - Property 3 (overview exact-match) now passes
// ==========================================================================

describe("Verification — fixed isViewActiveForPathname", () => {
  describe("Property 1 (bug condition) — now passes", () => {
    it.each(BUG_CASES)(
      "pathname=$pathname, href=$href → true",
      ({ pathname, href }) => {
        expect(isViewActiveForPathname(pathname, href)).toBe(true);
      },
    );

    it("operator workspace: /dashboard/operator/laser/inventory/substock → /inventory/substock", () => {
      expect(
        isViewActiveForPathname("/dashboard/operator/laser/inventory/substock", "/inventory/substock"),
      ).toBe(true);
    });
  });

  describe("Property 2 (preservation) — still passes", () => {
    it("exact match: /dashboard/owner + /dashboard/owner → true", () => {
      expect(isViewActiveForPathname("/dashboard/owner", "/dashboard/owner")).toBe(true);
    });

    it("feature route exact: /dashboard/owner/jobs + /dashboard/owner/jobs → true", () => {
      expect(isViewActiveForPathname("/dashboard/owner/jobs", "/dashboard/owner/jobs")).toBe(true);
    });

    it("feature route sub-route: /dashboard/owner/jobs/123 + /dashboard/owner/jobs → true", () => {
      expect(isViewActiveForPathname("/dashboard/owner/jobs/123", "/dashboard/owner/jobs")).toBe(true);
    });

    it("single-segment exact: /orders + /orders → true", () => {
      expect(isViewActiveForPathname("/orders", "/orders")).toBe(true);
    });

    it("single-segment sub-route: /orders/123 + /orders → true", () => {
      expect(isViewActiveForPathname("/orders/123", "/orders")).toBe(true);
    });

    it("single-segment dashboard: /reconciliation + /reconciliation via pathname containing segment → true", () => {
      expect(isViewActiveForPathname("/dashboard/storekeeper/reconciliation", "/reconciliation")).toBe(true);
    });

    it("mismatch: /dashboard/owner/inventory/parent + /dashboard/owner/jobs → false", () => {
      expect(isViewActiveForPathname("/dashboard/owner/inventory/parent", "/dashboard/owner/jobs")).toBe(false);
    });

    it("mismatch: /orders + /settings → false", () => {
      expect(isViewActiveForPathname("/orders", "/settings")).toBe(false);
    });

    it("reconciliation exact: /dashboard/storekeeper/reconciliation + /dashboard/storekeeper/reconciliation → true", () => {
      expect(isViewActiveForPathname("/dashboard/storekeeper/reconciliation", "/dashboard/storekeeper/reconciliation")).toBe(true);
    });
  });

  describe("Property 3 (overview exact-match) — now passes", () => {
    it("/dashboard/owner/inventory/parent + /dashboard/owner → false", () => {
      expect(isViewActiveForPathname("/dashboard/owner/inventory/parent", "/dashboard/owner")).toBe(false);
    });

    it("/dashboard/owner/jobs + /dashboard/owner → false", () => {
      expect(isViewActiveForPathname("/dashboard/owner/jobs", "/dashboard/owner")).toBe(false);
    });

    it("/dashboard/owner/machines + /dashboard/owner → false", () => {
      expect(isViewActiveForPathname("/dashboard/owner/machines", "/dashboard/owner")).toBe(false);
    });

    it("/dashboard/storekeeper/reconciliation + /dashboard/storekeeper → false", () => {
      expect(isViewActiveForPathname("/dashboard/storekeeper/reconciliation", "/dashboard/storekeeper")).toBe(false);
    });

    it("overview IS active on exact match: /dashboard/owner + /dashboard/owner → true", () => {
      expect(isViewActiveForPathname("/dashboard/owner", "/dashboard/owner")).toBe(true);
    });

    it("overview IS active on exact match: /dashboard/storekeeper + /dashboard/storekeeper → true", () => {
      expect(isViewActiveForPathname("/dashboard/storekeeper", "/dashboard/storekeeper")).toBe(true);
    });
  });
});
