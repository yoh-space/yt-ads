# 50% Advance Payment Workflow and Bank Details Payload Integration Plan

**Repository reviewed:** `yoh-space/yt-ads`  
**Baseline branch:** `main`  
**Baseline commit reviewed:** `de6713a`  
**Prepared by:** Manus AI  
**Scope:** Planning only. This document intentionally contains no implementation code.

## 1. Executive implementation summary

The current application separates order intake, quote confirmation, payment confirmation, job-card issuance, production, and pickup readiness. The existing payment model is not sufficient for a two-stage payment workflow because it supports only `UNPAID`, `PAID`, and `APPROVED_CREDIT`, while the requested workflow needs an explicit distinction between the initial 50% advance and the final 50% settlement.

The recommended design is to preserve the existing `status` field for the operational order lifecycle and extend `paymentStatus` for the financial lifecycle. The order will remain operationally `READY_FOR_PICKUP` when production is complete, while its payment status will remain `PARTIALLY_PAID` until the receptionist records the final balance. The final settlement will change the payment status to `FULLY_PAID`. This avoids conflating operational state with financial state and prevents existing order-routing logic from becoming ambiguous.

The implementation should calculate all payment amounts on the server from the final quoted total. The client may display a preview, but it must not be trusted as the source of the advance or remaining balance. The system should persist a normalized bank-details payload with the order when the final quote is accepted, use that payload in customer-facing notifications, and provide copy controls in the receptionist interface and customer-facing Telegram message.

## 2. Findings from the current codebase

| Area | Current behavior | Consequence for the requested workflow |
|---|---|---|
| Order schema | `customerOrders` stores `amount`, `paymentStatus`, `paymentMethod`, payment confirmation metadata, and operational `status`. | The existing structure can support the feature, but payment status values and amount fields must be expanded. |
| Payment statuses | The schema supports `UNPAID`, `PAID`, and `APPROVED_CREDIT`. | `PARTIALLY_PAID` and `FULLY_PAID` must be added. The existing `PAID` value should be deprecated or migrated. |
| Reception quote flow | Reception creates an order, then uses `priceOrder` to save the final amount and move the order to `PRICED_AND_PENDING_PAYMENT`. | The authoritative 50% calculation should occur when the final quote is committed, not only in the initial draft form. |
| Production gate | `confirmOrderAndIssueJobCard` currently accepts `PAID` or `APPROVED_CREDIT` and then issues the job card. | It must accept a verified 50% advance as sufficient for production and record `PARTIALLY_PAID`. Credit handling must remain explicit. |
| Operational statuses | The flow is `PENDING_REVIEW` → `PRICED_AND_PENDING_PAYMENT` → `CONFIRMED_PAID_OR_CREDIT` → `JOB_CARD_CREATED` → `IN_PRODUCTION` → `COMPLETED` → `READY_FOR_PICKUP`. | `READY_FOR_PICKUP` already exists and should remain the operational trigger for the remaining-balance notification. |
| Customer notification | `pushCustomerOrderStatus` schedules Telegram notifications for quoted, issued, production, completed, and pickup-ready states. | The existing helper is the correct integration point, but its payload must include payment figures and bank details. |
| In-app notifications | `notifyRoles` creates internal notifications for staff roles. | The workflow should continue creating staff notifications separately from customer notifications. |
| Telegram delivery | Telegram is delivered through an internal scheduled action and the `/api/telegram` webhook infrastructure. | Telegram is available for automation. Delivery should be made idempotent and failure-visible. |
| SMS delivery | No SMS provider or SMS abstraction is present in the repository. | SMS should not be promised as implemented until a provider and credentials are selected. The notification layer should expose an adapter boundary for a later SMS channel. |
| Bank details | No bank-account or merchant-ID settings exist. | Bank details require Owner-managed configuration and validation. |
| Company settings | `companySettings` already stores branding and notification preferences and is Owner-managed through `users.getCompanySettings` and `users.updateCompanySettings`. | Bank details should be added to this existing Owner settings surface, with sensitive operational values excluded from public company-info queries. |
| Public order projection | Customer tracking projections currently expose status and payment status but not amounts or settlement instructions. | The public projection must expose only the payment summary and bank payload required for the customer experience. |

## 3. Target lifecycle

