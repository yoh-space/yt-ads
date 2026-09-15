# Tauri Mobile Build Plan (Option A)

One codebase — the existing Next.js web client — ships to web, desktop, Android, and iOS.
The Expo/React Native `mobileApp/` project is dropped. The existing Tauri v2 shell is
extended to mobile targets.

## Why this works

- `src-tauri/` is already a Tauri v2 shell (`tauri = "2"`) serving the Next.js app at
  `http://localhost:3000` in development.
- `src-tauri/src/lib.rs` already has `#[cfg_attr(mobile, tauri::mobile_entry_point)]` —
  the template is mobile-ready.
- Tauri v2 fully supports Android + iOS (WebView apps). React Native did **not** run in
  a WebView, which is why the Expo project had to be discarded under this option.

## Verified current state

| Item | Status |
| --- | --- |
| Rust toolchain | `rustc 1.98.0` installed |
| Tauri CLI | `tauri-cli 2.11.4` (mobile-capable) |
| JDK for Android | OpenJDK 21.0.10 present |
| Android SDK | `ANDROID_HOME = C:\Users\yohan\AppData\Local\Android\Sdk` |
| iOS | Not buildable on Windows (requires macOS/Xcode) |
| CI | No `.github/workflows` yet |
| `tauri.conf.json` | Desktop identity `com.ytadvertisements.desktop`, remote `frontendDist`, updater placeholders |

## Architecture decisions

### 1. Production frontend source

- **Development**: unchanged `devUrl: http://localhost:3000` (Next dev server). On a
  physical Android device use `adb reverse tcp:3000 tcp:3000`.
- **Production — decided: bundled static export, no remote URL.** The APK bundles the
  Next.js static export assets; the WebView loads from local disk (offline-capable, no
  Vercel/remote dependency). Backend/auth all live on Convex, so pages are thin clients
  and the static export is functionally complete (server-side role gating becomes
  defense-in-depth only — Convex still enforces authz).
- **Export blockers found**: `next.config.ts` has no `output: "export"` and there are two
  route handlers (`src/app/api/auth/[...all]/route.ts`, `src/app/api/telegram/route.ts`)
  that `output: "export"` rejects. Phase 2 must either remove/adapt these for the export
  build (prefer a scoped export config / consolidate auth under the Convex HTTP router;
  decide whether the Telegram webhook stays Vercel-server-side only) or fall back to
  **self-hosting the Next build on an internal server** (still no Vercel URL, still a
  remote `frontendDist`). Default: attempt static export first.
- **Desktop shell** stays on its existing remote `frontendDist` (unchanged) via a
  per-platform config overlay — mobile uses `frontendDist` → bundled export dir.

### 2. Bundle identity

- Desktop keeps `com.ytadvertisements.desktop`.
- **Mobile (decided): `app.yotech.ytadvertisements`.** Tauri derives the Android package
  name from `bundle.identifier` at `android init`; set the `applicationId`/namespace in
  the generated `src-tauri/gen/android` Gradle project to `app.yotech.ytadvertisements`
  (do not change after first sideload install).

### 3. Auth (Better Auth) in the mobile WebView

- Email/password sign-in rides on cookies/fetch and works in a WebView with the Convex
  site origin.
- The `ytads://` trustedOrigin and the `expo()` server plugin were added only for Expo —
  **revert both** (see Phase 0).
- Reconfirm `trustedOrigins`/`behindProxy` in `convex/auth.ts` against the Convex site URL
  after the first device smoke test.

### 4. Notifications

- `tauri-plugin-notification` is already registered. On Android 13+ add/confirm
  `POST_NOTIFICATIONS` in the generated `AndroidManifest.xml`; request permission at
  runtime from the web client when the shell is detected.
- Keep the local `notification.wav` resource for the `play_notification_sound` command.

### 5. Distribution & updater — internal sideload (decided)

- No Play Store / App Store. Distribute signed APKs directly to staff devices.
- Generate a Tauri signing keypair (`npx tauri signer generate -w ~/.tauri/myapp.key`);
  store the private key in a secret vault, put the pubkey in `tauri.conf.json`.
- Host `latest.json` + APK bundles on an internal endpoint (GitHub Releases or a company
  server) via `tauri-plugin-updater`.

