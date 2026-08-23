# Convex and Better Auth setup

The frontend is intentionally able to render before a Convex deployment is attached. To activate real-time persistence and Better Auth, create or connect a Convex project, run `pnpm exec convex dev`, and configure the following values in the Convex deployment: `BETTER_AUTH_SECRET` and `SITE_URL`.

The local environment must receive `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL` from the Convex CLI. The schema defines users, materials, machines, stock movements, job cards, production logs, and reusable offcuts. Run the Better Auth schema generation command after the first deployment before adding server-side authentication functions.
