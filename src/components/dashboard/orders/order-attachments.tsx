"use client";

import { useState, type ChangeEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FileImage, ExternalLink, Paperclip, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_ATTACHMENT_FILE_SIZE = 8 * 1024 * 1024; // 8 MB, matched to the old UploadThing limit
const MAX_ATTACHMENT_COUNT = 4;

interface OrderAttachmentsProps {
  orderId: Id<"customerOrders">;
  readOnly?: boolean;
}

export function OrderAttachments({ orderId, readOnly = false }: OrderAttachmentsProps) {
  const attachments = useQuery(api.attachments.listOrderAttachments, { orderId });
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
  const recordAttachment = useMutation(api.attachments.recordOrderAttachment);
  const [uploading, setUploading] = useState(false);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (files.length > MAX_ATTACHMENT_COUNT) {
      toast.error(`You can upload at most ${MAX_ATTACHMENT_COUNT} files at once`);
      event.target.value = "";
      return;
    }
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds the 8 MB per-file limit`);
        event.target.value = "";
        return;
      }
    }

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
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary/15 p-4 text-xs text-muted-foreground transition-colors hover:bg-secondary/25">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Click to upload reference images"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={onFileChange}
          />
        </label>
      )}

      {attachments && attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {attachments.map((att) => (
            <div
              key={att._id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/70 bg-card hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid h-8 w-8 place-items-center rounded bg-primary/10 text-primary shrink-0">
                  <FileImage className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {att.fileName ?? "Reference Image"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : "Uploaded proof"}
                  </p>
                </div>
              </div>
              {att.fileUrl && (
                <a
                  href={att.fileUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  title="View original image"
                >
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