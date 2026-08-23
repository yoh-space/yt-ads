"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  ArrowDownRight,
  Plus,
  Scissors,
  Trash2,
} from "lucide-react";
import type { JobCard, Machine, Material, Offcut, Profile, Role, ScrapLog } from "@/lib/operations-types";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Overview } from "./views/overview";
import { InventoryView } from "./views/inventory";
import { JobsView } from "./views/jobs";
import { MachinesView } from "./views/machines";
import { OffcutsView } from "./views/offcuts";
import { StockModal } from "./modals/stock-modal";
import { JobModal, type NewJobInput } from "./modals/job-modal";
import { OffcutModal, type NewOffcutInput } from "./modals/offcut-modal";
import { MaterialModal, type NewMaterialInput } from "./modals/material-modal";
import { ScrapModal, type NewScrapInput } from "./modals/scrap-modal";
import { MachineModal, type NewMachineInput } from "./modals/machine-modal";
import { navItems, type Modal, type View } from "./nav-config";

type WithId<T extends { _id: string }> = Omit<T, "_id"> & { id: T["_id"] };

function withIds<T extends { _id: string }>(docs: T[]): WithId<T>[] {
  return docs.map((doc) => {
    const { _id, ...rest } = doc;
    return { ...rest, id: _id };
  });
}

