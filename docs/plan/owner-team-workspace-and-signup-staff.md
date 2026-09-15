# Owner Team Workspace Assignment and Sign-up Staff Visibility

## Executive summary

The workspace configuration and core roles are already seeded and should not be changed. The update is limited to making newly registered staff easy to assign as machine operators from the owner Team page. A newly registered account remains a normal `users` profile; an owner selects the appropriate machine-operator role and then selects one or more compatible machines. The existing role-to-workspace configuration continues to determine the operator workspace.

This plan does not add a second workspace-membership system, change seeded roles, or introduce invitation email delivery. It focuses on operator role and machine-scope assignment after registration.

## Current-state findings

| Area | Current implementation | Consequence |
|---|---|---|
| Email registration | `src/app/sign-up/page.tsx` calls `authClient.signUp.email`, then `api.users.ensureProfile`, then redirects to `/dashboard`. | New email registrants are inserted into `users` and are already eligible for the owner directory. |
| Google registration | The page starts OAuth with `callbackURL: "/dashboard"`, but does not call `ensureProfile` after the callback. | A Google-created identity may reach the dashboard without an application `users` profile, depending on the surrounding auth flow; this is a registration visibility prerequisite, not a workspace change. |
| Profile creation | `convex/users.ts:215-239` creates the first account as `owner` and later accounts as `storekeeper`; it relinks an existing profile by email. | Automatic registration is safe and idempotent, but the default role/workspace is implicit. |
| Owner directory query | `convex/owner/team.ts` loads all `users`, counts by role, and returns name, email, role, active state, and machine IDs. | Workspace assignment is not returned. |
| Owner Team UI | `src/app/(dashboard)/dashboard/owner/team/page.tsx` displays name, email, role, and status and edits role, active state, and machine scope. | Owners cannot see or edit the member's workspace assignment. |
| Workspace catalog | `roleWorkspaceConfig` stores `roleCode`, `workspaceId`, `homeRoute`, machine slug, and active state. `roles` also stores `workspaceId`. | Existing workspace configuration is sufficient and remains unchanged. |
| Email delivery | The staff drawer has a disabled “Reset password / invite” action because email delivery is not configured. | “Add email to workspace” should mean adding the registered account to the directory, not sending an invitation, unless an email provider is separately introduced. |

## Proposed behavior

After this update, the owner Team page will show newly registered staff and provide a clear operator-assignment flow. The owner will select a seeded machine-operator role, then select compatible active machines. The existing backend validation will continue to require that selected machines match the selected operator role. The page will refresh reactively when a new user profile is created, so a staff member registered through the email sign-up form appears in the owner directory without manual import.

Email sign-up will keep using `ensureProfile`, but the profile creation flow should be made reliable for both password and Google registration so every new staff member appears in the Team page. The default for a non-first registrant remains the current `storekeeper` role. The owner then changes that profile to the appropriate seeded machine-operator role and assigns compatible machines. No workspace catalog changes, invitation email, or independent workspace approval workflow is included.

## Detailed implementation plan

### 1. Expose operator assignment clearly in the Team page

Update `convex/owner/team.ts` so `getTeamSummary` continues to return the registered users and active machines needed for assignment. If workspace display is retained, read the already-seeded role-workspace configuration only for display; do not alter or create configuration. Return, for each team member:

- `workspaceId`;
- `workspaceLabel` or the matching workspace route label;
- `homeRoute`;
- optionally `workspaceConfigured`, so the UI can identify an unmapped legacy role.

The important new behavior is operator assignment, not workspace configuration. Add a backend test covering a newly created profile, changing it to a seeded operator role, and assigning compatible machines. The test should verify that incompatible machines are rejected and that non-operator roles cannot retain machine scope.

### 2. Update the owner Team page and staff drawer

Update `src/app/(dashboard)/dashboard/owner/team/page.tsx` to:

1. Keep the existing seeded roles and workspace presentation unchanged.
2. Make the role selector and compatible machine selector prominent for new staff profiles.
3. Show a clear empty state such as “Assign an operator role to enable machine assignment.”
4. Preserve the existing validation and machine-scope editing behavior.

Update `src/components/dashboard/roles/owner/staff-detail-drawer.tsx` to make the seeded operator roles and compatible machine list clear. Do not add an editable workspace selector. Workspace remains derived from the selected role.

Pass the current authenticated user ID into the drawer if it is not already supplied by the owner page, so self-edit restrictions remain consistent.

### 3. Make registration-to-Team visibility reliable

Keep `ensureProfile` as the single application-profile creation mutation. Strengthen it as follows:

- Normalize the identity email before comparison and persistence.
- Preserve the existing by-auth-ID and by-email relinking behavior.
- Return the created or relinked profile, including its role if practical.
- Keep the first-user owner rule, but document it and cover it with tests.
- Ensure a repeated call cannot create a duplicate profile for the same identity or email.