The target lifecycle should use two coordinated state machines.

### 3.1 Operational order lifecycle

The existing operational sequence should remain unchanged:

| Stage | Operational `status` | Financial expectation |
|---|---|---|
| Intake | `PENDING_REVIEW` | No final amount or payment obligation is recorded yet. |
| Quote committed | `PRICED_AND_PENDING_PAYMENT` | Total amount, 50% advance, and 50% remaining balance are calculated. |
| Advance verified and job issued | `JOB_CARD_CREATED` | `paymentStatus = PARTIALLY_PAID`, unless the order is approved under the separate credit policy. |
| Production | `IN_PRODUCTION` | Payment status remains unchanged. |
| Work completed | `COMPLETED` | Payment status remains `PARTIALLY_PAID` until settlement. |
| Pickup ready | `READY_FOR_PICKUP` | Remaining-balance notification is sent. Payment status remains `PARTIALLY_PAID` if the advance was the only payment recorded. |
| Final settlement | Existing operational status remains `READY_FOR_PICKUP` unless the product later adds `PICKED_UP`. | `paymentStatus = FULLY_PAID`. |

The requested “transition to `FULLY_PAID`” should therefore be implemented as a payment-status transition. Creating a new operational order status named `FULLY_PAID` is not recommended because it would mix payment state with production and fulfillment state.

### 3.2 Financial lifecycle

| Financial state | Meaning | Required fields |
|---|---|---|
| `UNPAID` | No payment has been verified. | Total may be known; advance and balance are calculated but not received. |
| `PARTIALLY_PAID` | The required 50% advance has been verified. | Total amount, advance due, advance paid, remaining due, payment method, verifier, and timestamp. |
| `FULLY_PAID` | The remaining balance has been verified. | Total amount, advance paid, final payment, zero remaining balance, final payment method, verifier, and timestamp. |
| `APPROVED_CREDIT` | An authorized credit decision replaces immediate advance payment. | Credit approver, timestamp, reason or reference. |

The existing `PAID` value should be handled through a migration. Existing records marked `PAID` need a business decision: either map them to `FULLY_PAID` when their historical meaning indicates complete settlement, or map them to `PARTIALLY_PAID` when the current system used `PAID` only as a production-release gate. The migration must not infer this silently from incomplete data.

## 4. Data model plan

### 4.1 Payment fields on `customerOrders`

Add explicit monetary fields rather than deriving every display value from a single amount at render time. The recommended fields are:

| Field | Purpose |
|---|---|
| `amount` | Final quoted total, normalized to two decimal places. |
| `advanceDueAmount` | Exactly 50% of the final quoted total, rounded according to one documented currency rule. |
| `advancePaidAmount` | Amount actually verified as received for the advance. Normally equal to `advanceDueAmount`. |
| `remainingDueAmount` | Amount still required before collection. Initially equal to the advance due amount and eventually zero. |
| `finalPaidAmount` | Amount recorded during final settlement. |
| `paymentStatus` | `UNPAID`, `PARTIALLY_PAID`, `FULLY_PAID`, or `APPROVED_CREDIT`. |
| `advancePaymentMethod` | Cash, CBE, BOA, Telebirr, CBE Birr, or another configured method. |
| `advancePaymentReference` | Optional transfer reference or receipt number. |
| `advancePaymentConfirmedAt` | Timestamp for advance verification. |
| `advancePaymentConfirmedBy` | Staff identity that verified the advance. |
| `finalPaymentMethod` | Method used for the remaining balance. |
| `finalPaymentReference` | Optional final transfer reference or receipt number. |
| `finalPaymentConfirmedAt` | Timestamp for final settlement. |
| `finalPaymentConfirmedBy` | Staff identity that verified the final settlement. |
| `paymentInstructionsSnapshot` | Bank and merchant details used for customer messages for this order. |

The payment-instructions snapshot should be an optional structured object containing a version or captured timestamp and a list of enabled accounts. Each account should have a display label, institution or channel, account name where applicable, account number or merchant ID, and an optional instruction note. The snapshot prevents historical customer messages from changing unexpectedly when the Owner later updates bank details.

### 4.2 Bank details on `companySettings`

Add an Owner-managed bank-details object to the existing company settings record. It should support at least:

