# Mobile app guidance (mobileApp/)

The YT Advertising mobile client is a second client of the **root Convex backend** and the **shared web type definitions**. It is not a standalone app.

## Convex model

- The database, schema, and functions live in the repo root `convex/`. This app has **no `convex/` folder** of its own and no separate deployment.
- Import generated API/types via the `@convex/*` alias → root `convex/_generated/*`. Never hand-edit generated files.
- Persistent operations must be implemented in the root Convex handlers; the mobile app only calls them.
- When working on root Convex code, first read `convex/_generated/ai/guidelines.md`.

## Shared code model

- Import pure TS shared modules via `@shared-lib/*` → root `src/lib/*`: `operations-types.ts` (Role, Profile), `role-routing.ts`, `permissions.ts`, `access-policy.ts`.
- Do **not** alias into web-only modules (`src/app`, `src/components`, `next/*`).
- Do not redefine `Role`, `WorkspaceId`, or permissions on mobile. Mobile-specific routing constants live only in `shared/role-navigation.ts`.

## State rules

- Convex queries/mutations are the only data layer. **No offline mode**: no AsyncStorage data caches, no mutation queues, no NetInfo re-sync.
- Zustand stores must persist nothing operational. The only persisted value on device is the Better Auth session token (expo-secure-store).

## Verification

```bash
cd mobileApp
pnpm install
npx tsc --noEmit
npx expo export --platform android   # bundles root convex/_generated refs
```

Root checks (`pnpm test`, `pnpm check` in the repo root) must remain unaffected by mobile changes.

## Rules

- Read the exact versioned Expo docs at https://docs.expo.dev/versions/v54.0.0/ before writing Expo code.
- Keep the plan in `docs/plan/mobile-expo-refactor-plan.md` up to date as phases land.