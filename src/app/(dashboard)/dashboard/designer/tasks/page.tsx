"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/shared/ui/table";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import {
  Scissors,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  FileText,
  ExternalLink,
  X,
  Play,
  AlertCircle,
  Eye,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export default function DesignerTasksPage() {
  const profile = useQuery(api.users.getCurrentProfile);
  const tasks = useQuery(api.designer.tasks.listAssignedTasks, profile ? {} : "skip");

  const acceptTask = useMutation(api.designer.tasks.acceptTask);
  const blockTask = useMutation(api.designer.tasks.blockTask);
  const submitDesign = useMutation(api.designer.tasks.submitDesign);
  const generateUploadUrl = useMutation(api.orders.generateUploadUrl);

  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [submitTask, setSubmitTask] = useState<any | null>(null);
  const [blockTarget, setBlockTarget] = useState<any | null>(null);
  const [blockReason, setBlockReason] = useState("");

  // Submit modal form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (tasks === undefined || !profile) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Assigned Design Tasks…" />
      </div>
    );
  }

  const inProgressCount = tasks.filter((t: any) => t.status === "IN_PROGRESS").length;
  const revisionCount = tasks.filter((t: any) => t.status === "REVISION_REQUIRED").length;
  const submittedCount = tasks.filter((t: any) => t.status === "SUBMITTED").length;
  const approvedCount = tasks.filter((t: any) => t.status === "APPROVED").length;

  const handleAccept = async (taskId: Id<"designTasks">, code: string) => {
    try {
      await acceptTask({ taskId });
      toast.success(`Accepted task for order ${code}. Work in progress.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to accept task.");
    }
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTarget || !blockReason.trim()) return;

    try {
      setIsSubmitting(true);
      await blockTask({
        taskId: blockTarget._id,
        reason: blockReason.trim(),
      });
      toast.success(`Task marked as blocked. Reception notified.`);
      setBlockTarget(null);
      setBlockReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to block task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDesignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTask || !uploadFile) {
      toast.error("Please choose an artwork file to upload.");
      return;
    }

    try {
      setIsSubmitting(true);
      // 1. Get Convex upload URL
      const uploadUrl = await generateUploadUrl({});
      const postRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": uploadFile.type || "application/octet-stream" },
        body: uploadFile,
      });

      if (!postRes.ok) throw new Error("Upload to storage failed.");
      const { storageId } = await postRes.json();

      // 2. Submit design version
      await submitDesign({
        taskId: submitTask._id,
        fileStorageId: storageId,
        fileName: uploadFile.name,
        notes: notes.trim() || undefined,
      });

      toast.success(`Artwork submitted for ${submitTask.orderCode}! Reception notified.`);
      setSubmitTask(null);
      setUploadFile(null);
      setNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit artwork.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Design Studio · የዲዛይን ክፍል"
        title="Assigned Design Tasks"
        subtitle="Prepare production-ready artwork, collaborate on customer briefs, and submit versioned designs."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Scissors size={16} />}
          label="In Progress"
          subtitle="በመስራት ላይ"
          value={inProgressCount}
          description="Tasks currently being designed"
          variant="default"
        />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="Revisions Required"
          subtitle="ማስተካከያ የሚፈልጉ"
          value={revisionCount}
          description="Returned by reception with feedback"
          variant="alert"
          isAlert={revisionCount > 0}
        />
        <StatCard
          icon={<Clock size={16} />}
          label="Under Review"
          subtitle="በግምገማ ላይ"
          value={submittedCount}
          description="Submitted designs awaiting approval"
          variant="sales"
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="Approved Artworks"
          subtitle="የጸደቁ ዲዛይኖች"
          value={approvedCount}
          description="Ready for pricing and production"
          variant="cost"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Assigned Tasks Queue"
          subtitle="Track assignments and upload production artwork"
          kicker="Task List"
          icon={<Sparkles size={16} />}
        />

        {tasks.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Scissors size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No design tasks currently assigned.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Code</TableHead>
                  <TableHead>Client & Service</TableHead>
                  <TableHead>Dimensions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Customer Brief / File</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task: any) => (
                  <TableRow key={task._id} className="hover:bg-muted/50">
                    <TableCell className="font-mono font-semibold text-primary">
                      {task.orderCode}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs">{task.clientName}</div>
                      <div className="text-xs text-muted-foreground">{task.serviceType}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {task.dimensions ?? task.orderDimensions ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          task.status === "ASSIGNED"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : task.status === "IN_PROGRESS"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : task.status === "REVISION_REQUIRED"
                                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                : task.status === "SUBMITTED"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                  : task.status === "APPROVED"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                        }`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      v{task.currentVersionNumber ?? 1}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {task.customerBrief || "No brief specified"}
                      </div>
                      {task.customerFileUrl && (
                        <a
                          href={task.customerFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-brand-primary-light hover:underline"
                        >
                          <FileText size={11} />
                          <span>Reference Asset</span>
                          <ExternalLink size={9} />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {task.status === "ASSIGNED" && (
                          <button
                            type="button"
                            onClick={() => handleAccept(task._id, task.orderCode)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            <Play size={12} />
                            <span>Accept</span>
                          </button>
                        )}

                        {["ASSIGNED", "IN_PROGRESS", "REVISION_REQUIRED"].includes(task.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setSubmitTask(task);
                              setUploadFile(null);
                              setNotes("");
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            <Upload size={12} />
                            <span>Submit Artwork</span>
                          </button>
                        )}

                        {["ASSIGNED", "IN_PROGRESS"].includes(task.status) && (
                          <button
                            type="button"
                            onClick={() => {
                              setBlockTarget(task);
                              setBlockReason("");
                            }}
                            className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                          >
                            Block
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedTask(task)}
                          className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-muted"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {/* Submit Artwork Modal */}
      {submitTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-foreground">Submit Design Artwork</h3>
                <p className="text-xs text-muted-foreground font-mono">{submitTask.orderCode} · {submitTask.clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSubmitTask(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDesignSubmit} className="mt-4 space-y-4">
              {submitTask.receptionReviewNotes && (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <div className="font-semibold flex items-center gap-1.5 mb-1">
                    <MessageSquare size={13} />
                    <span>Reception Revision Feedback:</span>
                  </div>
                  <p>{submitTask.receptionReviewNotes}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-foreground">Artwork File (PDF, AI, PSD, TIFF, PNG)</label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="mt-1.5 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                  required
                />
                {uploadFile && (
                  <p className="mt-1 text-xs text-muted-foreground font-mono">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Version Notes / Comments for Reception</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Dimensions confirmed, bleed added 5cm all sides, colors CMYK optimized..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmitTask(null)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !uploadFile}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Upload size={14} />
                  <span>{isSubmitting ? "Uploading & Submitting..." : "Submit for Review"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-foreground">Task Details & Brief</h3>
                <p className="text-xs text-muted-foreground font-mono">{selectedTask.orderCode} · {selectedTask.clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg">
                <div>
                  <span className="text-muted-foreground">Service:</span>
                  <p className="font-semibold text-foreground">{selectedTask.serviceType}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Dimensions:</span>
                  <p className="font-mono font-semibold text-foreground">{selectedTask.dimensions ?? selectedTask.orderDimensions ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Status:</span>
                  <p className="font-semibold text-foreground">{selectedTask.status}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>
                  <p className="font-semibold text-foreground">{selectedTask.priority ?? selectedTask.orderPriority}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-foreground mb-1">Customer / Reception Brief:</h4>
                <p className="bg-muted/30 p-2.5 rounded border border-border text-foreground">
                  {selectedTask.customerBrief || "No additional brief notes provided."}
                </p>
              </div>

              {selectedTask.productionBrief && (
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Production Specifics:</h4>
                  <p className="bg-muted/30 p-2.5 rounded border border-border text-foreground">
                    {selectedTask.productionBrief}
                  </p>
                </div>
              )}

              {selectedTask.customerFileUrl && (
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Reference Artwork / Asset:</h4>
                  <a
                    href={selectedTask.customerFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-brand-primary-light hover:underline bg-muted/50 p-2 rounded w-full"
                  >
                    <FileText size={14} />
                    <span className="truncate">{selectedTask.customerFileName || "Download Customer Reference"}</span>
                    <ExternalLink size={12} className="ml-auto" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Task Modal */}
      {blockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-semibold text-foreground">Report Blocking Issue</h3>
                <p className="text-xs text-muted-foreground font-mono">{blockTarget.orderCode} · {blockTarget.clientName}</p>
              </div>
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBlockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground">Why is this task blocked?</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Missing high-res logo, unclear dimensions, customer vector file corrupt..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background p-2 text-xs text-foreground"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBlockTarget(null)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  <AlertCircle size={14} />
                  <span>{isSubmitting ? "Reporting..." : "Report Blocked"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