| Account type | Required values |
|---|---|
| Commercial Bank of Ethiopia | Account number, account name, enabled flag. |
| Bank of Abyssinia | Account number, account name, enabled flag. |
| Telebirr | Merchant ID or mobile number, display name, enabled flag. |
| CBE Birr | Merchant ID or mobile number, display name, enabled flag. |

The fields should be optional so a deployment may configure only the channels it actually uses. At least one enabled account should be required before the Owner can publish payment instructions for new orders. Account numbers and merchant IDs must be validated as strings, not numeric values, so leading zeroes are preserved.

Bank details must not be included in the existing public company-information query. A separate customer-payment-instructions projection should return only the enabled fields intended for customers. Internal administrative queries may return the complete configured set to the Owner.

### 4.3 Audit and consistency requirements

Payment mutations should write all payment-related changes transactionally on the order record. The implementation should preserve who verified each payment, when it was verified, how it was paid, and any reference supplied by the customer. If the repository’s existing audit model is extended, payment events should be recorded as structured events rather than relying only on free-text notes.

## 5. Backend implementation plan

### Phase A: Establish payment-domain constants and validation

1. Extend the payment-status validator with `PARTIALLY_PAID` and `FULLY_PAID`.
2. Define one server-side currency rounding rule and use it everywhere. For a total of 600 ETB, the advance due must be 300 ETB and the remaining due must be 300 ETB.
3. Define the invariant that `advanceDueAmount + remainingDueAmount = amount` within the rounding rule.
4. Define the invariant that `advancePaidAmount` cannot exceed `advanceDueAmount` unless the product explicitly supports overpayment.
5. Reject negative amounts, non-finite amounts, and malformed account values.
6. Ensure payment calculations occur from the server-authoritative quoted total.

### Phase B: Add Owner-managed bank configuration

1. Extend the company-settings schema with the four supported payment channels.
2. Extend the Owner company-settings query and mutation to read and update bank details.
3. Keep the existing company-settings permission guard and add field-level validation for account numbers and merchant identifiers.
4. Add an Owner settings section titled “Customer payment instructions.”
5. Display a preview of the final customer payload before saving.
6. Add an enabled/disabled control for each account channel.
7. Prevent saving an enabled account without its required name and identifier.
8. Show a warning when no payment channel is enabled.
9. Version or timestamp the saved payment-instructions configuration so order snapshots can be traced to the configuration active at quote time.

### Phase C: Calculate the advance when the final quote is committed

1. Keep order creation compatible with the existing draft behavior. The create mutation may accept an optional amount, but the final quote mutation must remain authoritative.
2. Update the receptionist quote-commit flow so entering 600 ETB immediately produces:
   - Total: 600 ETB.
   - Required advance: 300 ETB.
   - Remaining due: 300 ETB.
   - Initial payment status: `UNPAID` until the advance is actually verified, or `PARTIALLY_PAID` if the same interaction records the received advance.
3. Resolve this product decision explicitly before implementation: whether the quote modal only calculates the advance or also records the advance receipt. The requested lifecycle implies that the system should calculate the advance at quote time and verify it in the following payment-confirmation step.
4. Snapshot the currently enabled bank details onto the order when the final quote is committed.
5. Include the calculated amounts and the bank payload in the Telegram quote notification.
6. Include a copyable payment payload in the receptionist confirmation view.

The recommended default is to leave the order `UNPAID` when only the total price is entered, then set it to `PARTIALLY_PAID` when reception verifies the 50% transfer or cash receipt. This preserves accounting accuracy and avoids recording money merely because a quote was entered.

### Phase D: Permit production after verified advance payment

1. Update `confirmOrderAndIssueJobCard` so a verified 50% advance is a valid production gate.
2. Replace the current assumption that only `PAID` or `APPROVED_CREDIT` can release production.
3. Require the advance payment amount and method when the payment decision is an advance payment.
4. Confirm that the received advance is at least the calculated advance due amount.
5. Set `paymentStatus = PARTIALLY_PAID` and persist the payment metadata before issuing the job card.
6. Preserve the separate `APPROVED_CREDIT` route for authorized credit decisions. Credit must not accidentally become an unpaid production path.
7. Keep material reservation, job-card creation, inventory deduction, and payment confirmation inside the same transaction boundary used by the existing mutation.
8. Update staff notifications from “paid order” to wording that accurately identifies an advance-paid order.
9. Update the customer confirmation message to show the total, advance paid, remaining due, and bank payload.

