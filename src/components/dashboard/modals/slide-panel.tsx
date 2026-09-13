"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function SlidePanel({
  title,
  subtitle,
  open,
  onClose,
  footer,
  loading,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative h-full w-full max-w-lg bg-card border-l border-border shadow-custom flex flex-col overflow-hidden transform transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
          className,
        )}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground truncate">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary text-muted-foreground hover:bg-border hover:text-foreground transition-colors shrink-0 ml-3"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className={cn(
            "flex-1 overflow-y-auto p-5 space-y-4",
            "[scrollbar-width:thin] [scrollbar-color:hsl(var(--navy-2))_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-navy-2 [&::-webkit-scrollbar-thumb]:hover:bg-cyan [&::-webkit-scrollbar-track]:bg-transparent",
            bodyClassName,
          )}
        >
          {children}
        </div>

        {/* Sticky footer */}
        {footer && (
          <div className="flex-shrink-0 flex items-center justify-end gap-3 p-4 border-t border-border bg-card">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
