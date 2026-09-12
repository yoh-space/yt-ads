# YT Advertisement Public and Operations Workflows

## Public client portal

The public home route is `/`. It presents YT Advertisement capabilities for large-format printing, UV flatbed work, CNC routing, laser cutting, DTF printing, and eco-solvent print & cut production. It uses the seeded company contact card, including Jemo Kafdem Building, Addis Ababa and the current company phone number.

The project request form captures the client or company name, phone number, service type, dimensions/specification, quantity, preferred due date, notes, and an optional artwork/reference file. Files are uploaded to Convex storage and only the storage identifier and filename are stored with the order. Public submission creates a `customerOrders` record in `Received` status and notifies active owner, manager, and general-manager profiles through the existing notification inbox.

## Client tracking

The `/track` route accepts either an order code such as `ORD-2026-123456` or the submitted phone number. It exposes only the client-safe fields needed for tracking and displays the progression:

`Received → In Production → Ready for Pickup → Completed`

Orders that pass their preferred due date are visually highlighted. The client can send one overdue inquiry per hour; the inquiry notifies management and is deduplicated to avoid notification spam.

## Internal order queue

Management and storekeeping roles receive an `Orders Queue` navigation entry. The queue combines public portal and walk-in orders, sorts by priority and preferred due date, and supports search, status, priority, and machine filters. An order can be converted once into a normal job card by selecting a machine, material, planned base-unit quantity, and priority. Conversion does not deduct inventory; regular production logging remains responsible for material consumption.

Operator job boards receive linked order metadata through the reactive dashboard query. When production begins, the order changes to `In Production`. When the job is completed, the order changes to `Ready for Pickup`. Management can then move the order to `Completed` after handoff.

## Direct exceptional stock-out

Storekeeper and management inventory screens expose a fast `Direct exception` action for small tasks that do not need a formal job card. The allowed reasons are:

- Sample Print
- Minor Repair
- Test Cut
- Internal Maintenance

The action requires a material, a positive quantity in the material base unit, and an optional quick-authorization note. It atomically deducts inventory, inserts a `stockExceptions` record, and writes a `stockMovements` record tagged `movementType: EXCEPTION_STOCK_OUT`. Standard receiving and production movements are tagged `STANDARD` where newly written.

## Overdue alerts and audit

A Convex hourly cron invokes the internal overdue check. Alerts are deduplicated for 24 hours per order and delivered to active management recipients. The dashboard also performs a safe, deduplicated refresh when a management user opens the queue, which makes overdue state visible immediately without waiting for the next hourly run.

The existing audit view now includes order lifecycle events and labels exception stock-outs separately from normal stock issues. Existing offcuts remain reusable, location-tagged records separate from scrap records.

## Reset and deployment notes

The workspace reset helper deletes customer orders and exception records before forced reseeding. No authentication users or owner profiles are removed. After deploying the schema, run the normal Convex deployment/code-generation flow so the hosted deployment receives `customerOrders`, `stockExceptions`, the new notification literals, and the hourly cron definition.
