"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ModalShell } from "@/components/dashboard/modals/modal-shell";
import { Button } from "@/components/shared/ui/button";
import { Palette, CheckCircle2, AlertCircle, RotateCcw, ExternalLink, Download, FileText, UserCheck } from "lucide-react";
import type { OrderPriority } from "@/lib/operations-types";

export function OrderAssignDesignModal({
  order,
  onClose,
  onSuccess,
}: {
  order: {
    id: string;
    code: string;
    clientName: string;
    serviceType: string;
    dimensions: string;
    preferredDueDate: number;
    priority: OrderPriority;
    notes?: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const designers = useQuery(api.receptionist.cockpit.listDesigners);
  const assignDesignTask = useMutation(api.receptionist.cockpit.assignDesignTask);

  const [designerId, setDesignerId] = useState<string>("");
  const [customerBrief, setCustomerBrief] = useState(order.notes ?? "");
  const [productionBrief, setProductionBrief] = useState("");
  const [requiredOutputType, setRequiredOutputType] = useState("Vector PDF (Print Ready, CMYK, 300DPI)");
  const [dimensions, setDimensions] = useState(order.dimensions);
  const [priority, setPriority] = useState<OrderPriority>(order.priority ?? "Medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default designer if list loads and only one or not set
  if (designers && designers.length > 0 && !designerId) {
    const firstDesigner = designers.find((d: any) => d.role === "designer") ?? designers[0];
    if (firstDesigner) {
      setDesignerId(firstDesigner.authUserId);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!designerId) {
      toast.error("Please select a designer");
      return;
    }

    try {
      setIsSubmitting(true);
      await assignDesignTask({
        orderId: order.id as Id<"customerOrders">,
        designerId,
        customerBrief: customerBrief.trim() || undefined,
        productionBrief: productionBrief.trim() || undefined,
        requiredOutputType: requiredOutputType.trim() || undefined,
        dimensions: dimensions.trim() || undefined,
        priority,
      });

      toast.success(`Design task assigned for order ${order.code}`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to assign design task");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={`Assign Design · ${order.code}`}
      subtitle="Assign design brief and specifications to a studio designer"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" size="small" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={handleSubmit}
            disabled={isSubmitting || !designerId}
          >
            <Palette size={14} />
            {isSubmitting ? "Assigning…" : "Assign to Designer"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="rounded-lg border border-border/60 bg-surface-elevated p-3">
          <p className="font-semibold text-foreground">{order.clientName} · {order.serviceType}</p>
          <p className="text-muted-foreground mt-0.5">Dimensions: {order.dimensions}</p>
        </div>

        <div>
          <label className="block font-medium text-foreground mb-1">
            Assigned Designer <span className="text-destructive">*</span>
          </label>
          <select
            value={designerId}
            onChange={(e) => setDesignerId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            required
          >
            {designers === undefined ? (
              <option value="">Loading staff…</option>
            ) : designers.length === 0 ? (
              <option value="">No designers found</option>
            ) : (
              designers.map((d: any) => (
                <option key={d.authUserId} value={d.authUserId}>
                  {d.name} ({d.email}) {d.role === "owner" ? "· Owner" : d.role === "admin" ? "· Admin" : "· Designer"}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-foreground mb-1">Required Output Format</label>
            <select
              value={requiredOutputType}
              onChange={(e) => setRequiredOutputType(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="Vector PDF (Print Ready, CMYK, 300DPI)">Vector PDF (Print Ready, CMYK, 300DPI)</option>
              <option value="TIFF (300DPI, Flattened CMYK)">TIFF (300DPI, Flattened CMYK)</option>
              <option value="PSD (Layered Artwork)">PSD (Layered Artwork)</option>
              <option value="AI / EPS (Illustrator Vector)">AI / EPS (Illustrator Vector)</option>
              <option value="High-Res PNG / JPG">High-Res PNG / JPG</option>
            </select>
          </div>
          <div>
            <label className="block font-medium text-foreground mb-1">Target Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as OrderPriority)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="High">High Priority (Urgent)</option>
              <option value="Medium">Medium Priority (Standard)</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-medium text-foreground mb-1">Dimensions / Sizing</label>
          <input
            type="text"
            value={dimensions}
            onChange={(e) => setDimensions(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="e.g. 3m x 2m"
          />
        </div>

        <div>
          <label className="block font-medium text-foreground mb-1">Customer Brief / Instructions</label>
          <textarea
            rows={3}
            value={customerBrief}
            onChange={(e) => setCustomerBrief(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder="Notes from customer or order intake…"
          />
        </div>

        <div>
          <label className="block font-medium text-foreground mb-1">Production & Finishing Brief (Optional)</label>
          <textarea
            rows={2}
            value={productionBrief}
            onChange={(e) => setProductionBrief(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder="Bleed, eyelets, pocket fold, cut margins, lamination notes…"
          />
        </div>
      </form>
    </ModalShell>
  );
}

export function OrderReviewDesignModal({
  order,
  task,
  onClose,
  onSuccess,
}: {
  order: {
    id: string;
    code: string;
    clientName: string;
    serviceType: string;
    dimensions: string;
  };
  task: {
    _id: Id<"designTasks">;
    assignedDesignerName?: string;
    currentVersionNumber: number;
    customerBrief?: string;
    productionBrief?: string;
    latestSubmission?: {
      _id: Id<"designSubmissions">;
      versionNumber: number;
      fileName: string;
      fileUrl?: string | null;
      notes?: string;
      submittedAt: number;
    } | null;
  };
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const reviewDesign = useMutation(api.receptionist.cockpit.reviewDesignSubmission);

  const [decision, setDecision] = useState<"APPROVED" | "REVISION_REQUIRED">("APPROVED");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submission = task.latestSubmission;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (decision === "REVISION_REQUIRED" && !feedback.trim()) {
      toast.error("Please provide feedback explaining what changes are needed.");
      return;
    }

    try {
      setIsSubmitting(true);
      await reviewDesign({
        taskId: task._id,
        decision,
        feedback: feedback.trim() || undefined,
      });

      if (decision === "APPROVED") {
        toast.success(`Design approved for ${order.code}. Ready for pricing.`);
      } else {
        toast.success(`Revision requested from designer for ${order.code}.`);
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to submit design review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={`Review Artwork Submission · ${order.code}`}
      subtitle="Verify submitted artwork specifications before pricing and customer payment"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" size="small" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={decision === "APPROVED" ? "primary" : "secondary"}
            size="small"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {decision === "APPROVED" ? <CheckCircle2 size={14} /> : <RotateCcw size={14} />}
            {isSubmitting
              ? "Submitting…"
              : decision === "APPROVED"
                ? "Approve Artwork (Ready for Pricing)"
                : "Return for Revision"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="rounded-lg border border-border/60 bg-surface-elevated p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{order.clientName} · {order.serviceType}</p>
              <p className="text-muted-foreground mt-0.5">Designer: {task.assignedDesignerName ?? "Assigned Designer"}</p>
            </div>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              v{submission?.versionNumber ?? task.currentVersionNumber}
            </span>
          </div>
        </div>

        {submission ? (
          <div className="rounded-lg border border-border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-primary" />
                <div>
                  <p className="font-semibold text-foreground">{submission.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Submitted {new Date(submission.submittedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {submission.fileUrl ? (
                <a
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                >
                  <Download size={12} />
                  Download / View
                </a>
              ) : (
                <span className="text-muted-foreground text-[11px]">No file attached</span>
              )}
            </div>

            {submission.notes ? (
              <div className="mt-2 rounded bg-surface p-2 text-[11px] text-foreground">
                <span className="font-semibold text-muted-foreground block mb-0.5">Designer Notes:</span>
                {submission.notes}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
            No design file submission record found.
          </div>
        )}

        <div>
          <label className="block font-medium text-foreground mb-1.5">Review Decision</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDecision("APPROVED")}
              className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 font-semibold transition ${
                decision === "APPROVED"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500"
                  : "border-border bg-surface text-muted-foreground hover:border-border/80"
              }`}
            >
              <CheckCircle2 size={15} />
              Approve Artwork
            </button>
            <button
              type="button"
              onClick={() => setDecision("REVISION_REQUIRED")}
              className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 font-semibold transition ${
                decision === "REVISION_REQUIRED"
                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500"
                  : "border-border bg-surface text-muted-foreground hover:border-border/80"
              }`}
            >
              <RotateCcw size={15} />
              Request Changes
            </button>
          </div>
        </div>

        <div>
          <label className="block font-medium text-foreground mb-1">
            {decision === "APPROVED" ? "Approval Notes (Optional)" : "Revision Feedback (Required)"}
          </label>
          <textarea
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder={
              decision === "APPROVED"
                ? "Add any production handover or pricing remarks…"
                : "Describe required changes (e.g. adjust bleeding, fix typo, increase logo size)…"
            }
            required={decision === "REVISION_REQUIRED"}
          />
        </div>
      </form>
    </ModalShell>
  );
}

export function OrderReturnClarificationModal({
  order,
  onClose,
  onSuccess,
}: {
  order: {
    id: string;
    code: string;
    clientName: string;
    phone: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const returnClarification = useMutation(api.receptionist.cockpit.returnOrderForCustomerClarification);

  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please enter the clarification reason.");
      return;
    }

    try {
      setIsSubmitting(true);
      await returnClarification({
        orderId: order.id as Id<"customerOrders">,
        reason: reason.trim(),
      });

      toast.success(`Order ${order.code} flagged for customer follow-up.`);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to return order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      title={`Customer Clarification · ${order.code}`}
      subtitle="Request missing details, dimensions, or files from the customer"
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" size="small" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
          >
            <AlertCircle size={14} />
            {isSubmitting ? "Submitting…" : "Flag for Customer Clarification"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="rounded-lg border border-border/60 bg-surface-elevated p-3">
          <p className="font-semibold text-foreground">{order.clientName}</p>
          <p className="text-muted-foreground mt-0.5">Phone: {order.phone}</p>
        </div>

        <div>
          <label className="block font-medium text-foreground mb-1">
            Missing Information / Clarification Needed <span className="text-destructive">*</span>
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            placeholder="e.g. Dimensions missing, artwork file corrupted/low resolution, material selection unconfirmed…"
            required
          />
        </div>
      </form>
    </ModalShell>
  );
}
