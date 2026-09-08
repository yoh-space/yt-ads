# Bugfix Requirements Document

## Introduction

The sidebar navigation component (`sidebar.tsx`) fails to highlight the correct active menu item when the current URL is a nested or dynamic route. The `isViewActiveForPathname` function uses a segment-inclusion check for non-`/dashboard/`-prefixed hrefs (e.g., `/inventory/parent`), but this check breaks when the href contains more than one path segment — `segments.includes("inventory/parent")` never matches because each segment is a single URL part. Consequently, navigating to `/dashboard/owner/inventory/parent` leaves **Inventory** unhighlighted and either **Overview** or nothing appears active. The same logic flaw affects all routes whose canonical href contains a multi-segment, non-dashboard-prefixed path (e.g., `/inventory/substock`, `/inventory/parent`).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the current pathname is `/dashboard/<workspace>/inventory/parent` (or any sub-route thereof) AND the nav item href is `/inventory/parent` THEN the system fails to mark the **Inventory** item as active and leaves it unhighlighted.

1.2 WHEN the current pathname is `/dashboard/<workspace>/inventory/substock` AND the nav item href is `/inventory/substock` THEN the system fails to mark the **Offcuts** item as active and leaves it unhighlighted.

1.3 WHEN the current pathname is `/dashboard/<workspace>/inventory/parent` THEN the system incorrectly marks **Overview** as active (or marks nothing), because the overview route `/dashboard/<workspace>` satisfies `pathname.startsWith(href + "/")`.

1.4 WHEN the workspace segment in the pathname changes (e.g., switching from `owner` to `storekeeper`) THEN the system may retain or lose the active highlight on the previously selected item without correctly re-evaluating it against the new workspace-scoped href.

### Expected Behavior (Correct)

2.1 WHEN the current pathname is `/dashboard/<workspace>/inventory/parent` (or any deeper sub-route) AND the nav item href is `/inventory/parent` THEN the system SHALL mark the **Inventory** item as active.

2.2 WHEN the current pathname is `/dashboard/<workspace>/inventory/substock` (or any deeper sub-route) AND the nav item href is `/inventory/substock` THEN the system SHALL mark the **Offcuts** item as active.

2.3 WHEN the current pathname is `/dashboard/<workspace>/inventory/parent` THEN the system SHALL NOT mark the **Overview** item as active; overview SHALL only be active on an exact match to the overview href (e.g., `/dashboard/owner`).

2.4 WHEN a non-dashboard href contains multiple path segments (e.g., `/inventory/parent`) THEN the system SHALL compare the full suffix of those segments against the current pathname as a contiguous subsequence, rather than checking for any single segment in isolation.

2.5 WHEN the workspace parameter changes THEN the system SHALL re-evaluate active state for all nav items against the new pathname without producing incorrect highlights.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the current pathname is exactly `/dashboard/owner` THEN the system SHALL CONTINUE TO mark **Overview** as active for the `owner`/`admin` role.

3.2 WHEN the current pathname is exactly `/dashboard/manager` THEN the system SHALL CONTINUE TO mark **Overview** as active for the `manager` role.

3.3 WHEN the current pathname is `/dashboard/owner/jobs` THEN the system SHALL CONTINUE TO mark **Job Cards** as active.

3.4 WHEN the current pathname is `/dashboard/owner/machines` THEN the system SHALL CONTINUE TO mark **Machines** as active.

3.5 WHEN the current pathname is `/orders` or a sub-route thereof THEN the system SHALL CONTINUE TO mark **Orders Queue** as active.

3.6 WHEN the current pathname is `/reports` or a sub-route thereof THEN the system SHALL CONTINUE TO mark **Reports** as active.

3.7 WHEN the current pathname is `/dashboard/storekeeper/reconciliation` THEN the system SHALL CONTINUE TO mark **Reconciliation** as active.

3.8 WHEN the sidebar is in a collapsed state THEN active state detection SHALL CONTINUE TO work identically to the expanded state.

3.9 WHEN an explicit `activeView` prop is provided to the Sidebar component THEN the system SHALL CONTINUE TO use `activeView` for active state rather than pathname-based detection.
