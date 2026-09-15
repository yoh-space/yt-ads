# Customer-Uploaded Document Naming Plan

**Status:** Implementation plan

**Repository:** `yoh-space/yt-ads`

**Objective:** Persist and display a canonical filename for customer-uploaded images and documents using the customer name, service type, and the exact customer-order dimensions in meters.

## 1. Final Naming Convention

The generated filename will follow this format:

```text
{CustomerName}-{ServiceType}-{orderWidth}mX{orderLength}m.{extension}
```

Example:

```text
Addis-Breweries-Banner-1.6mX2.5m.png
```

The dimensions will use the customer order’s original meter values directly. The implementation will not convert dimensions to centimeters, round them, or recalculate them from other fields.

The uppercase `X` separates width and length. The lowercase `m` identifies meters. The final extension remains the actual uploaded file extension.

Multiple periods are technically valid in filenames. If a customer order uses a decimal dimension such as `1.6`, the period is retained as part of the dimension value. The final extension is determined separately from the original uploaded filename or MIME type.

## 2. Current Architecture

The codebase already stores uploaded-file metadata alongside customer orders:

| Upload type | Current storage metadata |
|---|---|
| Primary uploaded artwork | `customerOrders.fileStorageId` and `customerOrders.fileName` |
| Additional customer attachments | `customerOrders.attachmentStorageIds` and `customerOrders.attachmentFileNames` |
| Separate attachment records | `orderAttachments.fileName` and related file metadata |

Receptionist and operator queries already return attachment names. Receptionist job details map `attachmentFileNames` to attachment URLs, and the operator overview exposes the same attachment names for machine work. This means the implementation should update persisted display metadata rather than rename Convex storage objects.

## 3. Architectural Decision

The generated filename will be the **server-authoritative display name**. The storage ID will remain unchanged.

Convex storage references are identified by storage IDs. Re-uploading or copying files solely to change the display filename would add unnecessary risk and could break existing references. The system should therefore:

1. Keep the original storage ID.
2. Generate the canonical filename on the backend.
3. Persist the canonical filename in the order metadata.
4. Return the persisted filename to receptionist and machine-operator views.
5. Use the canonical filename for downloads where the browser supports a suggested filename.

The frontend must not independently generate names because separate role interfaces could otherwise show different names.

## 4. Canonical Filename Helper

Create a shared backend utility, for example:

```text
convex/utils/orderFileName.ts
```

The helper should accept the order identity, dimensions, original filename or MIME type, and optional attachment index.

Recommended conceptual signature:

```ts
buildCustomerDocumentFileName({
  customerName,
  serviceType,
  width,
  length,
  originalFileName,
  mimeType,
  attachmentIndex,
}): string
```

The helper must:

- Trim customer and service values.
- Replace unsafe filename characters with hyphens.
- Collapse repeated hyphens.
- Remove leading and trailing separators.
- Preserve meaningful Unicode only if supported consistently by the application; otherwise use a documented ASCII-safe transliteration policy.
- Preserve the original file extension when available.
- Derive a safe extension from MIME type when the original extension is missing.
- Keep the dimension values in their order-stored meter representation.
- Add an attachment suffix only when multiple files require disambiguation.
- Enforce a maximum filename length while preserving the extension.

Example sanitization:

```text
Customer: Addis Breweries PLC
Service: Banner Printing
Width: 1.6
Length: 2.5
Original file: customer-artwork.PNG

Generated filename:
Addis-Breweries-PLC-Banner-Printing-1.6mX2.5m.PNG
```

## 5. Dimension Preservation Contract

The filename must use the direct customer-order dimensions in meters.

### 5.1 Numeric dimensions

If the database stores dimensions as numbers, the helper should format the numeric value without converting units. JavaScript number serialization may remove insignificant trailing zeroes. Therefore, `1.60` may appear as `1.6` unless the original input string is also preserved.

### 5.2 Exact visual formatting

If the business requires the filename to preserve exactly what the customer entered, including trailing zeroes such as `1.60mX2.50m`, add optional original dimension string fields to the order model:

```text
widthInput?: string
lengthInput?: string
```

The recommended first implementation is to use the existing numeric order dimensions directly, producing canonical output such as `1.6mX2.5m`. Exact trailing-zero preservation should be implemented only if the business confirms that it is required.

### 5.3 Missing dimensions

The helper must not invent dimensions. If a dimension is unavailable, use an explicit token:

```text
Customer-Service-unknownmXunknownm.png
```

If the order does not yet have a customer name, use the stable order code temporarily:

```text
ORD-20260915-001-Banner-unknownmXunknownm.png
```

Once the missing order data is available, the server should regenerate the display filename.

## 6. Backend Integration Points

### 6.1 Customer order creation

When a customer order is created with an uploaded primary file or attachment metadata, generate the canonical filename using the order’s customer name, service type, dimensions, and original extension before persisting the order.

The mutation must not trust a client-provided canonical filename. It may accept the original filename only as an extension source and for audit/debug metadata.

### 6.2 Attachment upload and attachment finalization

Update the attachment finalization path in `convex/attachments.ts` and the relevant order mutations in `convex/orders.ts` so that every persisted attachment receives a generated filename.

For additional attachments, preserve the relationship between storage IDs and filenames by writing both arrays at the same index:

```text
attachmentStorageIds[index] ↔ attachmentFileNames[index]
```

The implementation must reject or safely handle mismatched array lengths. It must never attach a filename to the wrong storage ID.

### 6.3 Order edits

When reception edits any of the following fields, regenerate names for associated uploaded documents:

- Customer name.
- Service type.
- Width.
- Length.

The storage IDs must not change. The filename metadata should change atomically with the order edit so receptionist and operator views cannot observe a partially updated name set.

### 6.4 Primary file and additional files

The primary file and additional attachments should use the same naming policy:

```text
Primary:
Customer-Service-1.6mX2.5m.png

Additional attachments:
Customer-Service-1.6mX2.5m-02.png
Customer-Service-1.6mX2.5m-03.pdf
```

The suffix should be deterministic and stable. The original upload order should determine the attachment index unless a future attachment identity field is introduced.

### 6.5 Separate `orderAttachments` records

If separate `orderAttachments` rows are actively used, their `fileName` must be generated using the same helper. The implementation must avoid having one attachment name in `customerOrders.attachmentFileNames` and a different name in `orderAttachments.fileName`.

During implementation, identify whether both representations are active runtime sources. If both are active, choose one authoritative representation and maintain the other as a synchronized projection until the older representation is retired.

## 7. Receptionist and Operator Display

Existing receptionist and operator queries should continue returning the persisted filename fields. Update UI components only where necessary to ensure the generated name is visible and used consistently.

Required display behavior:

- Show the canonical filename beside each image/document link.
- Use the canonical filename as the download suggestion where possible.
- Keep the original customer-uploaded filename out of primary operational display unless shown as secondary audit information.
- Display the same name for receptionists, operators, managers, and owners.
- Use the order code as an additional visible identifier when filenames are truncated for layout.

Relevant flows include:

- Receptionist job-card detail.
- Receptionist order detail.
- Shared order-detail drawer.
- Operator machine overview and job detail.
- Any production attachment panel used by machine operators.

## 8. Download Behavior

A displayed name and a downloaded name are separate concerns.

The server should return:

```text
{
  storageId,
  url,
  fileName
}
```

The UI should use the filename when creating a download link. If the browser or storage response does not honor the suggested name, the visible persisted name remains correct and the application can later add a controlled download endpoint.

Do not change storage IDs or delete/re-upload images merely to influence browser download naming.

## 9. Backfill and Migration

Create an idempotent backfill for existing orders and attachments:

1. Find orders with uploaded storage IDs and missing or legacy filenames.
2. Generate canonical names from the current order customer name, service type, width, and length.
3. Preserve the original extension when available.
4. Write the result to `fileName` or `attachmentFileNames`.
5. Preserve storage IDs.
6. Keep already canonical names unchanged unless an owner-approved regeneration is requested.
7. Log the number of updated records and records that lack dimensions or customer/service data.

