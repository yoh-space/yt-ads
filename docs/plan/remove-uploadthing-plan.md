# Implementation Plan: Remove UploadThing, consolidate on Convex file storage

## Context (what the codebase actually shows)

Two file-storage paths currently coexist:

| Path | Used by | Storage |
|---|---|---|
| **Convex native storage** | Main order artwork upload (`order-create-modal.tsx`), Telegram bot (`src/telegram/bot.ts`), `orders.ts` (`fileStorageId`, `attachmentStorageIds`) | `ctx.storage` |
| **UploadThing** | Secondary `OrderAttachments` component only (`orderAttachments` table) | UploadThing's cloud |

So this is **not** a full-system migration — Convex storage is already the primary, working path. The scope is: rebuild the one component still on UploadThing (`OrderAttachments`), then delete UploadThing entirely.

---

## Step 1 — Schema: align `orderAttachments` with the Convex-storage shape

`convex/schema.ts` — current `orderAttachments` table stores UploadThing's `fileUrl` + `fileKey` (a remote key). Convex storage instead needs a `storageId: v.id("_storage")`, and URLs are resolved on read via `ctx.storage.getUrl()`, not stored as a permanent string.

```ts
orderAttachments: defineTable({
  orderId: v.id("customerOrders"),
  storageId: v.id("_storage"),        // NEW — replaces fileKey/fileUrl
  fileName: v.optional(v.string()),
  fileSize: v.optional(v.number()),
  mimeType: v.optional(v.string()),
  uploadedAt: v.number(),
  uploadedBy: v.optional(v.string()),
}).index("by_order", ["orderId"]),
```

Keep `fileUrl`/`fileKey` as optional deprecated fields rather than deleting them outright if there's existing production data — see Step 5 (data migration) before dropping them for real.

---

## Step 2 — Backend: `convex/attachments.ts`

