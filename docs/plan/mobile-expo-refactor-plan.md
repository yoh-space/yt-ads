# Mobile Expo Refactor Plan

## Goal

Turn the existing `mobileApp/` Expo boilerplate (the `expo-push-easy` + Convex example) into the **YT Advertisement mobile client** for staff, by **refactoring in place** — not creating a new app.

Hard constraints:

- **Convex is the single source of truth.** The mobile app talks to the *same* Convex deployment as the web app (`glad-ibis-568` / root `convex/`). No separate mobile backend, no duplicate generated types, no offline mirror.
- **No offline mode.** No AsyncStorage data cache, no mutation queue, no NetInfo re-sync layer. Every screen reads live Convex reactive queries; every write is a Convex mutation. Zustand persists *nothing operational* — it holds at most the in-memory auth/profile slice (the Better Auth session token lives in SecureStore via Better Auth's storage).
- **Reuse the current Convex app as boilerplate.** Auth, types, role routing, and notifications must derive from the existing root `convex/` and `src/` — not copies.

## Important Details

- Repository: `yoh-space/yt-ads`, branch: `main`
- Web production Convex deployment: `glad-ibis-568`
- Boilerplate: `mobileApp/` (Expo SDK 54, expo-router 6, `expo-push-easy`, Convex v1.42) — git-tracked (123 files), committed in `e3bd128` and later.
- Boilerplate currently ships its **own `convex/` folder** (`pushTokens`, `scheduledNotifications`, `notificationHistory` schema + notify/push actions) — this is a demo deployment and must be **removed**; its useful bits (FCM send, token storage pattern) get folded into the root `convex/`.
- Boilerplate `constants/firebase.ts` hardcodes the **demo** `expo-push-easy` Firebase project credentials — must be deleted, replaced by env-driven config.
- Mobile-first roles per the scaffold commit: **receptionist, manager, owner** first-class; keep the tab model generic so `storekeeper`, `cashier`, `designer`, and machine-scoped operators render the same way.
- Root repo already depends on `zustand`, `better-auth`, `@convex-dev/better-auth`, `convex` (root `package.json`).
- Root auth: Better Auth component (`convex/auth.ts`, `convex/auth.config.ts`, HTTP routes in `convex/http.ts`); web client `src/lib/auth-client.ts`; Next.js bridge `src/lib/auth-server.ts`.
- Root notifications: `notifications` table + policy (`convex/notifications.ts`, `convex/notificationPolicy.ts`, `convex/notificationHelpers.ts`) — in-app only; no FCM/device-token plumbing yet.

## Architecture Decisions

| Concern | Choice | Reason |
|---|---|---|
| Backend | Root `convex/` deployment (`glad-ibis-568`) | Single source of truth; mobile is a second client |
| Generated API | Import root `convex/_generated/api` from `mobileApp` | No duplicate generation; same function refs everywhere |
| Auth | Better Auth (same component as web) + `convex.setAuth` token | Same identity, same profiles, no Clerk |
| Session storage | `expo-secure-store` as Better Auth client storage | Cookie jar doesn't exist on native |
| Client state | Zustand `useProfile()` hook | Mirrors web's role/profile needs; no Context nesting |
| Data state | Convex `useQuery/useMutation` only | Reactive, transactional, no offline layer |
| Push | FCM via `expo-push-easy` + `expo-notifications`, sender action in root `convex/` | The boilerplate already implements this; move it to the shared backend |
| Routing | Expo Router (already installed) `(auth)` + `(app)` stacks | File-based, typed routes, deep links for notifications |
| Shared web code | tsconfig path aliases to root `src/lib` (pure TS only) | Type + role constants stay single-source |

## Current Boilerplate Inventory

| Path (`mobileApp/`) | What it is | Action |
|---|---|---|
| `app/_layout.tsx`, `app/(tabs)/*` (Send/Schedule/History/API) | Push demo UI | Replace with YT `(auth)` + `(app)` router |
| `convex/` (`pushTokens.ts`, `notify.ts`, `history.ts`, `scheduled.ts`, `schema.ts`) | **Separate demo backend** | Delete; absorb into root `convex/` |
| `lib/convex.ts` | `ConvexReactClient` without auth | Rewire: root URL + `setAuth` |
| `lib/notifications.ts` | Channel + handler setup | Keep, adapt ids |
| `constants/firebase.ts` | Demo Firebase credentials | Delete; env-driven |
| `google-services.json` | Demo Firebase project file | Replace with real project file (kept out of git) |
| `components/*`, `hooks/*`, `constants/theme.ts` | SDK template UI/theming | Keep themed primitives; add YT design tokens |
| `convex/_generated/*` | Demo generated API | Delete with `convex/` |
| `scripts/send-test.mjs` | Demo push test | Delete or make root-action driven |

---

## Progress (updated 2026-09-15)

- **Phases 1–5 ratified** — mobile app now shares the root Convex deployment and root `src/lib` types with no duplicate backend. Verification passes: `mobileApp` `npx tsc --noEmit` (0 errors) and `npx expo export --platform android` (bundles root `convex/_generated` refs).
- Auth uses the same Better Auth client as web (`@convex-dev/better-auth` `convexClient()` plugin + `expo-secure-store` storage), wrapped by `ConvexBetterAuthProvider` in `app/_layout.tsx` (`convex.setAuth` token callback also present in `lib/convex.ts`).
- Routing is live: `(auth)` sign-in gate (`useProfile()`: `isHydrated/isAuthenticated/role`) + `(app)` role-driven `<Tabs>` from `ROLE_TABS`. All 31 per-role screen files generated as `ScreenPlaceholder` stubs (Phase 7 wiring behind them).
- Demo app removed: `app/(tabs)/`, `app/modal.tsx`, `convex/` (demo backend), `constants/firebase.ts`, `scripts/send-test.mjs`. `+not-found.tsx` redirects to `/sign-in`.
- Deleted `sign-up.tsx` — onboarding is invite-only through the existing web account flow (web `_app.tsx` has no sign-up either).

**Pinned to Phase 6 (not yet done):** root `deviceTokens` table + `convex/pushes.ts`; push fan-out in `convex/notificationHelpers.ts`; `providers/NotificationProvider.tsx` + `lib/notifications.ts` rewire; `constants/firebase.ts` env-driven config; `google-services.json` replacement; FCM send verification.

**Pinned to Phase 7 (not yet done):** replace the 31 `ScreenPlaceholder` files with live screens reusing root queries/mutations (reception queue, manager/owner overviews, storekeeper stock, cashier payments, operator machine dashboard + job cards, notifications inbox/badge).

**Pinned to Phase 8 (not yet done):** `eas.json` profiles, `.env.local`, EAS builds, end-to-end FCM verify.

---

## Phase 1 — Workspace wiring (monorepo shared code)

Goal: one repo root, mobile app imports the root backend and pure web libs.

1. **Metro** — add `mobileApp/metro.config.js` using `getDefaultConfig` and set `watchFolders` to the repo root so Metro can bundle files outside `mobileApp` (root `convex/_generated`, `src/lib`).
2. **TS paths** — extend `mobileApp/tsconfig.json`:
   - `@app/*` → `./*` (existing `@/*` kept for Expo)
   - `@convex/*` → `../../convex/_generated/*` (`api`, `dataModel`, `server` type-only)
   - `@shared-lib/*` → `../../src/lib/*` (pure TS: `operations-types`, `role-routing`, `permissions`, `access-policy`)
3. **Remove the mobile backend**: delete `mobileApp/convex/` entirely (schema, actions, generated files). Confirm no `import "../convex/..."` remains.
4. **Shared constants for mobile** — new `mobileApp/shared/role-navigation.ts` with `ROLE_TABS: Record<Role, TabConfig[]>` (Overview/Orders/Inventory/Jobs/Settings per role, plus custom primary tab for receptionist → Queue, storekeeper → Stock, cashier → Payments, operator → Dashboard). It imports `Role` and `WorkspaceId` from the aliased root `role-routing`, never redefines them.
5. Update `mobileApp/README.md` + `AGENTS.md` to describe the refactored app and the shared-convex model.

**Acceptance**: `npx expo export` bundles `api` references from root `convex/_generated`; `tsc --noEmit` passes in `mobileApp`.

## Phase 2 — Auth (Better Auth on native, same deployment)

Goal: staff sign in with the same accounts as web, same Convex profiles.

1. `mobileApp/lib/convex.ts`:
   - `export const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!)` (production URL; `dev:...` for local).
   - `convex.setAuth(async () => (await authClient.getSession())?.data?.session?.token ?? null)` — Convex then forwards the Better Auth session token on every request. Verify against the installed `@convex-dev/better-auth` plugin API (`convexClient` plugin vs manual token) using the version-current docs.
2. `mobileApp/lib/auth-client.ts`:
   - `createAuthClient` from `better-auth` (not `better-auth/react` on native — no cookie jar), `baseURL` from `EXPO_PUBLIC_BETTER_AUTH_URL` (= root site URL, e.g. `https://glad-ibis-568.convex.site`), `fetchOptions` with `Authorization` handling, and a `storage` implementation backed by `expo-secure-store` (`getItem/setItem/removeItem`).
   - Confirm field names/types from the installed `better-auth` client version; adjust for the `convexClient()` plugin shape if it differs.
3. `mobileApp/lib/profile.ts` helpers: `getCurrentProfileQuery` wraps `useQuery(api.users.getCurrentProfile)` (root users function) → returns `{ profile, role, active }`.
4. `.env.example` updates: `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_BETTER_AUTH_URL`. Provide the running deployment (not demo).

**Backend changes**: none — auth, `users`, `ensureProfile`, `getCurrentProfile` already exist in root `convex/users.ts`.

## Phase 3 — Zustand stores (no offline)

Goal: `useProfile()` hook; deliberately **no** offline/queue persistence.

- `mobileApp/stores/auth.store.ts` — Zustand store: `{ user, profile, role, isAuthenticated, isHydrated, initialize(), signIn(), signOut() }`. `initialize()` calls `authClient.getSession()` then `useQuery`-free direct Convex fetch via `convex.query(api.users.getCurrentProfile, {})`. No `persist` middleware for data.
- `mobileApp/stores/ui.store.ts` — ephemeral UI flags (loading, active tab, sheet/modal state, unread push count). Optional `persist` with `expo-secure-store` only for *non-operational* prefs, or none at all.
- `mobileApp/hooks/useProfile.ts` — selector hook over the auth store returning `{ profile, role, isAuthenticated, isLoading, refresh }`.
- **Explicitly out of scope**: mutation queues, AsyncStorage data caches, NetInfo-driven sync, optimistic offline writes.

**Acceptance**: `useProfile()` reflects live `getCurrentProfile`; sign-out clears the store; nothing operational is persisted locally.

## Phase 4 — Expo Router structure

Replace demo tabs with role-gated routing:

```
mobileApp/app/
├── _layout.tsx                # Providers: Convex, BetterAuth session, Notification, Toaster
├── (auth)/
│   ├── _layout.tsx            # Stack (headerShown false)
│   ├── sign-in.tsx
│   └── sign-up.tsx
├── (app)/
│   ├── _layout.tsx            # Role gate + Tabs from ROLE_TABS[role]
│   ├── owner/…                # overview, orders, inventory, jobs, settings …
│   ├── manager/…              # same pattern (first-class)
│   ├── receptionist/…         # queue (primary), orders, settings
│   ├── storekeeper/…          # stock (primary), requests, reconcile, settings
│   ├── cashier/…              # payments (primary), orders, settings
│   ├── designer/…             # tasks, settings
│   ├── admin/…                 # overview, orders, inventory, jobs, settings
│   └── operator/[machine]/…    # dashboard, jobs, inventory, reconcile, settings
└── +not-found.tsx
```

- `(app)/_layout.tsx` redirects unauthenticated → `/sign-in`; resolves profile from `useProfile()`; renders `<Tabs>` driven by `ROLE_TABS[role]` with `tabBarBadge` for notification-badge tabs.
- Operator machine resolution derives from `ROLE_TO_MACHINE_MAP` / `OPERATOR_MACHINES` (root `role-routing`), matching web workspace URLs (`/dashboard/operator/[machine]`). Mobile tabs use the same semantics under Expo Router names.
- Deep link handling: notification payloads carry `{ type, relatedId }`; map to router push in the notification response listener (Phase 6).

## Phase 5 — Shared types, role routing, permissions

Goal: mobile consumes root definitions, never re-declares them.

- `mobileApp` imports, via `@shared-lib` alias (pure TS files only — no web/Next deps):
  - `src/lib/operations-types.ts` — `Role`, `Profile`, `roleLabels`
  - `src/lib/role-routing.ts` — `ALL_ROLES`, `WorkspaceId`, `getRoleHomeRoute`, `getWorkspaceForRole`, `OPERATOR_MACHINE_MAP`, `ROLE_TO_MACHINE_MAP`
  - `src/lib/access-policy.ts` / `src/lib/permissions.ts` (pure) — capability gating for tab visibility if needed
- Do **not** alias into web-only modules (`src/app`, `src/components`, `next/*`, Convex `_generated/server`).
- `mobileApp/shared/role-navigation.ts` and screen mappers stay the only mobile-specific routing constants.

**Acceptance**: changing a role in root `operations-types.ts` surfaces in mobile typecheck without a copy.

## Phase 6 — Push notifications (root Convex + Firebase + Expo)

Goal: FCM delivery from the shared backend, device tokens registered from mobile.

1. **Root schema** (`convex/schema.ts`): add `deviceTokens` table:
   ```ts
   deviceTokens: defineTable({
     userId: v.id("users"),          // relates to users by _id; index
     token: v.string(),              // FCM or Expo push token
     platform: v.optional(v.string()),
     updatedAt: v.number(),
     active: v.boolean(),
   })
     .index("by_user", ["userId"])
     .index("by_token", ["token"]),
   ```
   Regenerate via `npx convex dev` / codegen (never edit `_generated` by hand).
2. **Root functions** — new `convex/pushes.ts` (adapted from the boilerplate's `pushTokens.ts` + `notify.ts`, but identity-based):
   - `registerToken` mutation: requires `requireActiveProfile`, stores/upserts the device token for the current profile.
   - `unregisterToken` mutation.
   - `sendToUser` action: reads tokens for a user, calls `expo-push-easy` `send(...)` with `FCM_SERVICE_ACCOUNT` from the **root** deployment env (`npx convex env set FCM_SERVICE_ACCOUNT ...`), returns send results.
   - Optional: scheduler/cron reconcile for dead tokens (from boilerplate's `scheduled.ts` pattern).
3. **Root notification dispatch**: extend `notifyByPolicy`/`notifyUser` (in `notificationHelpers.ts`) to optionally fan out FCM to recipient `deviceTokens` via `ctx.scheduler.runAfter(0, api.pushes.sendToUser, …)` after inserting the in-app `notifications` row. Keep this additive and non-blocking; in-app list semantics unchanged.
4. **Mobile** `providers/NotificationProvider.tsx`:
   - Permissions via `expo-notifications`; Android channel creation; foreground handler.
   - Register token: `Notifications.getExpoPushTokenAsync()` (Expo service) **and/or** raw FCM token via `expo-push-easy`/`expo-notifications` device token with `useDevicePushToken: true` → `convex.mutation(api.pushes.registerToken, …)`.
   - Listener → update UI badge (`useUIStore`), response listener → deep-link via `router` using payload `{ type, relatedId }`.
5. **Firebase config**: delete `constants/firebase.ts` demo creds; drive from `EXPO_PUBLIC_FIREBASE_*` env; replace `google-services.json` with the real project file (gitignored). Keep `expo-notifications` plugin in `app.json`; add `expo-build-properties` only if camera/cleartext needs arise.
6. iOS: `GoogleService-Info.plist` gitignored; note `expo-notifications` needs push entitlement in EAS profiles.

**Backend changes**: root `convex/` gains `deviceTokens` table + `pushes.ts`; `notificationHelpers.ts` gets optional push fan-out. Web app unaffected (additive).

## Phase 7 — Primary screens (reuse root queries)

Receptionist / manager / owner first-class; others from same skeletons.

| Screen | Root API (exists) | Notes |
|---|---|---|
| Reception queue | `api.customerOrders` reception paths (`getReceptionQueue`, review, price) | Mobile-first list, pull-to-refresh |
| Manager overview | `api.dashboard` / `api.orders` summaries | Stat cards + orders snapshot |
| Owner overview | `api.dashboard` / owner KPIs | Same |
| Storekeeper stock | `api.parentInventory.*` / `api.inventory.*` | Search + stock cards |
| Cashier payments | `api.cashier.orders.*` (list waiting, verify) | Same mutations as web |
| Operator dashboard | `api.machines.getByOperatorRole`, `api.jobCards.*`, `api.operatorSubStock.*` | Machine-scoped |
| Notifications | `api.notifications.list`, `unreadCount`, `markRead`, `markAllRead` | Live inbox + badge |

Detail screens reuse existing order/job/material detail queries; writes go through the same validated mutations (payment verify, job start/complete, stock-out, requisition, reconciliation). No backend screen-specific code — everything already exists.

## Phase 8 — Build & deploy

1. `mobileApp/eas.json` with `development` / `preview` / `production` profiles (mirrors the plan's `autoIncrement` production).
2. Env: `.env.local` in `mobileApp` with the production Convex URL + site URL; root deployment env gets `FCM_SERVICE_ACCOUNT`.
3. EAS builds: `eas build --platform android` (APK for preview, AAB for production); iOS entitlement for push.
4. Notifications verify: register token → owner triggers a notif in web → app receives FCM → badge update → tap deep-links to the related screen.

## Files Summary

**Delete**
- `mobileApp/convex/` (all demo backend incl. `_generated`)
- `mobileApp/constants/firebase.ts`
- `mobileApp/scripts/send-test.mjs`
- Demo tabs `app/(tabs)/` once replaced

**Add**
- `mobileApp/shared/role-navigation.ts`
- `mobileApp/providers/` (`AuthProvider.tsx`, `NotificationProvider.tsx`)
- `mobileApp/stores/` (`auth.store.ts`, `ui.store.ts`)
- `mobileApp/hooks/useProfile.ts`
- `mobileApp/lib/auth-client.ts`, `lib/profile.ts`
- `mobileApp/metro.config.js`
- `mobileApp/app/(auth)/*`, `app/(app)/*`, `app/+not-found.tsx`

**Root `convex/` additions**
- `convex/pushes.ts`
- `deviceTokens` table in `convex/schema.ts`
- Push fan-out hook in `convex/notificationHelpers.ts`

**Modified**
- `mobileApp/app/_layout.tsx`, `app.json`, `tsconfig.json`, `.env.example`, `README.md`, `AGENTS.md`

## Verification & Rollback

- Per phase: `cd mobileApp && npx tsc --noEmit` and `npx expo lint`; root `pnpm test` + `pnpm check` unaffected (mobile has no test harness yet; add vitest shims only if pure logic emerges).
- Single-source check: `git grep` for any `role`/`Role` type defined outside root `src/lib/operations-types.ts` in mobileApp → none.
- No-offline check: `git grep` for `AsyncStorage` / `persist(` data stores in mobileApp → only Better Auth session storage exists.
- Rollback: everything is git-tracked; mobileApp refactor is additive-with-deletions in one branch, backend additions are schema-additive and independently deployable. FCM deadline env failure degrades to in-app notifications only.

## Out of Scope (intentionally)

- Offline-first / mutation queue / background sync / local DB.
- Web + desktop behavior parity — mobile is a companion client for the same backend.
- Recreating a new Expo app — this plan refactors `mobileApp/` in place.