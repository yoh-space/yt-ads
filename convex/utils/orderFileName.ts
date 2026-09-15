/**
 * Canonical customer document and uploaded artwork naming helper.
 * Enforces convention: {CustomerName}-{ServiceType}-{orderWidth}mX{orderLength}m.{extension}
 * Additional attachments: {CustomerName}-{ServiceType}-{orderWidth}mX{orderLength}m-{02}.{extension}
 */

export interface BuildCustomerDocumentFileNameOptions {
  customerName?: string | null;
  serviceType?: string | null;
  width?: number | string | null;
  length?: number | string | null;
  originalFileName?: string | null;
  mimeType?: string | null;
  attachmentIndex?: number | null;
  orderCode?: string | null;
}

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/tiff": "tif",
  "image/tif": "tif",
  "application/pdf": "pdf",
  "application/illustrator": "ai",
  "application/postscript": "ai",
  "image/vnd.adobe.photoshop": "psd",
  "application/x-photoshop": "psd",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
};

/**
 * Sanitizes a string segment for safe use in a cross-platform filename.
 * Replaces whitespace, slashes, and special characters with hyphens.
 * Collapses duplicate hyphens and trims leading/trailing hyphens.
 */
export function sanitizeFileNameSegment(segment: string): string {
  return segment
    .trim()
    .replace(/[\/\\:*?"<>|#%&{}\\<>*?/$!'":@+`|=.,;()\[\]]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Formats a dimension value directly in meters without rounding or unit conversion.
 * If missing, non-positive, or invalid, returns "unknown".
 */
export function formatOrderDimension(value?: number | string | null): string {
  if (value === undefined || value === null) {
    return "unknown";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return "unknown";
    return String(value);
  }
  const trimmed = value.trim();
  if (!trimmed) return "unknown";
  const num = Number(trimmed);
  if (Number.isFinite(num) && num > 0) {
    return trimmed;
  }
  return "unknown";
}

/**
 * Resolves the file extension from the original filename or mime type.
 */
export function resolveFileExtension(
  originalFileName?: string | null,
  mimeType?: string | null
): string {
  if (originalFileName) {
    const trimmed = originalFileName.trim();
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot > 0 && lastDot < trimmed.length - 1) {
      const ext = trimmed.slice(lastDot + 1).replace(/[^a-zA-Z0-9]/g, "");
      if (ext.length > 0 && ext.length <= 10) {
        return ext;
      }
    }
  }

  if (mimeType) {
    const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();
    if (MIME_EXTENSION_MAP[normalizedMime]) {
      return MIME_EXTENSION_MAP[normalizedMime];
    }
  }

  return "bin";
}

/**
 * Builds the canonical filename for a customer-uploaded document or artwork.
 */
export function buildCustomerDocumentFileName(
  options: BuildCustomerDocumentFileNameOptions
): string {
  const {
    customerName,
    serviceType,
    width,
    length,
    originalFileName,
    mimeType,
    attachmentIndex,
    orderCode,
  } = options;

  // 1. Resolve Customer Name
  let safeCustomer = customerName ? sanitizeFileNameSegment(customerName) : "";
  if (!safeCustomer) {
    safeCustomer = orderCode ? sanitizeFileNameSegment(orderCode) : "Customer";
  }

  // 2. Resolve Service Type
  let safeService = serviceType ? sanitizeFileNameSegment(serviceType) : "";
  if (!safeService) {
    safeService = "Order";
  }

  // 3. Resolve Dimensions (Width x Length)
  const widthStr = formatOrderDimension(width);
  const lengthStr = formatOrderDimension(length);
  const dimensionStr = `${widthStr}mX${lengthStr}m`;

  // 4. Resolve Attachment Index Disambiguation Suffix
  let suffix = "";
  if (typeof attachmentIndex === "number" && attachmentIndex > 1) {
    suffix = `-${String(attachmentIndex).padStart(2, "0")}`;
  }

  // 5. Resolve Extension
  const extension = resolveFileExtension(originalFileName, mimeType);

  // 6. Assemble base and enforce max length limit (200 characters max)
  const tail = `-${dimensionStr}${suffix}.${extension}`;
  const maxBaseLength = Math.max(20, 200 - tail.length);

  let base = `${safeCustomer}-${safeService}`;
  if (base.length > maxBaseLength) {
    base = base.slice(0, maxBaseLength).replace(/-+$/, "");
  }

  return `${base}${tail}`;
}