For records with missing data, generate deterministic `unknown` tokens and report them for receptionist or owner review. Do not delete attachments or create replacement storage objects.

## 10. Validation and Security

The filename helper must be deterministic and safe.

Validation rules include:

- Reject path separators such as `/` and `\\`.
- Remove control characters.
- Prevent names such as `.` and `..`.
- Limit total length.
- Preserve only an approved extension set or derive the extension from MIME type.
- Do not include phone numbers, authentication tokens, storage IDs, or private notes.
- Do not place untrusted HTML in displayed filenames.
- Escape filenames through normal React rendering and download-link handling.

The generated filename is metadata, not an authorization mechanism. Existing order and attachment access controls must remain unchanged.

## 11. Testing Plan

### Utility tests

Test:

- Standard customer, service, and meter dimensions.
- Decimal meter dimensions such as `1.6` and `2.5`.
- Whole meter dimensions such as `2m` and `5m`.
- Missing width or length.
- Missing customer name.
- Unsafe characters in customer and service names.
- Multiple attachments and deterministic numbering.
- Uppercase, lowercase, and missing extensions.
- MIME-type extension fallback.
- Maximum filename length.
- Preservation of storage IDs outside the helper.

### Backend tests

Test:

- Order creation persists the generated primary filename.
- Additional attachment names align with storage IDs.
- Order edits regenerate names without changing storage IDs.
- Re-running the backfill is idempotent.
- Existing canonical names are not unexpectedly changed.
- Missing order data produces explicit `unknown` tokens.
- Separate `orderAttachments` records remain synchronized if they are active.

### UI tests

Test:

- Receptionist sees the generated filename.
- Operator sees the same generated filename.
- Download links use the generated filename where supported.
- Long filenames remain readable and accessible.
- Original upload names are not used as the primary operational label.

## 12. Implementation Sequence

### Phase 1: Utility and contract

Implement the canonical filename helper, define the meter-dimension contract, and add utility tests.

### Phase 2: Order and upload integration

Generate names during order creation, attachment finalization, and order edits. Keep storage IDs unchanged.

### Phase 3: Role display integration

Verify and update receptionist, shared order, and operator display flows so every role reads the persisted canonical name.

### Phase 4: Backfill

Run the idempotent filename backfill for existing uploaded documents and report incomplete records.

### Phase 5: Download and regression verification

Apply canonical names to download suggestions, run tests, run TypeScript validation, and perform a manual receptionist/operator walkthrough.

## 13. Acceptance Criteria

The implementation is complete when:

1. A new customer image is displayed as `Customer-Service-1.6mX2.5m.png` or the equivalent using the order’s direct meter values.
2. No centimeter conversion or dimension rounding occurs.
3. Receptionists and machine operators see the same persisted filename.
4. Additional attachments receive deterministic suffixes without breaking storage-ID alignment.
5. Editing customer name, service type, width, or length regenerates filenames without changing storage IDs.
6. Existing files are backfilled without re-uploading or deleting storage objects.
7. Missing dimensions use explicit `unknownm` tokens rather than invented values.
8. Unsafe filename characters are sanitized.
9. The original upload filename is not the primary operational display name.
10. Download links use the canonical name where supported.
11. Existing attachment authorization remains unchanged.
12. Utility, backend, UI, and migration tests pass, together with `pnpm check`.

## 14. References

[1]: ../../convex/schema.ts "Customer order and attachment metadata schema"

[2]: ../../convex/orders.ts "Customer order creation, update, and attachment metadata mutations"

[3]: ../../convex/attachments.ts "Customer attachment persistence logic"

[4]: ../../convex/receptionist/jobs.ts "Receptionist job attachment query and display metadata"

[5]: ../../convex/operator/overview.ts "Operator job overview attachment query and display metadata"

[6]: ../../src/components/dashboard/roles/receptionist/job-cards.tsx "Receptionist attachment display component"

[7]: ../../src/components/dashboard/roles/common/order-detail-drawer.tsx "Shared order detail attachment display"