## Migration steps

### Phase 0 — remove the Expo project and revert Expo config

1. Delete `mobileApp/` (verified unreferenced by web src/ and convex/).
2. Remove `packages: ["mobileApp"]` from `pnpm-workspace.yaml`.
3. Revert `convex/auth.ts`: drop the `expo()` plugin and `trustedOrigins: ["ytads://"]`.
4. Remove `@better-auth/expo` from root `package.json` (keep `better-auth ~1.6.33`).
5. `pnpm install` at root — restores the frozen-lockfile baseline.
6. `pnpm test` + `pnpm check` to confirm the shared app is unaffected by the revert.

### Phase 1 — wire Android target

1. Install native build pieces:
   - `cargo install cargo-ndk`
   - `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
   - Confirm Android SDK platform-tools/build-tools + licenses (`sdkmanager --licenses`).
2. Scaffold: `pnpm tauri android init` → creates `src-tauri/gen/android` (Gradle project,
   icons, manifest).
3. Android manifest: set app label/package, orientation, and notification permission.
4. Dev on emulator/device: `pnpm tauri android dev`; if the device can't reach
   `localhost:3000`, `adb reverse tcp:3000 tcp:3000`.

### Phase 2 — production config + build

1. Resolve the static-export blockers (route handlers) — validated export build or the
   self-host fallback (Decision 1).
2. Update `tauri.conf.json` (or a mobile overlay config so desktop keeps its remote URL):
   - `frontendDist` → the static export output dir for the mobile target.
   - Mobile bundle identity `app.yotech.ytadvertisements`.
   - Real updater pubkey/endpoints; `createUpdaterArtifacts: true`.
3. Release build: `pnpm tauri android build` (APK) and configure release signing
   (keystore + `ANDROID_KEYSTORE_*` env / `gradle.properties`).
4. Smoke test on a physical device: sign in as each role, notifications, reconciliation,
   inventory, jobs.

### Phase 3 — iOS (macOS required — separate machine or CI)

1. `pnpm tauri ios init` and `pnpm tauri ios build` on a Mac (for internal distribution
   via ad-hoc provisioning; no App Store).
2. Add a GitHub Actions workflow (macos-latest) building the Android APK + iOS artifacts
   with signed secrets (keystore vars, Apple Developer / Fastlane credentials).
3. Distributions: internal Android APK + updater endpoint; iOS ad-hoc builds.

### Phase 4 — verification checklist

- [ ] `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm check`, `NODE_ENV=production pnpm build` still pass at the root.
- [ ] Desktop and web unaffected by the revert (auth regression: sign in with an existing account).
- [ ] Android: sign-in, role-based routing, a full order→job→reconciliation flow, local notification sound.
- [ ] Auth session persists across app restarts in the WebView.
- [ ] Updater: Android downloads/installs a newer release (dev test build first).

## Risks / notes

- **Static export**: `output: "export"` is incompatible with the existing route handlers;
  confirming the export path or switching to the internal self-host fallback is the main
  Phase 2 gate. Telegram webhook may need to stay server-side (Vercel) only.
- **iOS cannot be built on this Windows machine** — needs a Mac or CI (Phase 3); internal
  iOS distribution requires ad-hoc/enterprise signing.
- App Store review is not a concern (internal sideload, decision 3), but WebView-natural
  UX still wants the native shell features working (local notifications, updater).
- Remote-URL production + Better Auth: only relevant if the self-host fallback is chosen;
  confirm cookie/session behavior and `trustedOrigins` against the internal origin.
- Tauri updater requires the encrypted signature — generate a keypair early and protect
  the private key.
- Reverting Expo config touches the shared auth path; do it as a single commit with the
  mobileApp removal and rerun the full root validation set.

## Open questions

1. ~~Production frontend: remote Vercel URL (v1) vs bundled static export?~~ **Decided:
   bundled static export, no Vercel. Fallback: internal self-host.**
2. ~~Android release identity~~ **Decided: `app.yotech.ytadvertisements`.**
3. ~~Play Store / internal sideload?~~ **Decided: internal sideload (APK), internal
   updater endpoint.**
4. Telegram API route: keep exclusively on the hosted web app, or does the mobile app
   need notifications/updates from Telegram?