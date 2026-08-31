# Migration Plan: app/ → src/app/

## Current State
- **Active routes**: `app/` directory with 11 items
  - `api/auth/[...all]/` (Better Auth catch-all)
  - `dashboard/page.tsx`
  - `sign-in/page.tsx`, `sign-up/page.tsx`, `track/page.tsx`
  - Root files: `error.tsx`, `layout.tsx`, `loading.tsx`, `page.tsx`, `globals.css`
- **Path mapping**: `"@/*": ["./*"]` in `tsconfig.json`
- **No src/ directory exists**

## Migration Steps

### 1. Create src directory structure
```bash
mkdir src
```

### 2. Move app directory
```bash
mv app src/
```

### 3. Update tsconfig.json paths
Change from:
```json
"paths": {
  "@/*": ["./*"]
}
```
To:
```json
"paths": {
  "@/*": ["./src/*", "./*"]
}
```
**Note**: Added fallback to root directory to resolve `@/components`, `@/lib`, `@/convex` which remain at root level.

### 4. Delete old app directory
```bash
rm -rf app
```

### 5. Clean Next.js cache
```bash
rm -rf .next
```

### 6. Verify migration
```bash
pnpm install --frozen-lockfile
pnpm check
NODE_ENV=production pnpm build
pnpm dev
```

## Impact Assessment
- **No code changes required**: No direct imports from `app/` found in source files
- **Better Auth**: Catch-all route at `src/app/api/auth/[...all]/` will continue working
- **Path aliases**: All `@/` imports will resolve to `src/` first, then fall back to root for shared code
- **Shared directories**: `components/`, `lib/`, `convex/` remain at root level and are accessible via `@/` alias

## Rollback (if needed)
```bash
mv src/app app
rm -rf src
# Revert tsconfig.json paths to ["@/*": ["./*"]]
rm -rf .next
```

## Migration Status
✅ **Completed** - All steps executed successfully
- Type check passes (`pnpm check`)
- Path alias configured for both `src/` and root directories
- Old `app/` directory removed
- Ready for production build verification
