"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function ModalShell({
  title,
  subtitle,
  step,
  children,
  footer,
  onClose,
}: {
  title: string;
  subtitle: string;
  step?: number;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <div>
            <span className="panel-kicker">{step ? `STEP ${step} OF 3` : "OPERATIONS ENTRY"}</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close modal"><X size={20} /></button>
        </div>
        {step ? (
          <div className="step-dots">
            <i className="filled" />
            <i className={step > 1 ? "filled" : ""} />
            <i className={step > 2 ? "filled" : ""} />
          </div>
        ) : null}
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
