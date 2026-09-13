1. Owner Sidebar Categorization & Reordering

Current state, verified: src/components/dashboard/roles/owner/owner-nav.ts is a flat 11-item array. WorkspaceNavItem (in workspace-shell.tsx) has no grouping field at all — { href, label, english, icon } — and WorkspaceSidebar renders it as one unbroken .map(). There's no architecture to categorize; it's purely a data-shape gap.

Design:

Add an optional section?: string to WorkspaceNavItem (optional so operator/admin/reception sidebars, which are already flat and fine, don't need to change).
Group ownerNavItems under sections ordered by how often the owner actually touches them, not alphabetically or by when the page was built:
Overview — Main Overview, Revenue & Profit
Operations — Orders, Machine Status, Stock Levels, Reconciliation Clearance
Insights — Reports, Audit Logs
Configuration — Operational Configuration (this is where Master Catalogs already lives)
Administration — Team, Settings
WorkspaceSidebar renders a small uppercase section label whenever item.section !== previousItem.section while iterating — no new component needed, just a conditional inside the existing .map().

Effort/risk: Trivial, zero backend change, zero risk to anything else. Ship this first.

2. Price Estimation on Base Unit, Not Purchase Unit

Current state, verified — this is a real, live bug relative to your intent. convex/owner/priceEstimates.ts's upsertPriceEstimate stores amount denominated in purchaseUnit (e.g. "2,400 ETB per roll"), and baseUnitEquivalent is an optional field the caller can supply manually — the server never derives it from materialCatalog.conversionRatio, even though that conversion ratio already exists specifically to do this math. This is the same "control exists but isn't wired in" pattern as the exception-stock-out PIN gap from the earlier leakage review — the mechanism is there, just not connected.

Design:

upsertPriceEstimate looks up the materialCatalog row by materialId server-side and computes baseUnitEquivalent itself: baseUnitEquivalent = amount / conversionRatio. Reject the write if the catalog row doesn't exist or conversionRatio <= 0 — never trust a client-supplied value for this field again.
Reframe what's authoritative: amount + purchaseUnit stay as the procurement record (how the owner actually buys it — useful for purchase orders and supplier comparison), but baseUnitEquivalent becomes the field every downstream consumer reads — job costing, quoting, inventory valuation. Base units (m², m, L, pcs) are what actual material consumption is measured in; purchase units (roll, sheet, canister) are a purchasing convenience and shouldn't leak into cost math.
UI: the owner still types the price the natural way ("2,400 ETB per roll"), but the panel shows a live-computed "≈ 12.00 ETB / m²" preview next to the input, calculated client-side from the same conversionRatio before save — so there's no surprise between what they typed and what the system will actually use.
Any existing reader of materials.etbValue (flagged as a compatibility projection in the prior plan) gets repointed to the active estimate's baseUnitEquivalent, not amount.

Sequencing note: do this right after Item 1 — it's backend-only, isolated to one file, and low risk, but it's the one silently-wrong number in production right now.

3. Replace Comma-Separated Attributes with Checkmarks

Current state, verified: database-catalog-suite.tsx still has parseList/formatList — raw comma-split text inputs — driving aliases, compatibleMachineTypes, requiredCapabilities, and memberCategories across the five slide-panels. I also checked: none of the multi-select primitives from the earlier dropdown-normalization plan (catalog-select.tsx, catalog-options.ts, catalogEnums.ts) were ever built — this item is reviving that plan's unfinished Phase C, not a new idea.

Design:

Build one CheckboxGroupField primitive (checkmark-list style, not a dropdown — matches your explicit ask) in a new src/components/dashboard/modals/catalog-select.tsx, taking { options: {value, label}[], selected: string[], onChange }.
Wire it against real data sources, not hardcoded arrays: compatibleMachineTypes → distinct machines.type values; requiredCapabilities → machineCapabilityLinks/listCapabilities; memberCategories → distinct materialCatalog.category values.
aliases stays free-text (it's genuinely open vocabulary — you can't checkbox-list synonyms nobody's typed yet) but gets trimmed/deduped server-side per the normalization principles already established.
Delete parseList/formatList once every call site is converted — don't leave them as dead code that a future edit accidentally reuses.

Sequencing note: do this after Item 2 lands, since the price-estimate panel redesign and this panel redesign will both touch database-catalog-suite.tsx — better to land them as two clean, sequential diffs than interleave.

4. Multiple Machines per Service (Owner-Configured)

Current state, verified: serviceRoutes.preferredMachineCode is v.string() — one machine per service route, enforced at the schema level. Separately, orderAutomation.ts's auto-router already tries to pick among several machines at dispatch time by matching operatorRole — but that's the buggy, implicit mechanism from an earlier review (an OR-condition that let a DTF printer and a heat press both look "compatible" with a banner job). What you're asking for is different and better: explicit, owner-declared machine options per service, not implicit role-matching.

Design — this is the most structural change of the six:

Add a new table, serviceMachineOptions:
ts
serviceMachineOptions: defineTable({
serviceId: v.string(), // FK -> serviceCatalog.id
machineCode: v.string(), // FK -> machines.code
priority: v.number(), // owner-set preference order, lower = preferred
active: v.boolean(),
})
.index("by_service", ["serviceId", "active"])
.index("by_machine", ["machineCode"])
serviceRoutes.preferredMachineCode is kept, not removed — it becomes "the default/first choice" and stays as the compatibility fallback for any code that hasn't been updated. New mutation upsertServiceMachineOptions(serviceId, machineCodes[]) replaces the whole set for a service in one call (simpler for a checkbox-list UI than one-row-at-a-time CRUD), validates every machineCode exists and is active, and requires at least one option remain the schema-level preferredMachineCode (so nothing that reads the old field ever gets null).
Fix the routing bug while you're in this code, since it directly affects correctness here: orderAutomation.ts's resolveAutoRouting should query serviceMachineOptions first (explicit owner intent) and only fall back to the old operatorRole-matching logic for services that haven't been configured yet. This finally resolves the wrong-machine-assignment bug from the earlier screenshot review, using data instead of an inference that was proven wrong.
UI: in the Service slide-panel, add a checkmark-list (reusing the Item 3 primitive) of all machines whose type/capability is broadly compatible with the service's catalogFamily, letting the owner tick "Ricoh, Crystal Jet 7K, ..." exactly as you described. Dispatch-time machine selection (Section on machines/configure) then load-balances only across the ticked set, not the whole fleet.

Why this doesn't conflict with existing dispatch code: selectMachineByLoad (load-balancing) stays exactly as-is — it just now receives its candidate list from serviceMachineOptions instead of from the buggy capability-role OR-check.

5. Customer Image Upload via UploadThing

Current state, verified: there is no image/file upload mechanism anywhere in the codebase today — no imageUrl/photoUrl/designFile field on customerOrders, no upload endpoint. This is genuinely new surface area, not a replacement of something existing.

Design:

Env: UPLOADTHING_TOKEN in Convex's environment variables (npx convex env set UPLOADTHING_TOKEN ...) and in .env.local for local dev — never in a committed file.
Backend: add an UploadThing file router (convex/uploadthing.ts or a Next.js API route, depending on which SDK integration path you use — UploadThing's Convex-community adapter vs. the standard Next.js App Router adapter is worth a quick doc check before locking this in, since the two have different setup shapes).
Schema: add to customerOrders (or a new orderAttachments table, recommended if an order can have more than one reference image):
ts
orderAttachments: defineTable({
orderId: v.id("customerOrders"),
fileUrl: v.string(),
fileKey: v.string(), // UploadThing's key, needed for deletion
uploadedAt: v.number(),
uploadedBy: v.optional(v.string()),
}).index("by_order", ["orderId"])
Frontend: UploadThing's <UploadButton />/<UploadDropzone /> component on the customer-facing order form (Telegram Mini App flow), constrained to image MIME types and a sane size cap (a print-reference photo doesn't need to be more than a few MB) — set this explicitly in the file-router config, don't rely on defaults.
Validation: verify the upload callback runs server-side (UploadThing's onUploadComplete webhook) and only then writes the orderAttachments row — never trust a client-reported "upload succeeded" message directly into the order record, so a customer can't spoof an attachment for an order that isn't theirs.
This is additive and isolated — it doesn't touch materials, pricing, or routing, so it can be built in parallel with Items 1–4 by a different engineer if you're splitting work. 6. Seed Confirmed Materials into materials as Single Source of Truth

Current state, verified — this is real fragmentation. Materials get inserted into the materials table from six separate places: convex/admin.ts, convex/materials.ts (the create mutation), and four different spots inside convex/seed.ts (lines 90, 497, 700, 1587). Meanwhile catalogMaterialId — the field proposed in the last plan to link an operational materials row back to its materialCatalog definition — doesn't exist in the schema yet; only the price-estimate and attribute-based catalog config from that plan actually shipped. So today, materialCatalog (identity/specs) and materials (stock/operations) are two parallel lists with no formal link at all.

Design:

Add catalogMaterialId: v.optional(v.id("materialCatalog")) to materials — this is the missing piece from the last plan and the actual prerequisite for "single source of truth."
Consolidate to one seed function, seedConfirmedMaterials (owner-gated, idempotent by name/slug like every other seed here), that:
Reads the owner's confirmed real material list (the actual business inventory — Banner Flex, Mesh Sticker, the ink canisters, etc., currently scattered across the four seed.ts sites).
For each, upserts the materialCatalog definition row first (id, category, family, units, conversion ratio, dimensions — all the specification data).
Then upserts the corresponding materials operational row, setting catalogMaterialId to link it, and carrying over quantity, reorderAt/reorderPolicy, storage location.
Retires the four scattered materials-only insert sites in seed.ts — one seed entry point instead of four, matching the "one authoritative seed path" principle already used for machines and services.
This becomes the actual backbone for everything downstream you listed — stock in/out (inventory.ts) and stock transfer already key off materials.\_id, so nothing there needs to change once every material has a catalogMaterialId; what changes is that "raw material catalog configuration" (name, category, thickness, attributes) and "reorder level" now both trace back to one linked pair of rows instead of independently-typed data in two unconnected tables.
Sequence this last, not first, despite it sounding foundational: it depends on the catalogMaterialId field, and it's the highest-blast-radius change of the six (touches every material currently in production data) — you want Items 1–5 stable and shipped before touching the thing every other feature reads from.
Recommended Build Order
Order Item Why here
1 Sidebar categorization Zero risk, ships same day
2 Price estimation base-unit fix Isolated, one file, fixes a live wrong number
3 Checkmark attribute UI Touches the same panel file as #2 — sequence right after
4 Multi-machine service mapping New table, moderate scope, fixes the earlier routing bug as a side effect
5 UploadThing image upload Fully independent — can run in parallel with 1–4
6 Materials single-source seeding Highest blast radius — do last, once catalogMaterialId need is confirmed by nothing else pending