export function OperationsDashboard() {
  const profile = useQuery(api.users.getCurrentProfile);
  const state = useQuery(api.dashboard.getState);

  const ensureProfile = useMutation(api.users.ensureProfile);
  const recordStockMovement = useMutation(api.materials.recordStockMovement);
  const createMaterial = useMutation(api.materials.create);
  const createJob = useMutation(api.jobs.create);
  const completeJobMutation = useMutation(api.jobs.complete);
  const createMachine = useMutation(api.machines.create);
  const createOffcut = useMutation(api.offcuts.create);
  const logScrap = useMutation(api.offcuts.logScrap);

  const [activeView, setActiveView] = useState<View>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState("የዛሬ ሥራ በቅጽበት እየተመዘገበ ነው");

  useEffect(() => {
    if (profile === null) {
      void ensureProfile().catch(() => {});
    }
  }, [profile, ensureProfile]);

  if (state === undefined || profile === undefined) {
    return (
      <div className="app-shell">
        <div className="main-content">
          <div className="page-content"><p style={{ color: "#81929d" }}>Loading operations control…</p></div>
        </div>
      </div>
    );
  }

  const role: Role = profile?.role ?? "admin";
  const materials = withIds(state.materials) as Material[];
  const machines = withIds(state.machines) as Machine[];
  const jobs = withIds(state.jobs) as JobCard[];
  const offcuts = withIds(state.offcuts) as Offcut[];
  const scraps = withIds(state.scraps) as ScrapLog[];
  const resolvedProfile: Profile | null = profile ? { ...profile, id: profile._id } : null;

  const filteredMachines = role === "admin" || role === "storekeeper"
    ? machines
    : machines.filter((machine) => machine.operatorRole === role);
  const runningJobs = jobs.filter((job) => job.status === "In production");
  const lowStock = materials.filter((material) => material.quantity <= material.reorderAt);
  const stockValue = materials.reduce((total, material) => total + material.quantity, 0);
  const averageWaste = Number(
    (3.4 + Math.min(5, scraps.reduce((total, scrap) => total + scrap.quantity, 0) / 10)).toFixed(1),
  );

  function openView(view: View) {
    setActiveView(view);
    setMobileNavOpen(false);
  }

  function completeJob(jobId: string) {
    void completeJobMutation({ jobId });
    setNotice("የሥራ ካርዱ ተጠናቋል፤ መዝገቡ ተዘምኗል");
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        onNavigate={openView}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        runningJobsCount={runningJobs.length}
      />

      {mobileNavOpen ? (
        <button aria-label="Close navigation overlay" className="overlay" onClick={() => setMobileNavOpen(false)} />
      ) : null}

      <main className="main-content">
        <Topbar activeView={activeView} onMenu={() => setMobileNavOpen(true)} profile={resolvedProfile} />

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span />YO TECH DIGITALS · OPERATING SYSTEM</div>
              <h1>
                {activeView === "overview"
                  ? "የምርት እና ክምችት አጠቃላይ እይታ"
                  : navItems.find((item) => item.id === activeView)?.label}
                <span>{navItems.find((item) => item.id === activeView)?.english}</span>
              </h1>
              <p>{notice}</p>
            </div>
            <div className="heading-actions">
              {activeView === "inventory" ? (
                <>
                  <button className="button secondary" onClick={() => setModal("stock")}><ArrowDownRight size={16} />Stock movement</button>
                  <button className="button primary" onClick={() => setModal("material")}><Plus size={16} />እቃ ጨምር</button>
                </>
              ) : null}
              {activeView === "jobs" ? <button className="button primary" onClick={() => setModal("job")}><Plus size={16} />New job card</button> : null}
              {activeView === "machines" ? <button className="button primary" onClick={() => setModal("machine")}><Plus size={16} />Add machine</button> : null}
              {activeView === "offcuts" ? (
                <>
                  <button className="button secondary" onClick={() => setModal("scrap")}><Trash2 size={16} />Log scrap</button>
                  <button className="button primary" onClick={() => setModal("offcut")}><Scissors size={16} />Log offcut</button>
                </>
              ) : null}
              {activeView === "overview" ? <button className="button primary" onClick={() => setModal("job")}><Plus size={16} />አዲስ ሥራ ካርድ</button> : null}
            </div>
          </section>

          {activeView === "overview" ? (
            <Overview
              materials={materials}
              machines={machines}
              jobs={jobs}
              lowStock={lowStock}
              stockValue={stockValue}
              waste={averageWaste}
              onView={openView}
              onComplete={completeJob}
            />
          ) : null}
          {activeView === "inventory" ? (
            <InventoryView materials={materials} lowStock={lowStock} onStock={() => setModal("stock")} onAdd={() => setModal("material")} />
          ) : null}
          {activeView === "jobs" ? (
            <JobsView jobs={jobs} machines={machines} materials={materials} onCreate={() => setModal("job")} onComplete={completeJob} />
          ) : null}
          {activeView === "machines" ? (
            <MachinesView
              machines={filteredMachines}
              jobs={jobs}
              role={role}
              onCreate={() => setModal("machine")}
              onOffcut={() => setModal("offcut")}
              onScrap={() => setModal("scrap")}
              onComplete={completeJob}
            />
          ) : null}
          {activeView === "offcuts" ? (
            <OffcutsView offcuts={offcuts} scraps={scraps} onCreate={() => setModal("offcut")} onScrap={() => setModal("scrap")} />
          ) : null}
        </div>
      </main>

      {modal === "stock" ? (
        <StockModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(materialId, direction, quantity, inputUnit, note) => {
            void recordStockMovement({ materialId: materialId as Id<"materials">, direction, quantity, inputUnit, note });
            const material = materials.find((entry) => entry.id === materialId);
            setNotice(`${material?.name}: ${direction === "in" ? "stock-in" : "stock-out"} — ${note || "recorded"}`);
            setModal(null);
          }}
        />
      ) : null}
      {modal === "job" ? (
        <JobModal
          materials={materials}
          machines={machines}
          onClose={() => setModal(null)}
          onSave={(input: NewJobInput) => {
            void createJob({
              ...input,
              machineId: input.machineId as Id<"machines">,
              materialId: input.materialId as Id<"materials">,
            });
            setNotice(`${input.client || "Walk-in"} ተመዝግቧል እና ለማሽን ተመድቧል`);
            setModal(null);
          }}
        />
      ) : null}
      {modal === "offcut" ? (
        <OffcutModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(input: NewOffcutInput) => {
            void createOffcut(input);
            setNotice(`ቅሪት ወደ ንቁ ክምችት ተመልሷል`);
            setModal(null);
          }}
        />
      ) : null}
      {modal === "scrap" ? (
        <ScrapModal
          materials={materials}
          onClose={() => setModal(null)}
          onSave={(input: NewScrapInput) => {
            void logScrap(input);
            setNotice(`${input.reason} ለወጪ እና ቅነሳ ትንተና ተመዝግቧል`);
            setModal(null);
          }}
        />
      ) : null}
      {modal === "material" ? (
        <MaterialModal
          onClose={() => setModal(null)}
          onSave={(input: NewMaterialInput) => {
            void createMaterial(input);
            setNotice(`${input.name} ወደ የእቃ መዝገብ ታክሏል`);
            setModal(null);
          }}
        />
      ) : null}
      {modal === "machine" ? (
        <MachineModal
          onClose={() => setModal(null)}
          onSave={(input: NewMachineInput) => {
            void createMachine(input);
            setNotice(`${input.name} ወደ ማሽኖች ዝርዝር ታክሏል`);
            setModal(null);
          }}
        />
      ) : null}
    </div>
  );
}

