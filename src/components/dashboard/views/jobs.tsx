"use client";

import { Box, Plus, Wrench, X } from "lucide-react";
import type { JobCard, Machine, Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";
import { cn } from "@/lib/utils";

export function JobsView({
  jobs,
  machines,
  materials,
  canCreate,
  canComplete,
  onCreate,
  onComplete,
  filterStatus,
  onClearFilter,
}: {
  jobs: JobCard[];
  canCreate: boolean;
  canComplete: boolean;
  machines: Machine[];
  materials: Material[];
  onCreate: () => void;
  onComplete: (id: string) => void;
  filterStatus?: JobCard["status"] | "open" | null;
  onClearFilter?: () => void;
}) {
  const columns: JobCard["status"][] = ["Queued", "In production", "Completed"];
  const matchesFilter = (job: JobCard) => {
    if (!filterStatus) return true;
    return filterStatus === "open" ? job.status !== "Completed" : job.status === filterStatus;
  };
  const visibleColumns = filterStatus
    ? columns.filter((status) => (filterStatus === "open" ? status !== "Completed" : status === filterStatus))
    : columns;
    
  const openJobsCount = jobs.filter((job) => job.status !== "Completed").length;
  const filteredJobsCount = jobs.filter(matchesFilter).length;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy">Production Queue</h2>
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-medium">{openJobsCount}</span> open cards
          </p>
        </div>
        <div className="flex items-center gap-3">
          {filterStatus && (
            <button 
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan hover:text-cyan-dark transition-colors"
              onClick={onClearFilter}
            >
              Clear filter <X size={14} />
            </button>
          )}
          {canCreate && (
            <button 
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-navy text-white shadow-sm transition-colors hover:bg-navy-2 focus:outline-none focus:ring-2 focus:ring-cyan focus:ring-offset-2"
              onClick={onCreate}
            >
              <Plus size={16} />
              New Job Card
            </button>
          )}
        </div>
      </div>

      {/* Filter Status Indicator */}
      {filterStatus && (
        <div className="inline-flex items-center gap-2 px-3 py-2 bg-cyan/10 text-cyan rounded-lg border border-cyan/20">
          <span className="text-sm font-medium">
            Filtered to <strong>{filterStatus === "open" ? "Open / Pending" : filterStatus}</strong>
          </span>
          <span className="text-xs text-cyan/80">
            {filteredJobsCount} card{filteredJobsCount === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {visibleColumns.map((status) => {
          const statusJobs = jobs.filter((job) => job.status === status).filter(matchesFilter);
          const statusCount = statusJobs.length;
          
          return (
            <div key={status} className="bg-white border border-line rounded-lg overflow-hidden shadow-sm">
              {/* Column Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-line">
                <h3 className="font-semibold text-navy">{status}</h3>
                <span className="inline-flex items-center justify-center w-6 h-6 text-xs font-bold text-gray-600 bg-gray-200 rounded-full">
                  {statusCount}
                </span>
              </div>

              {/* Job Cards */}
              <div className="p-4 space-y-3 min-h-[400px]">
                {statusJobs.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    {filterStatus ? "No matching cards" : "No cards"}
                  </div>
                ) : (
                  statusJobs.map((job) => {
                    const machine = machines.find((item) => item.id === job.machineId);
                    const material = materials.find((item) => item.id === job.materialId);
                    
                    return (
                      <div 
                        key={job.id} 
                        className="p-4 bg-gray-50 border border-line rounded-lg hover:shadow-sm hover:border-gray-300 transition-all duration-200"
                      >
                        {/* Job Card Header */}
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-sm font-mono font-bold text-navy">
                            {job.code}
                          </span>
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            {
                              "bg-coral/10 text-coral": job.priority === "High",
                              "bg-gold/10 text-gold": job.priority === "Medium", 
                              "bg-gray-100 text-gray-600": job.priority === "Normal"
                            }
                          )}>
                            {job.priority}
                          </span>
                        </div>

                        {/* Job Details */}
                        <div className="space-y-2 mb-3">
                          <h4 className="font-semibold text-navy text-sm line-clamp-2">
                            {job.title}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {job.client}
                          </p>
                          {job.orderOverdue && (
                            <div className="flex items-center gap-1.5 text-xs text-coral font-medium">
                              <div className="w-1.5 h-1.5 rounded-full bg-coral"></div>
                              Linked customer order overdue
                            </div>
                          )}
                        </div>

                        {/* Job Metadata */}
                        <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1.5">
                            <Wrench size={13} />
                            <span>{machine?.code || "—"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Box size={13} />
                            <span>{formatQuantity(job.quantity, job.unit)}</span>
                          </div>
                        </div>

                        {/* Job Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                          <span className="text-xs text-gray-500 truncate">
                            {material?.name || "—"}
                          </span>
                          {canComplete && status === "In production" && (
                            <button 
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-green text-white hover:bg-green/90 transition-colors focus:outline-none focus:ring-2 focus:ring-green focus:ring-offset-2"
                              onClick={() => onComplete(job.id)}
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
