import { describe, expect, it } from "vitest";
import {
  buildCustomerDocumentFileName,
  formatOrderDimension,
  resolveFileExtension,
  sanitizeFileNameSegment,
} from "../utils/orderFileName";

describe("Customer Document File Naming Helper", () => {
  it("formats canonical customer filename with standard meter dimensions", () => {
    const filename = buildCustomerDocumentFileName({
      customerName: "Addis Breweries PLC",
      serviceType: "Banner Printing",
      width: 1.6,
      length: 2.5,
      originalFileName: "customer-artwork.PNG",
    });

    expect(filename).toBe("Addis-Breweries-PLC-Banner-Printing-1.6mX2.5m.PNG");
  });

  it("preserves exact decimal representation and whole meter values directly without rounding", () => {
    const dec = buildCustomerDocumentFileName({
      customerName: "Awash Wine",
      serviceType: "Vinyl Sticker",
      width: "1.60",
      length: "3.25",
      originalFileName: "label.jpg",
    });
    expect(dec).toBe("Awash-Wine-Vinyl-Sticker-1.60mX3.25m.jpg");

    const whole = buildCustomerDocumentFileName({
      customerName: "Bole Medhanialem",
      serviceType: "Mesh Banner",
      width: 3,
      length: 10,
      originalFileName: "billboard.pdf",
    });
    expect(whole).toBe("Bole-Medhanialem-Mesh-Banner-3mX10m.pdf");
  });

  it("handles missing or invalid dimensions with explicit unknown tokens", () => {
    const missingBoth = buildCustomerDocumentFileName({
      customerName: "Client XYZ",
      serviceType: "Poster",
      originalFileName: "photo.png",
    });
    expect(missingBoth).toBe("Client-XYZ-Poster-unknownmXunknownm.png");

    const partial = buildCustomerDocumentFileName({
      customerName: "Client XYZ",
      serviceType: "Poster",
      width: 1.2,
      length: undefined,
      originalFileName: "photo.png",
    });
    expect(partial).toBe("Client-XYZ-Poster-1.2mXunknownm.png");
  });

  it("falls back to orderCode when customerName is missing", () => {
    const name = buildCustomerDocumentFileName({
      customerName: "",
      orderCode: "ORD-20260915-001",
      serviceType: "Banner",
      width: 2,
      length: 3,
      originalFileName: "test.pdf",
    });
    expect(name).toBe("ORD-20260915-001-Banner-2mX3m.pdf");
  });

  it("handles multiple attachments with deterministic index suffix for index > 1", () => {
    const primary = buildCustomerDocumentFileName({
      customerName: "Addis Beer",
      serviceType: "Sticker",
      width: 1,
      length: 1,
      originalFileName: "artwork.png",
      attachmentIndex: 1,
    });
    expect(primary).toBe("Addis-Beer-Sticker-1mX1m.png");

    const second = buildCustomerDocumentFileName({
      customerName: "Addis Beer",
      serviceType: "Sticker",
      width: 1,
      length: 1,
      originalFileName: "specs.pdf",
      attachmentIndex: 2,
    });
    expect(second).toBe("Addis-Beer-Sticker-1mX1m-02.pdf");

    const third = buildCustomerDocumentFileName({
      customerName: "Addis Beer",
      serviceType: "Sticker",
      width: 1,
      length: 1,
      originalFileName: "mockup.tif",
      attachmentIndex: 3,
    });
    expect(third).toBe("Addis-Beer-Sticker-1mX1m-03.tif");
  });

  it("derives file extension from mime type when original file extension is missing", () => {
    const fromMime = buildCustomerDocumentFileName({
      customerName: "Test Customer",
      serviceType: "Signage",
      width: 0.8,
      length: 1.5,
      originalFileName: "blob",
      mimeType: "image/webp",
    });
    expect(fromMime).toBe("Test-Customer-Signage-0.8mX1.5m.webp");

    const pdfMime = buildCustomerDocumentFileName({
      customerName: "Test Customer",
      serviceType: "Signage",
      width: 0.8,
      length: 1.5,
      originalFileName: "",
      mimeType: "application/pdf",
    });
    expect(pdfMime).toBe("Test-Customer-Signage-0.8mX1.5m.pdf");
  });

  it("sanitizes unsafe characters from customer name and service type", () => {
    const sanitized = buildCustomerDocumentFileName({
      customerName: "Addis / Breweries: & Co. <LTD>???",
      serviceType: "Outdoor // Banner **",
      width: 2,
      length: 4,
      originalFileName: "art.png",
    });
    expect(sanitized).toBe("Addis-Breweries-Co-LTD-Outdoor-Banner-2mX4m.png");
  });

  it("enforces max length while preserving extension and dimensions", () => {
    const longName = "A".repeat(250);
    const result = buildCustomerDocumentFileName({
      customerName: longName,
      serviceType: "Extremely-Long-Service-Name-That-Goes-On-And-On",
      width: 5,
      length: 10,
      originalFileName: "final-print.tiff",
    });
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith("-5mX10m.tiff")).toBe(true);
  });
});
