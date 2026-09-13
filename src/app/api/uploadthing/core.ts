import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

/**
 * UploadThing file router for customer orders and production attachments.
 * Constrained to image MIME types up to 8MB per file, max 4 files per batch.
 */
export const ourFileRouter = {
  orderAttachment: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 4,
    },
  })
    .middleware(async () => {
      // In production, user or telegram customer context can be verified here
      return { uploadedAt: Date.now() };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedAt: metadata.uploadedAt,
        fileUrl: file.ufsUrl ?? file.url,
        fileKey: file.key,
        fileName: file.name,
        fileSize: file.size,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
