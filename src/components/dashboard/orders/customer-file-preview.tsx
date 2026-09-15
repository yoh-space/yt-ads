"use client";

import { Download, FileImage, FileText, Image as ImageIcon } from "lucide-react";

type CustomerFilePreviewProps = {
  url?: string | null;
  fileName?: string | null;
  label?: string;
  compact?: boolean;
};

const IMAGE_EXTENSION = /\.(?:avif|bmp|gif|jpe?g|png|svg|tif?f|webp)$/i;

export function isImageFileName(fileName?: string | null): boolean {
  return Boolean(fileName && IMAGE_EXTENSION.test(fileName));
}

export function CustomerFilePreview({ url, fileName, label = "Customer uploaded file", compact = false }: CustomerFilePreviewProps) {
  if (!url) return null;

  const image = isImageFileName(fileName);
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {image ? <ImageIcon size={14} className="shrink-0 text-primary" /> : <FileText size={14} className="shrink-0 text-primary" />}
          <span className="truncate text-xs font-semibold text-foreground">{label}</span>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/30 hover:text-foreground"
        >
          <Download size={12} />
          Open original
        </a>
      </div>
      {image ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className="group block overflow-hidden rounded-lg border border-border/70 bg-background/40">
          <img
            src={url}
            alt={fileName ?? label}
            loading="lazy"
            className={compact ? "max-h-40 w-full object-contain transition-transform group-hover:scale-[1.01]" : "max-h-72 w-full object-contain transition-transform group-hover:scale-[1.01]"}
          />
        </a>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 p-3 text-[11px] text-muted-foreground">
          <FileImage size={14} className="text-primary" />
          <span className="truncate">{fileName ?? "Customer file"}</span>
        </div>
      )}
    </div>
  );
}