For password registration, retain the current sequence but handle an unsuccessful auth result before calling `ensureProfile`; the current code awaits the call but does not inspect a returned error object.

For Google registration, add a post-OAuth bootstrap path if testing confirms that the callback can bypass profile creation. The preferred design is:

1. OAuth callback returns to `/auth/bootstrap?next=/dashboard`.
2. The bootstrap client calls `ensureProfile`.
3. It redirects to `/dashboard`, where normal role routing sends the user to the correct workspace.
4. Errors render a recoverable sign-in message rather than leaving an authenticated identity without an application profile.

If the existing Better Auth integration already exposes a server-side callback hook, use that hook instead of a client bootstrap route. Do not implement both paths because duplicate profile creation is unnecessary even though the mutation is idempotent.

### 4. Make the owner directory semantics explicit

The owner page currently reads all rows in `users`, so a successfully registered staff account is already added to the Team directory. Document this in the UI copy with language such as “Registered staff accounts appear here automatically. Assign an operator role and machines from the profile.” Avoid introducing a separate `staff` table write from sign-up: `staff` is an operational personnel table with different fields, while `users` is the authenticated application-profile table used by access control.

If the desired meaning of “add to workspace” is an explicit membership rather than role-derived routing, introduce a separate table only after confirming that requirement. A future table could contain `userId`, `workspaceId`, `status`, `createdAt`, `updatedAt`, and a unique user-workspace index, but it would require changes to authorization, navigation, role editing, migrations, and audit logging.

### 5. Notifications and audit trail

Keep the existing role and machine-scope notifications. Add a user-facing notification only when an owner explicitly changes a role and the derived workspace changes. The notification should include the new workspace label and home route. Automatic registration should not notify every owner unless product policy requires it; the owner directory's reactive update is sufficient for the initial scope.

If the project requires traceability for automatic registration, add an audit event for profile creation with the identity email, assigned default role, and derived workspace. Do not log passwords or OAuth tokens.

## File-level change map

| File | Planned change |
|---|---|
| `convex/owner/team.ts` | Ensure the Team summary exposes registered users and active machines needed for operator assignment; do not modify workspace configuration. |
| `convex/users.ts` | Harden and document idempotent profile creation; optionally return workspace metadata and emit a workspace-change notification. |
| `convex/schema.ts` | No change for the role-derived approach. Add a membership table only if independent workspace membership is confirmed. |
| `src/app/(dashboard)/dashboard/owner/team/page.tsx` | Improve the operator-assignment entry point and registration visibility copy while preserving seeded roles and workspaces. |
| `src/components/dashboard/roles/owner/staff-detail-drawer.tsx` | Clarify seeded operator roles and compatible machine assignment; retain role-driven workspace behavior. |
| `src/app/sign-up/page.tsx` | Inspect auth result and route Google sign-up through profile bootstrap. |
| `src/app/auth/bootstrap/page.tsx` or existing auth callback | Ensure Google-created identities have an application profile before dashboard navigation. Use only one callback strategy. |
| `convex/test/ownerTeam.test.ts` | Add registered-profile and operator-assignment summary tests. |
| `convex/test/users.test.ts` or an existing user test file | Add first-user, repeat-call, by-email relink, and registration-profile tests. |
| `src/lib/role-routing.test.ts` | Add display/fallback tests only if static workspace fallback is introduced. |
| `docs/plan/owner-team-workspace-and-signup-staff.md` | This implementation plan. |

## Validation plan

The implementation is complete when the following checks pass:

| Check | Expected result |
|---|---|
| Type checking | `pnpm check` completes without errors. |
| Unit tests | `pnpm test` passes, including new owner-team and profile-creation tests. |
| Password registration | A new email account creates exactly one `users` profile and appears in the owner Team page with the default workspace. |
| Google registration | A new Google account creates exactly one `users` profile before dashboard navigation. |
| Repeat bootstrap | Refreshing or retrying the bootstrap does not create a duplicate profile. |
| Operator assignment | Changing a member to a seeded operator role enables only compatible active machines. |
| Workspace behavior | Changing the role uses the existing seeded role-to-workspace mapping; no workspace configuration is modified. |
| Access control | Only authorized owner/team managers can change roles or active state; self-deactivation and owner protections remain intact. |
| Responsive UI | The directory remains readable on narrow screens, with horizontal scrolling or a responsive card layout for the additional column. |

## Risks and decisions requiring confirmation

The workspace decision is now settled for this scope: existing seeded role-to-workspace mappings remain authoritative, and the update assigns only machine-operator roles and machines.

A second ambiguity is whether “new emails” means adding newly registered email accounts to the owner directory or sending invitation/reset emails. The current application has no configured email delivery for invitations, and the staff drawer explicitly disables that action. This plan treats the request as directory visibility and authenticated profile creation, not outbound email delivery.

## References

[1]: https://github.com/yoh-space/yt-ads "YT Ads repository"