### Phase E: Add final settlement mutation

1. Add a receptionist-authorized final-settlement mutation dedicated to payment settlement.
2. Require the order to be `READY_FOR_PICKUP`, unless the business explicitly allows earlier prepayment.
3. Require the final payment amount to equal the current remaining due amount under the rounding rule.
4. Accept a payment method and optional transfer or receipt reference.
5. Set `finalPaidAmount` to the verified amount, set `remainingDueAmount` to zero, and set `paymentStatus = FULLY_PAID`.
6. Record the verifier and timestamp.
7. Make the mutation idempotent. A second settlement attempt on an already fully paid order must return a safe “already settled” result or a clear validation error without duplicating a payment event.
8. Decide whether final payment is mandatory before physical handover. The recommended behavior is to make the settlement action the required “pickup clearance” step, while leaving the operational status as `READY_FOR_PICKUP` unless a separate `PICKED_UP` status is later introduced.

### Phase F: Expand the pickup-ready trigger

1. Retain the existing `COMPLETED` → `READY_FOR_PICKUP` transition.
2. Ensure the notification fires only when the status actually changes to `READY_FOR_PICKUP`.
3. Load the order’s persisted payment summary and payment-instructions snapshot.
4. Send a Telegram notification stating that the job is 100% complete and ready for pickup.
5. Include total amount, advance paid, remaining due, and final-payment instructions.
6. Include a clear instruction that the remaining balance can be paid at collection or transferred before pickup.
7. Continue sending internal staff notifications separately.
8. Add an idempotency marker or notification event so retries do not send duplicate pickup notifications.
9. Ensure missing Telegram contact information does not block the operational status transition. The order should still become ready for pickup, while the missing customer channel should be visible to staff.

## 6. Customer-facing payload design

### 6.1 Advance-payment payload

The quote-confirmation payload should contain one clearly delimited payment section. It should include the order reference, total, advance due, remaining balance, payment deadline if configured, and enabled bank channels.

The Telegram representation should use plain text plus Telegram-safe code formatting for account numbers and merchant IDs. It should avoid unsupported interactive controls unless the bot already has a callback-button framework for copying. The web and Mini App interfaces should use a real “Copy account number” button implemented through the browser clipboard API with a visible copied-state confirmation.

### 6.2 Pickup-ready payload

The pickup notification should contain:

| Content | Required value for the 600 ETB example |
|---|---:|
| Completion state | 100% complete and ready for pickup |
| Total order amount | 600 ETB |
| Advance paid | 300 ETB |
| Remaining balance | 300 ETB |
| Settlement instruction | Pay at pickup or transfer before collection |
| Bank payload | Enabled CBE, BOA, Telebirr, and CBE Birr details |
| Order reference | Order code such as `ORD-...` |
| Tracking link | Existing tracking URL when configured |

The wording should be localized consistently with the existing Amharic-first Telegram messages while preserving the numeric payment summary in an unambiguous format.

## 7. Frontend implementation plan

### Receptionist order queue

1. Update the quote modal to show the total, calculated 50% advance, and remaining 50% before saving.
2. Update the payment-confirmation modal to show the exact advance amount required and the amount being verified.
3. Add bank-payload display with copy buttons for every enabled account.
4. Add fields for payment method and optional transfer reference.
5. Prevent confirmation when the received amount is below the required advance.
6. Show a clear success state after the order becomes `PARTIALLY_PAID` and the job card is issued.
7. Add a settlement action on `READY_FOR_PICKUP` orders.
8. Show total, advance paid, remaining due, and final settlement method in the order row and detail drawer.
9. Disable the settlement action after `FULLY_PAID`.
10. Show a warning when an order has no customer Telegram channel and therefore cannot receive the automated message.

### Customer tracking and Mini App

1. Extend the public order summary with payment status and sanitized amount fields.
2. Display the total, advance paid, and remaining due for the customer’s own orders.
3. Display only the enabled payment instructions intended for customers.
4. Add account-number copy controls.
5. Show a prominent remaining-balance panel when the order is `READY_FOR_PICKUP` and not `FULLY_PAID`.
6. Show a paid confirmation when the order reaches `FULLY_PAID`.
7. Ensure customer data is scoped to the verified Telegram identity or public tracking lookup rules already enforced by the application.

