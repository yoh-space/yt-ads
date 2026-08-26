"use client";

import { Box, Plus, Wrench } from "lucide-react";
import type { JobCard, Machine, Material } from "@/lib/operations-types";
import { formatQuantity } from "@/lib/units";

export function JobsView({
  jobs,
  machines,
  materials,
  canCreate,
  canComplete,
  onCreate,
  onComplete,
}: {
  jobs: JobCard[];
  canCreate: boolean;
  canComplete: boolean;
  machines: Machine[];
  materials: Material[];
  onCreate: () => void;
  onComplete: (id: string) => void;
}) {
  const columns: JobCard["status"][] = ["Queued", "In production", "Completed"];
  return (
    <section className="jobs-layout">
      <div className="kanban-head">
        <p>
          Production queue <span>{jobs.filter((job) => job.status !== "Completed").length} open cards</span>
        </p>
      </div>
      <div className="kanban-board">
        {columns.map((status) => (
          <article className="kanban-column" key={status}>
            <div className="kanban-column-head">
              <h3>{status}</h3>
              <b>{jobs.filter((job) => job.status === status).length}</b>
            </div>
            <div className="job-stack">
              {jobs
                .filter((job) => job.status === status)
                .map((job) => {
                  const machine = machines.find((item) => item.id === job.machineId);
                  const material = materials.find((item) => item.id === job.materialId);
                  return (
                    <div className="job-card" key={job.id}>
                      <div className="job-card-head">
                        <span>{job.code}</span>
                        <em className={job.priority.toLowerCase()}>{job.priority}</em>
                      </div>
                      <h4>{job.title}</h4>
                      <p>{job.client}</p>
                      {job.orderOverdue ? <small className="danger-text">Linked customer order overdue</small> : null}
                      <div className="job-card-data">
                        <span><Wrench size={13} />{machine?.code}</span>
                        <span><Box size={13} />{formatQuantity(job.quantity, job.unit)}</span>
                      </div>
                      <div className="job-card-footer">
                        <small>{material?.name}</small>
                        {canComplete && status === "In production" ? <button onClick={() => onComplete(job.id)}>Complete</button> : null}
                      </div>
                    </div>
                  );
                })}
              {jobs.filter((job) => job.status === status).length === 0 ? <div className="empty-column">No cards</div> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