Replace the UploadThing-shaped `recordOrderAttachment` with one that takes a `storageId` (mirrors the existing pattern in `orders.ts`'s own upload flow), and add a query that resolves URLs at read time (URLs from `ctx.storage.getUrl()` are not permanent, so never store them).

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { buildCustomerDocumentFileName } from "./utils/orderFileName";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const recordOrderAttachment = mutation({
  args: {
    orderId: v.id("customerOrders"),
    storageId: v.id("_storage"),
    fileName: v.optional(v.string()),
    fileSize: v.optional(v.number()),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Target customer order not found.");

    const identity = await authComponent.safeGetAuthUser(ctx);
    const existingAttachments = await ctx.db
      .query("orderAttachments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    const attachmentIndex = (order.fileStorageId ? 1 : 0) + existingAttachments.length + 1;

    const canonicalFileName = buildCustomerDocumentFileName({
      customerName: order.clientName,
      serviceType: order.serviceType,
      width: order.width,
      length: order.length,
      orderCode: order.code,
      originalFileName: args.fileName,
      mimeType: args.mimeType,
      attachmentIndex,
    });

    return await ctx.db.insert("orderAttachments", {
      orderId: args.orderId,
      storageId: args.storageId,
      fileName: canonicalFileName,
      fileSize: args.fileSize,
      mimeType: args.mimeType,
      uploadedAt: Date.now(),
      uploadedBy: identity?._id,
    });
  },
});

export const listOrderAttachments = query({
  args: { orderId: v.id("customerOrders") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("orderAttachments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    // Resolve a fresh signed URL per read — Convex storage URLs aren't
    // permanent, matching how orders.ts already resolves fileStorageId.
    return await Promise.all(
      rows.map(async (row) => ({
        ...row,
        fileUrl: await ctx.storage.getUrl(row.storageId),
      })),
    );
  },
});

/** Mirrors orders.ts's delete-on-order-removal cleanup for attachment storage objects. */
export const deleteOrderAttachment = mutation({
  args: { attachmentId: v.id("orderAttachments") },
  handler: async (ctx, args) => {
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) return;
    await ctx.storage.delete(attachment.storageId);
    await ctx.db.delete(args.attachmentId);
  },
});
```

(`generateUploadUrl` already exists in `orders.ts` — reuse that one instead of duplicating if it's exported and importable; otherwise this local copy is fine since it's a one-line wrapper.)

---

## Step 3 — Frontend: rewrite `OrderAttachments` to Convex's two-step upload

`src/components/dashboard/orders/order-attachments.tsx` — replace `UploadDropzone` with the same fetch-generateUploadUrl-then-POST pattern already used in `order-create-modal.tsx`:

```tsx
"use client";

import { useState, type ChangeEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FileImage, ExternalLink, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OrderAttachmentsProps {
  orderId: Id<"customerOrders">;
  readOnly?: boolean;
}

export function OrderAttachments({ orderId, readOnly = false }: OrderAttachmentsProps) {
  const attachments = useQuery(api.attachments.listOrderAttachments, { orderId });
  const generateUploadUrl = useMutation(api.attachments.generateUploadUrl);
  const recordAttachment = useMutation(api.attachments.recordOrderAttachment);
  const [uploading, setUploading] = useState(false);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!response.ok) throw new Error("Upload failed.");
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        await recordAttachment({
          orderId,
          storageId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });
      }
      toast.success(`Successfully uploaded ${files.length} attachment(s)`);
    } catch {
      toast.error("Failed to upload attachment");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Order Attachments & Reference Files</h3>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {attachments?.length ?? 0} {attachments?.length === 1 ? "file" : "files"}
        </span>
      </div>

      {!readOnly && (
        <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/15 p-4 text-xs text-muted-foreground cursor-pointer hover:bg-secondary/25 transition-colors">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Click to upload reference images"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={onFileChange} />
        </label>
      )}

      {attachments && attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {attachments.map((att) => (
            <div key={att._id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-8 w-8 place-items-center rounded bg-primary/10 text-primary shrink-0">
                  <FileImage className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{att.fileName ?? "Reference Image"}</p>
                  <p className="text-[10px] text-muted-foreground">{att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : "Uploaded proof"}</p>
                </div>
              </div>
              {att.fileUrl && (
                <a href={att.fileUrl} target="_blank" rel="noreferrer noopener" className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0" title="View original image">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Enforce the old 8MB/4-file limits client-side in `onFileChange` if that constraint still matters (UploadThing's `core.ts` had `maxFileSize: "8MB", maxFileCount: 4` — port those checks here since Convex storage doesn't enforce them for you).

---

## Step 4 — Delete UploadThing entirely

Once Step 3 is confirmed working:

```
rm -rf src/app/api/uploadthing
rm src/lib/uploadthing.ts
```

`package.json` — remove:
```json
"@uploadthing/react": "^7.3.3",
"uploadthing": "^7.7.4",
```
then `pnpm install` to update the lockfile.

Search for any remaining `.env`/`.env.example` entries (`UPLOADTHING_TOKEN`, `UPLOADTHING_SECRET`, etc.) and remove them — check `.env.example` specifically since it's checked into the repo.

---

## Step 5 — Data migration (only if there's existing production data)

If any `orderAttachments` rows already exist with UploadThing `fileUrl`/`fileKey` before this ships, those files live on UploadThing's servers, not Convex — they will NOT be reachable by the new `storageId`-based reader. Two options, in order of preference given your timeline:

1. **If there's little/no real attachment data yet** (likely, given the project's age) — skip migration, just accept old rows become unreadable, or write a one-off Convex mutation to soft-delete pre-migration `orderAttachments` rows.
2. **If real customer attachments exist and must be preserved** — write a one-time migration script (pattern-match `convex/migrations.ts`, which already exists in this codebase) that fetches each UploadThing file by its old `fileUrl`, re-uploads it to Convex storage via `ctx.storage.store()`, and patches the row with the new `storageId`. This needs to run once, from a Node script with network access (not from within a Convex mutation, since mutations can't make outbound fetches) — a `scripts/` entry, matching the existing `scripts/` directory pattern in this repo.

Ask the owner directly whether any customer has uploaded a reference image through this specific component yet before deciding which path — given your timeline, option 1 is far cheaper if the answer is "basically none."

---

## Step 6 — Verify

1. Create an order, open it, upload a reference image through the rebuilt `OrderAttachments` — confirm it appears and the link opens the image.
2. Confirm `pnpm build` succeeds with UploadThing removed (no dangling imports).
3. Run `pnpm check` (TypeScript) to catch any other file that imported `@/lib/uploadthing` or the UploadThing types that this search didn't surface.
4. Grep one more time after deletion to confirm nothing's left: `grep -ri uploadthing -r src convex package.json`.
