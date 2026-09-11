# Plan: Remove Order Receipt Generation from YT Ads

## Status

Implementation completed. The dedicated receptionist receipt query and receipt-only print helper were removed; report printing and inventory receipt acknowledgement remain supported.

## Objective

Remove the generated customer/order receipt capability from the YT Ads project. The removal should cover the dedicated receptionist receipt payload/API and any print-specific support that exists solely for that feature, while leaving ordinary browser printing for reports and unrelated inventory receipt acknowledgement workflows intact.

The repository is currently clean on `main` at commit `c43a06e`. The scan found no active frontend call site for `api.receptionist.receipt.getReceiptData`; the dedicated backend module is currently `convex/receptionist/receipt.ts`. This suggests the feature is either unused or already detached from the visible receptionist UI, but the API and supporting references should still be removed deliberately.

## Scope

### Remove

1. **Dedicated receipt backend API**
   - Delete `convex/receptionist/receipt.ts`, including `getReceiptData`.
   - Remove the `receptionist/receipt` module entry from generated Convex API output by running the project’s Convex generation workflow rather than editing generated files manually.
   - Confirm no `api.receptionist.receipt.*` or `internal.receptionist.receipt.*` consumers remain.

2. **Receipt-only print support**
   - Inspect `src/lib/desktop.ts` and remove `printNative()` if it has no callers after the feature removal. Retain `isDesktopShell()` if it is used by other Tauri behavior.
   - Remove any receipt-specific print sheet, route, modal, hook, type, or component if discovered during implementation. The current scan found no active receipt UI call site, so this step is expected to be a no-op unless generated or ignored files reveal one.

3. **Receipt-specific configuration copy**
   - In `src/app/(dashboard)/dashboard/owner/settings/page.tsx`, remove or rewrite the company-logo helper text that says the logo is “Used on receipts and reports.” If reports still use the logo, change it to accurately say “Used on reports”; otherwise remove the unsupported usage claim.

4. **Documentation and specifications**
   - Update `docs/README.md` so the public-operations document no longer advertises “payment request receipts” if that wording refers to generated receipts. Replace it with the intended surviving behavior, such as payment confirmation/payment instructions, after checking the source document.
   - Review `docs/yt-advertisement-public-operations.md`, `docs/architecture.md`, `docs/workflows.md`, and `docs/rbac-security.md` for receipt-generation claims. Keep or strengthen the statement that the application does not generate invoices or receipts.
   - Do not remove references to inventory material receipt/acknowledgement; those describe a separate stock-transfer workflow and are not customer receipt generation.

### Preserve

- Payment amount, payment status, payment instructions, advance/final settlement, and Telegram payment-confirmation messaging.
- Customer-submitted payment proof or payment-request language, if it means a customer informs staff that payment was made rather than the system generating a receipt.
- `window.print()` / browser print actions used by owner/admin reports, unless a specific action is proven to be receipt-only.
- Inventory request receipt/acknowledgement behavior, including `materialRequests.ts`, storekeeper requisitions, and related tests.
- Company logo upload/storage if it remains used by reports or other supported features.
- All order, job-card, payment, and receptionist API paths unrelated to receipts.

## Implementation sequence

### 1. Establish a reference baseline

Before editing, record the current results of:

```bash
npm run check
npm test -- --run
rg -n -i 'getReceiptData|receptionist/receipt|receipt|printNative|window\.print' src convex docs README.md
```

Classify each match as one of:

| Category | Action |
|---|---|
| Generated customer/order receipt | Remove |
| Receipt-only print helper | Remove if unused |
| Report printing | Preserve |
| Inventory material receipt/acknowledgement | Preserve |
| Documentation statement that the app does not generate receipts | Preserve or clarify |

### 2. Remove the backend endpoint

Delete `convex/receptionist/receipt.ts`. Search the whole repository for imports and generated API references. If the project uses `npx convex codegen` or an equivalent configured command, run it to refresh `_generated` artifacts. Do not hand-edit generated files unless the repository’s documented workflow requires it.

If generated files cannot be refreshed without a configured Convex deployment, record that limitation and remove only source references, then use TypeScript checks to catch stale imports.

### 3. Remove dead frontend/desktop support

Use repository-wide call-site search for `printNative`. If there are no callers, remove the export and any now-unused Tauri import from `src/lib/desktop.ts`. If there is a receipt page or component not found in the initial scan, delete it and remove its imports/routes. Preserve report print buttons that call `window.print()` directly.

### 4. Correct copy and docs

Update the owner settings logo description and documentation links/content so the product no longer implies that it generates customer receipts. Ensure the public operations specification clearly distinguishes payment instructions/payment confirmation from a generated receipt.

### 5. Add regression coverage where useful

Because the removed feature is primarily an API/module deletion, the main regression protection is a structural audit rather than a new runtime test. Add a lightweight test only if the project already has an appropriate module/API inventory test. Otherwise, verify that:

- no source import references `receptionist/receipt`;
- no source code references `getReceiptData`;
- no generated API type exposes `receptionist/receipt` after codegen;
- no receipt-only print helper remains unused;
- inventory receipt acknowledgement tests still pass.

## Verification checklist

Run the following after implementation:

```bash
npm run check
npm test -- --run
rg -n -i 'getReceiptData|receptionist/receipt|api\.receptionist\.receipt|internal\.receptionist\.receipt' src convex docs README.md || true
rg -n -i 'receipt' src convex docs README.md
rg -n 'printNative|window\.print' src
```

Expected results:

- TypeScript check passes.
- Full test suite passes.
- No dedicated customer/order receipt API or call site remains.
- Any remaining `receipt` matches are limited to inventory receipt acknowledgement, historical/clarifying documentation, or other explicitly preserved workflows.
- Report print functionality remains available where intended.
- The working tree contains only the planned source and documentation changes.

## Risks and decisions

### Risk: payment proof is confused with generated receipts

The public-operations documentation mentions “payment request receipts,” while the architecture documentation says the application does not generate invoices or receipts. Before deleting any payment-related code, inspect the source wording and preserve payment confirmation/payment-instruction behavior. The removal should target generated order/receptionist receipt output, not payment state or customer-submitted evidence.

### Risk: generated Convex artifacts become stale

`convex/_generated/api.d.ts` currently includes `receptionist/receipt`. Regenerate it through the project workflow and verify that the module disappears. Never leave a source module deleted while generated API declarations still advertise it unless the limitation is explicitly documented.

### Risk: unrelated inventory terminology is removed accidentally

“Receipt” is also used for receiving issued stock into a storekeeper’s workflow. Those actions and tests are operationally distinct and must remain unchanged.

### Risk: report printing is accidentally broken

`window.print()` is used by report screens and should remain. Remove only the `printNative()` helper if repository-wide call-site analysis proves it is receipt-only and unused.

## Definition of done

The dedicated order/receptionist receipt feature is removed from source, generated API metadata, UI/support code, and documentation. The project compiles, all tests pass, report printing remains functional, inventory receipt acknowledgement remains functional, and a repository-wide audit shows no stale receipt-feature references.
