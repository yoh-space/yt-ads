/**
 * Public entry point for the Settings workspace.
 *
 * The monolithic file previously at this path has been decomposed into:
 *   - `settings/settings-view.tsx`      — page shell (sidebar + header + active panel)
 *   - `settings/settings-sidebar.tsx`   — category navigation
 *   - `settings/settings-header.tsx`    — page detail header
 *   - `settings/panels/*`               — profile, security, team, company panels
 *   - `settings/operational/*`          — owner operational configuration + sections
 *   - `settings/chrome/*`               — shared `FormSection`, `NumericField`, …
 *
 * External modules keep importing `SettingsView` and `OperationalPanel` from
 * this barrel so the public surface is unchanged.
 */
export { SettingsView } from "./settings/settings-view";
export { OperationalPanel } from "./settings/operational";
