# YT Advertising — Mobile Client

Expo (SDK 54) client for YT Advertisement staff operations. This app talks to the **same Convex backend** as the web dashboard — there is no separate mobile backend or offline layer.

## Key facts

- **Auth**: Better Auth (same deployment as web). Staff sign in with their existing accounts.
- **Data**: All reads/writes are live Convex reactive queries and mutations.
- **Roles**: Expo Router screens are role-gated. Role constants come from the shared `src/lib/operations-types.ts` via tsconfig alias — never redefined on mobile.
- **Push notifications**: FCM via `expo-push-easy`, registered and delivered through the root `convex/` backend.

## Environment variables

Add to `mobileApp/.env.local` (create this file — never commit secrets):

```
EXPO_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
EXPO_PUBLIC_BETTER_AUTH_URL=https://<your-site>
```

The real values come from the running deployment (`glad-ibis-568`). The Expo URL is also set in the Convex dashboard under **Settings → General → URL**.

## Running locally

```bash
cd mobileApp
pnpm install        # first time only
npx expo start      # start Expo dev server
```

The root Convex dev server must already be running (`npx convex dev` from the repo root) for queries and mutations to resolve during development.

## How it works

| Layer | What happens |
|---|---|
| `lib/convex.ts` | `ConvexReactClient` with `setAuth` pulling the Better Auth session token from SecureStore |
| `lib/auth-client.ts` | `createAuthClient` backed by `expo-secure-store` |
| `stores/auth.store.ts` | Zustand store holding the current profile/role in memory (nothing persisted to disk) |
| `app/(auth)/` | Sign-in / sign-up screens |
| `app/(app)/` | Role-gated Tabs navigator; screens per role defined in `shared/role-navigation.ts` |

## Module aliases

Defined in `tsconfig.json` and resolved by Metro:

| Alias | Points to |
|---|---|
| `@/*` | `mobileApp/` (Expo standard) |
| `@convex/*` | Root `convex/_generated/*` (shared API types) |
| `@shared-lib/*` | Root `src/lib/*` (pure TS only — operations-types, role-routing, permissions, access-policy) |

Metro watches the repo root so these out-of-tree modules are bundled correctly.

## Project structure (high level)

```
mobileApp/
├── app/          # Expo Router file-based screens
├── lib/          # convex.ts, auth-client.ts, profile helpers
├── shared/       # mobile-specific constants (role-navigation.ts)
├── stores/       # Zustand stores (auth, ui)
├── providers/    # Context/notification providers
├── metro.config.js   # watches repo root
└── tsconfig.json     # @convex, @shared-lib aliases
```

## Troubleshooting

**Module not found / unable to resolve @convex or @shared-lib**
Ensure you ran `pnpm install` inside `mobileApp/`. Metro resolves modules from both `mobileApp/node_modules` and the repo root `node_modules` via `metro.config.js`.

**Notifications not received**
The FCM service account must be set on the root Convex deployment via `npx convex env set FCM_SERVICE_ACCOUNT "$(cat service-account.json)"` from the repo root.