## 8. Notification architecture and delivery reliability

The existing code already centralizes Telegram customer status messages in the order backend and schedules delivery through an internal Convex action. The implementation should extend that mechanism rather than creating separate notification logic inside each UI component.

The notification helper should receive a normalized payment summary and payment-instructions payload. It should render the advance message and pickup-ready message from that shared data. The helper should continue to distinguish internal staff notifications from customer notifications.

The repository has no SMS provider integration. The first implementation should therefore define a notification-channel interface and deliver Telegram only if the customer has a verified Telegram chat identifier. SMS can be added later by implementing a provider adapter and adding provider-specific credentials. No SMS delivery should be claimed until the provider, sender identity, opt-in behavior, error handling, and delivery costs are decided.

For every automated notification, the implementation should define retry behavior, duplicate suppression, and staff visibility when delivery fails. A status transition must never be rolled back solely because Telegram delivery fails.

## 9. Security and authorization requirements

| Operation | Required authorization |
|---|---|
| View or update bank details | Owner or the existing company-settings administrator policy, with the final role decision documented. |
| Commit final quote | Receptionist or any role already holding order-management permission. |
| Verify 50% advance | Receptionist or authorized order-management role. |
| Issue job card after advance verification | Existing order-management permission, subject to the 50% gate. |
| Mark order ready for pickup | Existing operator/receptionist lifecycle permissions. |
| Record final settlement | Receptionist or explicitly authorized cashier role. |
| Read customer payment summary | The customer’s verified Telegram session or an authorized internal staff query. |
| Read all bank configuration values | Owner-facing settings only. |

The backend must re-check all payment amounts, order status, role permissions, and payment-state invariants. UI restrictions are not security controls.

## 10. Migration and rollout plan

### Migration preparation

1. Inventory existing orders by operational status and current `paymentStatus`.
2. Identify all records with `amount` present but no payment metadata.
3. Identify all existing `PAID` records and classify whether they represent full payment or only production authorization.
4. Back up the production database before changing the payment-status validator.
5. Configure at least one valid bank channel in the Owner settings before enabling customer payment messages.

### Data migration

1. Add the new optional payment fields first so existing documents remain readable.
2. Add the new payment-status values while retaining legacy values temporarily for migration compatibility.
3. Migrate historical records according to the approved `PAID` interpretation.
4. Populate advance and remaining amounts only where the historical amount and payment meaning are reliable.
5. Keep legacy values readable until all old records have been migrated and verified.
6. Remove or deprecate legacy `PAID` handling only after the migration report confirms no active records depend on it.

### Deployment sequence

1. Deploy schema-compatible fields and read-path support.
2. Deploy Owner bank settings and validation.
3. Deploy quote calculation and advance-verification behavior.
4. Deploy final-settlement mutation and receptionist controls.
5. Deploy Telegram payload changes and idempotency handling.
6. Run end-to-end tests with a real Owner, receptionist, operator, and Telegram customer account.
7. Enable the workflow for live orders only after the test order is fully settled and the notification audit is correct.

## 11. Verification and test matrix

