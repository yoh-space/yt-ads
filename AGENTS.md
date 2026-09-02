# YT Advertising repository guidance

This project uses **Next.js App Router**, **Convex**, and **Better Auth**.

## Active architecture

- `app/` contains the active Next.js routes and the Better Auth catch-all route.
- `components/dashboard/` contains the live Convex-backed dashboard, views, modals, and operator workspaces.
- `convex/` contains the schema, queries, mutations, authentication helpers, seed mutation, and shared backend validation.
- `lib/` contains shared frontend types, authentication clients, and pure conversion helpers.
- `pages/` is not an active routing directory for this App Router project.

## Development checks

Use the locked package manager and run the complete validation set before committing:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm check
NODE_ENV=production pnpm build
```

Keep deployment values in `.env.local` and use `.env.example` only as a safe template. Never commit secrets.

## Convex conventions

Persistent business operations must be implemented in Convex handlers. Mutations must validate input, require an active application profile, enforce the relevant role, and write all accounting changes transactionally. Production input, scrap, and offcut changes must remain auditable through `stockMovements`.

Do not edit generated files in `convex/_generated/` manually. Regenerate them through the Convex CLI when the schema or public functions change.

## Cleanup conventions

Before deleting a file, verify that it is not imported by active routes, handlers, tests, configuration, or package scripts. Do not remove the repository’s agent-skill documentation under `.claude/skills/`; those files are tooling guidance rather than application source.

## Desktop shell (Tauri v2)

The web client can be wrapped as a lightweight cross-platform desktop app. This is additive: the desktop shell does not change any core Next.js logic and stays inert when the web client is served normally.

- `src-tauri/` holds the Tauri v2 shell (`tauri.conf.json`, `Cargo.toml`, Rust entry points, capabilities, bundling icons). Updater and window config live in `tauri.conf.json`; the window is 1280×800 minimum and loads `http://localhost:3000` in development.
- `src/components/auto-updater.tsx` is a root-mounted background service that checks `@tauri-apps/plugin-updater` on startup and applies updates with a sonner toast. It no-ops outside a Tauri WebView (guarded by `isTauri()`).
- `src/lib/desktop.ts` exposes `printNative()` / `isDesktopShell()` used by the receptionist receipt print flow in the orders view.
- Role workspace landing is defined in `src/components/dashboard/nav-config.ts` (`ROLE_WORKSPACE`); each authenticated role is routed to its workspace view (admin/owner → analytics, storekeeper → inventory, operators → jobs).

### Rust prerequisite

Tauri needs the Rust toolchain (rustc + Cargo) and platform build tools. Windows targets require the MSVC toolchain (Build Tools). The desktop CLI commands therefore fail until Rust is installed.

```bash
pnpm tauri:dev   # start Next dev server + launch the desktop shell
pnpm tauri:build # produce release binaries + updater artifacts
```

### Remote auto-updater

The updater endpoint and signing key are placeholders in `tauri.conf.json` (`YOUR_TAURI_UPDATER_PUBLIC_KEY`, GitHub releases URL) and must be set for production pushes:

1. Generate a signing keypair with `npx tauri signer generate -w ~/.tauri/myapp.key`; keep the private key secret and put the public key in `tauri.conf.json`.
2. Release builds with `tauri:build` produce updater artifacts (`createUpdaterArtifacts: true`).
3. Serve `latest.json` and the installers through the configured GitHub Releases endpoint.
