"use client";

import type { ReactNode } from "react";
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
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" 
      role="dialog" 
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-100">
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
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
          <div className="flex items-center justify-center gap-2 py-3 px-6 border-b border-gray-100">
            <span className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-cyan" : "bg-gray-300"}`} />
            <span className={`w-2 h-2 rounded-full ${step >= 2 ? "bg-cyan" : "bg-gray-300"}`} />
            <span className={`w-2 h-2 rounded-full ${step >= 3 ? "bg-cyan" : "bg-gray-300"}`} />
          </div>
        ) : null}
        
        <div className="p-6">{children}</div>
        
        {footer ? (
          <div className="p-6 pt-0 border-t border-gray-100">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
