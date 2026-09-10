import { z } from "zod";
import { normalizePhone } from "./phone-normalization";
import { SERVICE_IDS, type ServiceId } from "./services";
import { serviceSpecificationFields } from "./service-specifications";

export const EthiopianMobileSchema = z
  .string()
  .refine((value) => normalizePhone(value) !== null, {
    message: "Enter a valid Ethiopian mobile number (09... or +2519...)",
  })
  .transform((value) => normalizePhone(value) ?? value);

export const AccountTypeSchema = z.union([
  z.literal("individual"),
  z.literal("corporate"),
  z.literal("government"),
]);

export const TIN_SCHEMA = z
  .string()
  .trim()
  .refine((value) => /^\d{10}$/.test(value), { message: "TIN must contain exactly 10 digits." });

export const CompanyLegalNameSchema = z
  .string()
  .trim()
  .min(2, "Company/legal name must be at least 2 characters.")
  .max(160, "Company/legal name is too long.");

export const BusinessIdentitySchema = z
  .object({
    accountType: AccountTypeSchema,
    companyLegalName: z.optional(CompanyLegalNameSchema),
    tinNumber: z.optional(TIN_SCHEMA),
  })
  .refine(
    (data) => {
      if (data.accountType === "individual") return true;
      if (data.accountType === "corporate" || data.accountType === "government") {
        return !!data.companyLegalName && !!data.tinNumber;
      }
      return false;
    },
    { message: "Corporate and Government accounts require company/legal name and TIN number." },
  );

export type BusinessIdentityInput = z.infer<typeof BusinessIdentitySchema>;

export const CustomerProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required.")
    .max(160, "Name is too long."),
  phone: EthiopianMobileSchema,
});

export type CustomerProfileInput = z.infer<typeof CustomerProfileSchema>;

export const ServiceSelectionSchema = z.object({
  serviceId: z.enum(SERVICE_IDS as unknown as [ServiceId, ...ServiceId[]]),
});

export type ServiceSelectionInput = z.infer<typeof ServiceSelectionSchema>;

/**
 * Loose client-side shape guard for specification key/values. The authoritative
 * server-side validator is `buildServiceSpecificationsSchema(serviceId)` (per
 * service, `z.enum` against the canonical catalog) and
 * `validateServiceSpecifications` in `service-specifications.ts`. This loose
 * shape exists only to give the wizard friendly per-key empty-value errors.
 */
export const SpecificationsSchema = z.record(z.string(), z.string()).superRefine((data, ctx) => {
  const entries = Object.entries(data);
  for (const [key, value] of entries) {
    if (typeof value !== "string" || value.trim() === "") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Specification ${key} must have a non-empty value.`, path: [key] });
    }
  }
});

export type SpecificationsInput = Record<string, string>;

export const DimensionsSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^([0-9]+(?:\.[0-9]+)?)\s*m?\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)\s*m?$/i.test(value),
    { message: "Dimensions must be in the format WIDTH x HEIGHT (e.g. 2m x 3m)." },
  )
  .refine(
    (value) => {
      const match = value.match(/^([0-9]+(?:\.[0-9]+)?)\s*m?\s*[x×]\s*([0-9]+(?:\.[0-9]+)?)\s*m?$/i);
      if (!match) return false;
      const width = Number(match[1]);
      const height = Number(match[2]);
      return width > 0 && height > 0;
    },
    { message: "Dimensions must be positive values." },
  );

export const QuantitySchema = z
  .string()
  .trim()
  .refine((value) => /^[1-9]\d*$/.test(value) && Number(value) <= 100000, {
    message: "Quantity must be a positive whole number.",
  });

export const DimensionsAndQuantitySchema = z.object({
  dimensions: DimensionsSchema,
  quantity: QuantitySchema,
});

export type DimensionsAndQuantityInput = z.infer<typeof DimensionsAndQuantitySchema>;

export function buildServiceSpecificationsSchema(serviceId: string) {
  const fields = serviceSpecificationFields(serviceId);
  if (fields.length === 0) {
    return z.record(z.string(), z.string()).optional();
  }
  const shape: Record<string, z.ZodType<string>> = {};
  for (const field of fields) {
    if (field.options.length === 0) {
      throw new Error(`Specification "${field.label}" has no catalog options.`);
    }
    shape[field.key] = z.enum(field.options as unknown as [string, ...string[]]);
  }
  return z.object(shape).strict().refine(
    (data) => Object.keys(data).every((key) => fields.some((field) => field.key === key)),
    { message: `Unknown specification field. Valid fields are: ${fields.map((f) => f.key).join(", ")}` },
  );
}

export const CompleteOrderPayloadSchema = z
  .object({
    customerName: z
      .string()
      .trim()
      .min(1, "Customer name is required.")
      .max(160, "Name is too long."),
    phone: EthiopianMobileSchema,
    accountType: AccountTypeSchema,
    companyLegalName: z.optional(CompanyLegalNameSchema),
    tinNumber: z.optional(TIN_SCHEMA),
    serviceId: z.enum(SERVICE_IDS as unknown as [ServiceId, ...ServiceId[]]),
    specifications: SpecificationsSchema.optional(),
    dimensions: DimensionsSchema,
    quantity: QuantitySchema,
    length: z.optional(z.number().positive()),
    width: z.optional(z.number().positive()),
    notes: z.optional(z.string().trim().max(2000, "Notes are too long.")),
    fileStorageId: z.optional(z.string()),
    fileName: z.optional(z.string().trim()),
    preferredDueDate: z.number().int().refine((value) => value >= Date.now() - 60_000, "Due date must be in the future."),
  })
  .superRefine((data, ctx) => {
    if (data.accountType === "corporate" || data.accountType === "government") {
      if (!data.companyLegalName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Company/legal name is required for Corporate and Government accounts.",
          path: ["companyLegalName"],
        });
      }
      if (!data.tinNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "TIN number is required for Corporate and Government accounts.",
          path: ["tinNumber"],
        });
      }
    }
  });

export type CompleteOrderPayloadInput = z.infer<typeof CompleteOrderPayloadSchema>;

export const CustomerEditPayloadSchema = z
  .object({
    customerName: z.optional(z.string().trim().min(1, "Customer name is required.").max(160)),
    phone: z.optional(EthiopianMobileSchema),
    accountType: z.optional(AccountTypeSchema),
    companyLegalName: z.optional(CompanyLegalNameSchema),
    tinNumber: z.optional(TIN_SCHEMA),
    serviceId: z.optional(z.enum(SERVICE_IDS as unknown as [ServiceId, ...ServiceId[]])),
    specifications: z.optional(SpecificationsSchema),
    dimensions: z.optional(DimensionsSchema),
    quantity: z.optional(QuantitySchema),
    length: z.optional(z.number().positive()),
    width: z.optional(z.number().positive()),
    notes: z.optional(z.string().trim().max(2000)),
    fileStorageId: z.optional(z.string()),
    fileName: z.optional(z.string().trim()),
    editRevision: z.number().int().positive(),
  })
  .strict();

export type CustomerEditPayloadInput = z.infer<typeof CustomerEditPayloadSchema>;