| Test area | Scenario | Expected result |
|---|---|---|
| Calculation | Total is 600 ETB. | Advance due is 300 ETB and remaining due is 300 ETB. |
| Calculation | Total is an odd amount such as 601 ETB. | The documented rounding rule is applied consistently and the two parts reconcile to the total. |
| Validation | Negative, zero, non-finite, or malformed amount. | Mutation rejects the input with no state change. |
| Quote commit | Reception enters a final total. | Order stores total, calculated advance, remaining balance, and bank snapshot. |
| Advance verification | Reception verifies exactly 50%. | Order becomes `PARTIALLY_PAID`; job-card issuance is allowed. |
| Advance underpayment | Reception verifies less than 50%. | Production release is rejected. |
| Credit path | Authorized credit is approved. | Existing credit policy remains explicit and does not silently become partial payment. |
| Production | Operator progresses the job. | Payment fields remain unchanged during production. |
| Pickup trigger | Order changes from `COMPLETED` to `READY_FOR_PICKUP`. | Exactly one customer pickup notification is scheduled. |
| Pickup content | Order total is 600 ETB and advance is 300 ETB. | Notification states remaining due is 300 ETB and includes bank details. |
| Duplicate pickup | Same status transition is retried. | No duplicate customer notification is sent. |
| Final settlement | Reception records the remaining 300 ETB. | Payment status becomes `FULLY_PAID`, remaining due becomes zero, and metadata is recorded. |
| Final underpayment | Reception records less than the remaining due. | Settlement is rejected. |
| Double settlement | Already fully paid order is settled again. | No duplicate payment or mutation side effect occurs. |
| Bank settings | Owner enables CBE and Telebirr only. | Only those two channels appear in new customer payloads. |
| Bank validation | Account number begins with zero. | Value is stored and rendered as a string without losing the leading zero. |
| Bank privacy | Public company-info query is called. | Bank account values are not exposed through the branding endpoint. |
| Copy controls | User copies an account number. | Clipboard receives the exact identifier and the UI shows confirmation. |
| Telegram absence | Order has no Telegram chat identifier. | Order lifecycle succeeds and staff see that customer notification was unavailable. |
| Telegram failure | Telegram action fails. | Order remains in the correct state, failure is logged, and retry behavior is available. |
| Authorization | Non-authorized role attempts settlement or bank updates. | Backend rejects the operation. |
| Regression | Existing order, inventory, job, and reconciliation tests run. | Existing behavior remains green except for intentionally updated payment assertions. |

## 12. Acceptance criteria

The feature is ready when a receptionist can quote a 600 ETB order, see a 300 ETB advance and 300 ETB remaining balance, verify the advance, and issue the job card without recording a false full-payment state. The customer must receive a Telegram payload containing the payment summary and configured bank details when a Telegram chat is available.

When the operator completes the job and the order changes to `READY_FOR_PICKUP`, the customer must receive one notification stating that the job is complete, identifying the remaining 300 ETB balance, and re-attaching the copyable bank details. The receptionist must be able to record the remaining balance and change the payment state to `FULLY_PAID` exactly once.

The Owner must be able to configure CBE, Bank of Abyssinia, Telebirr, and CBE Birr details without exposing those values through public company information. All payment transitions must be server-validated, auditable, role-protected, and covered by automated tests.

## 13. Decisions required before implementation

1. **Quote versus receipt timing:** Should entering the total merely calculate the 50% advance, or should the quote form also record that the advance was received? The recommended behavior is calculation at quote time and payment recording only after explicit verification.
2. **Legacy `PAID` meaning:** Do existing `PAID` records represent full settlement or only release to production? This determines the migration mapping.
3. **Pickup rule:** Must final payment be verified before physical handover, or may the order be collected with an outstanding balance? The recommended behavior is to require final settlement as the pickup-clearance action.
4. **SMS channel:** Which SMS provider, sender identity, customer opt-in policy, and credentials should be used? Telegram can be implemented using the existing integration, but SMS cannot be completed without these decisions.
5. **Bank configuration ownership:** Should bank details remain Owner-only, or should a separate finance role be allowed to manage them? Owner-only is the safest default.
6. **Payment account scope:** Should bank details be global company settings, branch-specific, or currency-specific? The current repository models one company workspace, so global company settings are the smallest compatible first release.

## References

[1]: https://github.com/yoh-space/yt-ads "YT Advertising Operations repository"
[2]: https://github.com/yoh-space/yt-ads/blob/de6713a/convex/orders.ts "Current order and payment lifecycle implementation"
[3]: https://github.com/yoh-space/yt-ads/blob/de6713a/convex/schema.ts "Current Convex schema"
[4]: https://github.com/yoh-space/yt-ads/blob/de6713a/convex/receptionist/orders.ts "Receptionist order mutations"
[5]: https://github.com/yoh-space/yt-ads/blob/de6713a/src/components/dashboard/roles/common/orders.tsx "Current order management UI"
[6]: https://github.com/yoh-space/yt-ads/blob/de6713a/src/components/dashboard/modals/order-create-modal.tsx "Current order intake modal"
[7]: https://github.com/yoh-space/yt-ads/blob/de6713a/src/app/api/telegram/route.ts "Current Telegram webhook entry point"
