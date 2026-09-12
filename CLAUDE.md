# YT Advertising repository guidance

This project uses **Next.js App Router**, **Convex**, and **Better Auth**.

## Active architecture

- `src/app/` contains the active Next.js routes and the Better Auth catch-all route.
- `src/components/dashboard/` contains the live Convex-backed dashboard, views, modals, and operator workspaces.
- `src/components/ui/` contains domain-neutral UI primitives and `src/components/public/` the order tracker and Telegram Mini App.
- `convex/` contains the schema, queries, mutations, authentication helpers, seed mutation, and shared backend validation.
- `src/lib/` contains shared frontend types, authentication clients, role routing, and pure conversion helpers.
- `src/shared/` contains the service catalog, material specifications, and machine catalog (seed-time fallbacks; DB-managed tables are the planned runtime source per `docs/plan/database-first-migration.md`).
- `src/proxy.ts` is the Next.js 16 edge request interceptor that enforces role-gated routing.
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

Persistent business operations must be implemented in Convex handlers. Mutations must validate input, require an active application profile, enforce the relevant role, and write all accounting changes transactionally. Production input, scrap, and offcut changes must remain auditable through `stock_movements`.

Do not edit generated files in `convex/_generated/` manually. Regenerate them through the Convex CLI when the schema or public functions change.

## Cleanup conventions

Before deleting a file, verify that it is not imported by active routes, handlers, tests, configuration, or package scripts. Do not remove the repository’s agent-skill documentation under `.claude/skills/`; those files are tooling guidance rather than application source.
