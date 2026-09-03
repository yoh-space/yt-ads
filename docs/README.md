# YT Advertisement — Documentation Suite

This folder is the canonical technical and architectural reference for the **YT Advertisement Operations Platform** (YoTech Digitals). It complements the in-codebase files (`AGENTS.md`, `CLAUDE.md`, `DESIGN_SYSTEM.md`, the existing `docs/*.md` history, and the Convex schemas) by providing long-form architectural exposition suited to onboarding, design reviews, and operational hand-offs.

## Table of contents

| Document | Purpose | Start here if you are… |
| --- | --- | --- |
| [`architecture.md`](./architecture.md) | System architecture, the unified event-sourced inventory ledger, the relational database schema (`convex/schema.ts`), and how the Next.js App Router, Convex backend, Tailwind/CSS design system, and the React/Telegram Mini App client fit together. | A new engineer, an architect reviewer, or anyone trying to understand *how the system is wired together*. |
| [`owner-oversight.md`](./owner-oversight.md) | The Owner's loss-prevention and executive-auditing surfaces — ETB-denominated leakage tracking, the operator floor audit, the **operator clearance workflow** that gates new material requests on owner sign-off, and the explicit scope boundary the Owner lives inside. | The Owner/Managing Director, an auditor, or a developer working on the executive dashboards. |
| [`workflows.md`](./workflows.md) | End-to-end operational workflows: the customer order journey through Telegram and the Mini App, 24-hour unpaid-order expiry, dual-layer (parent ↔ floor) reconciliation, and the receptionist‑gated customer‑notification pipeline. | A receptionist, storekeeper, or anyone implementing a workflow on top of the platform. |
| [`rbac-security.md`](./rbac-security.md) | The full role-permission matrix, attribute-based (ABAC) controls around machines and job cards, Telegram Mini App authentication (HMAC-SHA256 `initData` verification, phone binding on `/start`), and session/convex-storage hardening. | A security reviewer, a permissions engineer, or anyone wiring a new external integration. |
| [`../AGENTS.md`](../AGENTS.md) | Single-page contributor orientation: Convex-first conventions, deployment rules, lint/check/test/build commands. | Anyone editing the codebase for the first time. |
| [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) | Legacy design token reference (card / pill / button / form patterns). Authoritative visual language now lives in `src/components/ui/` + `src/app/globals.css`. | Designers producing new components that match the dashboard look. |

## How this documentation is organized

- **Architecture** answers *what is this platform made of* and *why it is shaped this way*.
- **Owner oversight** answers *what does the Owner (YoTech Digitals managing director) see and decide*.
- **Workflows** answer *how a job or an order moves from one state to the next* and *who is allowed to touch it*.
- **RBAC & security** answer *who is allowed to do what* and *how external clients (Telegram) prove their identity*.

## Reading the docs in the right order

1. **New engineer** — `architecture.md` → `rbac-security.md` → `workflows.md` → `owner-oversight.md` → `AGENTS.md` in the repo root for developer workflow.
2. **Owner / Managing Director onboarding** — `owner-oversight.md` (entire doc) → `workflows.md` § Customer Order Journey → `architecture.md` § Event-Sourced Inventory Ledger (for a sense of where leakage is recorded).
3. **Receptionist / storekeeper onboarding** — `workflows.md` → `rbac-security.md` § "What's visible to my role".
4. **Security audit** — `rbac-security.md` → `architecture.md` § "Two-tier inventory" + "Event-Sourced Ledger" → `workflows.md` § Notification Pipelines.

## Terminology notes

A few terms you will see repeatedly; their canonical definitions live in the relevant section, but here is the quick map:

| Term | Meaning in this codebase |
| --- | --- |
| **Central (parent) inventory** | Whole packaging units (rolls, sheets, liters) held by the storekeeper under the `parentInventory` table. |
| **Operator sub-stock (`operatorSubStock`)** | Base-unit stock (m, m², L) issued to a specific operator on a specific machine. |
| **Floor batch clearance** | The lifecycle `ACTIVE → PENDING_CLEARANCE → CLEARED` that gates new operator material requests on Owner sign-off. |
| **Reception** | The reception desk / order-confirmation step. Always gated by `order.manage` permission (Owner / Manager / Admin / Receptionist). |
| **Receptionist Telegram group** | The chat whose id is bound to `TELEGRAM_RECEPTION_CHAT_ID` (with `TELEGRAM_OWNER_CHAT_ID` as the legacy fallback). Receives the action-keyboard alerts every time a new order is submitted. |
| **Stock-movement events** | The seven canonical `eventType` values on `stock_movements`. The ledger is the source of truth for every inventory balance. |
| **ETB** | Ethiopian Birr. The currency unit on every monetary loss / gain / valuation figure surfaced to the Owner. |

## Provenance

Every section in this suite is grounded in the in-tree source. Where a section references an authoritative line (e.g. *see `convex/materialRequests.ts:50`*) the cited file and line are part of the locked release. Where code has since been refactored, the description explains the **invariant** rather than the literal implementation detail so the docs do not rot as the implementation evolves.
