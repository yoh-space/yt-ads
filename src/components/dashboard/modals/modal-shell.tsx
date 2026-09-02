"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

export function ModalShell({
  title,
  subtitle,
  step,
  kicker,
  children,
  footer,
  onClose,
}: {
  title: string;
  subtitle: string;
  step?: number;
  kicker?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-lg max-h-[85vh] flex-col overflow-hidden rounded-xl bg-white shadow-2xl border border-gray-100">
        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-start justify-between p-6 border-b border-gray-100">
          <div className="flex-1">
            <span className="block text-[10px] font-bold tracking-wider text-cyan-dark mb-1">
              {kicker ? kicker : step ? `STEP ${step} OF 3` : "OPERATIONS ENTRY"}
            </span>
            <h2 className="text-lg font-bold text-navy mb-1">{title}</h2>
            <p className="text-sm text-gray-600">{subtitle}</p>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-navy transition-colors"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {step ? (
          <div className="flex-shrink-0 flex flex-col gap-3 py-3 px-6 border-b border-gray-100">
            <div className="flex items-center justify-center gap-2">
              <span className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-cyan" : "bg-gray-300"}`} />
              <span className={`w-2 h-2 rounded-full ${step >= 2 ? "bg-cyan" : "bg-gray-300"}`} />
              <span className={`w-2 h-2 rounded-full ${step >= 3 ? "bg-cyan" : "bg-gray-300"}`} />
            </div>
            <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden" aria-hidden>
              <div
                className="h-1 bg-cyan transition-all"
                style={{ width: `${Math.min(100, Math.max(0, ((step || 0) / 3) * 100))}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:hover:bg-gray-400 [&::-webkit-scrollbar-track]:bg-transparent">
          {children}
        </div>

        {/* Sticky footer */}
        {footer ? (
          <div className="flex-shrink-0 flex items-center justify-between gap-3 p-4 border-t border-gray-100 bg-white">
            <div className="text-xs text-gray-500">Esc to close · Click backdrop to cancel</div>
            <div className="flex items-center gap-3">{footer}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
