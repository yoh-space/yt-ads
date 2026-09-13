"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { UploadDropzone } from "@/lib/uploadthing";
import { FileImage, ExternalLink, Paperclip } from "lucide-react";
import { toast } from "sonner";

interface OrderAttachmentsProps {
  orderId: Id<"customerOrders">;
  readOnly?: boolean;
}

export function OrderAttachments({ orderId, readOnly = false }: OrderAttachmentsProps) {
  const attachments = useQuery(api.attachments.listOrderAttachments, { orderId });
  const recordAttachment = useMutation(api.attachments.recordOrderAttachment);

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
        <div className="rounded-lg border border-dashed border-border bg-secondary/15 p-2">
          <UploadDropzone
            endpoint="orderAttachment"
            onClientUploadComplete={async (res) => {
              if (!res || res.length === 0) return;
              try {
                for (const file of res) {
                  await recordAttachment({
                    orderId,
                    fileUrl: file.ufsUrl ?? file.url,
                    fileKey: file.key,
                    fileName: file.name,
                    fileSize: file.size,
                  });
                }
                toast.success(`Successfully uploaded ${res.length} attachment(s)`);
              } catch {
                toast.error("Failed to save attachment records in database");
              }
            }}
            onUploadError={(error: Error) => {
              toast.error(`Upload error: ${error.message}`);
            }}
            className="ut-button:bg-primary ut-button:ut-readying:bg-primary/50 ut-label:text-foreground text-xs py-4"
          />
        </div>
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
              <a
                href={att.fileUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="grid h-7 w-7 place-items-center rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                title="View original image"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
