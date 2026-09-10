# YT Advertisement — Documentation Suite

This directory is the canonical technical and architectural reference for the **YT Advertisement Operations Platform** (YoTech Digitals). It organizes architectural blueprints, operational workflows, security specifications, architectural decision records (ADRs), and active implementation plans.

---

## 1. Documentation Index

### Core Architecture & System Specifications

| Document | Purpose | Audience |
|---|---|---|
| [`architecture.md`](./architecture.md) | High-level system architecture, Next.js App Router edge guard, unified event-sourced inventory ledger (`stockMovements`), relational database schemas (`convex/schema.ts`), and client-server synchronization. | Engineers, System Architects, Technical Reviewers |
| [`workflows.md`](./workflows.md) | End-to-end operational workflows: customer order journey via Telegram Mini App, receptionist review lock, payment approval, automated dispatch, production logging, and customer notification pipelines. | Receptionists, Storekeepers, Product Managers |
| [`rbac-security.md`](./rbac-security.md) | Complete role-permission matrix (Owner, Manager, Storekeeper, Receptionist, Laser, CNC, Plotter, Printer), attribute-based access controls (ABAC), Telegram HMAC-SHA256 signature verification, and session hardening. | Security Auditors, Backend Engineers |
| [`owner-oversight.md`](./owner-oversight.md) | Executive auditing surfaces: ETB-denominated loss-prevention tracking, operator floor audit, floor batch clearance workflows, and owner operational boundaries. | Managing Director, Operations Auditors |

### Operational Specifications & Data Contracts

| Document | Purpose | Audience |
|---|---|---|
| [`yt-advertisement-seed-data.md`](./yt-advertisement-seed-data.md) | Authoritative master data specification: confirmed 23 raw materials, 6 machines, metric base unit conversion ratios, and initial workspace configurations. | Storekeepers, Data Engineers |
| [`yt-advertisement-public-operations.md`](./yt-advertisement-public-operations.md) | Public customer intake specification: Telegram bot `/start` binding, Mini App order placement, self-service tracking `/track?code=...`, and payment request receipts. | Frontend Engineers, Customer Support |
| [`adr/0001-workspace-routing-architecture.md`](./adr/0001-workspace-routing-architecture.md) | Architectural Decision Record: Next.js 16 edge-intercepted routing via `src/proxy.ts` guaranteeing instant role home landing without client redirect flicker. | Web Architects, Frontend Developers |

### Active Feature & Evolution Plans

| Document | Purpose | Status |
|---|---|---|
| [`plan/newFeature.md`](./plan/newFeature.md) | Customer Onboarding Wizard, Order Edit Lifecycle, Review Lock Boundary, and Automated Production Allocation Engine. | Phases 0–3 Complete, Phases 4–9 Planned |
| [`plan/dashboard-role-ui-ux-plan.md`](./plan/dashboard-role-ui-ux-plan.md) | Dashboard role workspace modernization, Amharic typography, telemetry widgets, and operator workspace ergonomics. | Implemented |
| [`owner-operational-configuration-plan.md`](./owner-operational-configuration-plan.md) | Centralized Owner Control Center for system policy management, waste tolerances, reorder thresholds, and audit trails. | Architectural Plan |

### Root References

| Document | Purpose |
|---|---|
| [`../README.md`](../README.md) | Master repository README, quick-start guide, tech stack overview, and development verification commands. |
| [`../AGENTS.md`](../AGENTS.md) | Single-page developer and agent orientation: Convex conventions, deployment safeguards, test, lint, and build checks. |
| [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) | Visual design tokens, semantic CSS variables, surface hierarchy, and UI primitive conventions. |
| [`../convex/README.md`](../convex/README.md) | Convex deployment configuration, database collections, transactional accounting rules, and seed mutations. |

---

## 2. Reading Order by Role

1. **New Developer / Contributor**:
   - [`../AGENTS.md`](../AGENTS.md) → [`architecture.md`](./architecture.md) → [`workflows.md`](./workflows.md) → [`rbac-security.md`](./rbac-security.md)
2. **Managing Director / Owner**:
   - [`owner-oversight.md`](./owner-oversight.md) → [`owner-operational-configuration-plan.md`](./owner-operational-configuration-plan.md) → [`workflows.md`](./workflows.md)
3. **Receptionist / Storekeeper**:
   - [`workflows.md`](./workflows.md) → [`yt-advertisement-seed-data.md`](./yt-advertisement-seed-data.md)
4. **Security Reviewer**:
   - [`rbac-security.md`](./rbac-security.md) → [`architecture.md`](./architecture.md)

---

## 3. Core Terminology Reference

| Term | Codebase Definition |
|---|---|
| **Central (Parent) Inventory** | Whole packaging units (`roll`, `sheet`, `canister`, `pack`, `pcs`) held by the storekeeper under `parentInventory`. |
| **Operator Sub-Stock (`operatorSubStock`)** | Base metric stock (`m²`, `m`, `L`) issued to a specific operator on a specific machine. |
| **Floor Batch Clearance** | The lifecycle `ACTIVE → PENDING_CLEARANCE → CLEARED` that gates new operator material requests on Owner sign-off. |
| **Reception Review Lock** | The atomic locking action (`lockOrderForReview`) that disables customer self-service edits once Reception begins review. |
| **Stock-Movement Events** | The canonical event types on `stockMovements` (`PURCHASE_IN`, `STORE_TO_MACHINE`, `PRODUCTION_CONSUMPTION`, `OFFCUT_RETURN`, `SCRAP_LOG`, `RETURN_TO_STORE`, `PHYSICAL_INVENTORY_ADJUSTMENT`). |
| **ETB** | Ethiopian Birr (currency unit for pricing, accounting, and monetary leakage calculations). |
