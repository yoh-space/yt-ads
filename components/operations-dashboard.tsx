"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Box,
  Boxes,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  Command,
  Factory,
  Gauge,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  MoveUpRight,
  PackagePlus,
  PanelLeftClose,
  Plus,
  Printer,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Store,
  Trash2,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import {
  initialJobs,
  initialMachines,
  initialMaterials,
  initialOffcuts,
  roleLabels,
  type JobCard,
  type Machine,
  type Material,
  type Offcut,
  type Role,
  type ScrapLog,
  type Unit,
} from "@/lib/operations-types";
import { calculateOffcutArea, convertToBase, formatQuantity } from "@/lib/units";
import { applyStockMovement, assignJobToMachine, completeProductionJob, recordScrap, returnOffcutToInventory } from "@/lib/workflows";

type View = "overview" | "inventory" | "jobs" | "machines" | "offcuts";
type Modal = "stock" | "job" | "offcut" | "scrap" | "material" | "machine" | null;

const navItems: Array<{ id: View; label: string; english: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "ዋና ማዕከል", english: "Overview", icon: LayoutDashboard },
  { id: "inventory", label: "ክምችት", english: "Inventory", icon: Boxes },
  { id: "jobs", label: "የሥራ ካርዶች", english: "Job cards", icon: ClipboardList },
  { id: "machines", label: "ማሽኖች", english: "Machines", icon: Factory },
  { id: "offcuts", label: "ቅሪት እቃ", english: "Offcuts", icon: Scissors },
];

const unitOptions: Unit[] = ["m²", "m", "sheet", "piece", "L"];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function statusTone(status: string) {
  if (status === "Running" || status === "In production" || status === "Completed") return "success";
  if (status === "Maintenance" || status === "Paused") return "warning";
  return "neutral";
}

export function OperationsDashboard() {
  const [activeView, setActiveView] = useState<View>("overview");
  const [role, setRole] = useState<Role>("admin");
  const [materials, setMaterials] = useState<Material[]>(initialMaterials);
  const [machines, setMachines] = useState<Machine[]>(initialMachines);
  const [jobs, setJobs] = useState<JobCard[]>(initialJobs);
  const [offcuts, setOffcuts] = useState<Offcut[]>(initialOffcuts);
  const [scraps, setScraps] = useState<ScrapLog[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState("የዛሬ ሥራ በቅጽበት እየተመዘገበ ነው");

  const filteredMachines = useMemo(
    () => role === "admin" || role === "storekeeper" ? machines : machines.filter((machine) => machine.operatorRole === role),
    [machines, role],
  );
  const runningJobs = jobs.filter((job) => job.status === "In production");
  const lowStock = materials.filter((material) => material.quantity <= material.reorderAt);
  const stockValue = materials.reduce((total, material) => total + material.quantity, 0);
  const averageWaste = Number((3.4 + Math.min(5, scraps.reduce((total, scrap) => total + scrap.quantity, 0) / 10)).toFixed(1));

  function openView(view: View) {
    setActiveView(view);
    setMobileNavOpen(false);
  }

  function setRoleAndView(nextRole: Role) {
    setRole(nextRole);
    setActiveView(nextRole === "admin" ? "overview" : nextRole === "storekeeper" ? "inventory" : "machines");
    setNotice(`${roleLabels[nextRole].am} የሥራ ቦታ ተከፍቷል`);
  }

  function completeJob(jobId: string) {
    const next = completeProductionJob(jobs, machines, jobId);
    setJobs(next.jobs);
    setMachines(next.machines);
    setNotice("የሥራ ካርዱ ተጠናቋል፤ መዝገቡ ተዘምኗል");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark"><span>Y</span><i /></div>
          <div><strong>YT Advertising</strong><small>Operations Control</small></div>
          <button className="mobile-close icon-button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="workspace-chip"><span className="live-dot" />ቀጥታ ማዕከል <small>LIVE</small></div>
        <nav className="primary-nav">
          <p>የሥራ ማውጫ <span>WORKSPACE</span></p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${activeView === item.id ? "active" : ""}`} onClick={() => openView(item.id)}><Icon size={18} /><span>{item.label}<small>{item.english}</small></span>{item.id === "jobs" && runningJobs.length > 0 ? <b>{runningJobs.length}</b> : null}</button>;
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="support-card"><Sparkles size={17} /><p><strong>YoTech Digitals</strong><br />Enterprise workflow system</p></div>
          <button className="nav-item"><Settings size={18} /><span>ማስተካከያ<small>Settings</small></span></button>
        </div>
      </aside>

      {mobileNavOpen ? <button aria-label="Close navigation overlay" className="overlay" onClick={() => setMobileNavOpen(false)} /> : null}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <button className="collapse-button icon-button" aria-label="Collapse sidebar"><PanelLeftClose size={19} /></button>
            <div className="breadcrumb"><span>YT Advertising</span><i>/</i><strong>{navItems.find((item) => item.id === activeView)?.english}</strong></div>
          </div>
          <div className="topbar-right">
            <div className="search-box"><Search size={17} /><input placeholder="Search material, job card..." /><kbd>⌘ K</kbd></div>
            <button className="icon-button notification"><Bell size={19} /><b>3</b></button>
            <div className="role-menu"><span className="avatar">{roleLabels[role].initial}</span><div><strong>Yordanos</strong><small>{roleLabels[role].en}</small></div><ChevronDown size={15} /></div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div><div className="eyebrow"><span />YO TECH DIGITALS · OPERATING SYSTEM</div><h1>{activeView === "overview" ? "የምርት እና ክምችት አጠቃላይ እይታ" : navItems.find((item) => item.id === activeView)?.label}<span>{navItems.find((item) => item.id === activeView)?.english}</span></h1><p>{notice}</p></div>
            <div className="heading-actions">
              {activeView === "inventory" ? <><button className="button secondary" onClick={() => setModal("stock")}><ArrowDownRight size={16} />Stock movement</button><button className="button primary" onClick={() => setModal("material")}><Plus size={16} />እቃ ጨምር</button></> : null}
              {activeView === "jobs" ? <button className="button primary" onClick={() => setModal("job")}><Plus size={16} />New job card</button> : null}
              {activeView === "machines" ? <button className="button primary" onClick={() => setModal("machine")}><Plus size={16} />Add machine</button> : null}
              {activeView === "offcuts" ? <><button className="button secondary" onClick={() => setModal("scrap")}><Trash2 size={16} />Log scrap</button><button className="button primary" onClick={() => setModal("offcut")}><Scissors size={16} />Log offcut</button></> : null}
              {activeView === "overview" ? <button className="button primary" onClick={() => setModal("job")}><Plus size={16} />አዲስ ሥራ ካርድ</button> : null}
            </div>
          </section>

          {activeView === "overview" ? <Overview materials={materials} machines={machines} jobs={jobs} lowStock={lowStock} stockValue={stockValue} waste={averageWaste} onView={openView} onComplete={completeJob} /> : null}
          {activeView === "inventory" ? <InventoryView materials={materials} lowStock={lowStock} onStock={() => setModal("stock")} onAdd={() => setModal("material")} /> : null}
          {activeView === "jobs" ? <JobsView jobs={jobs} machines={machines} materials={materials} onCreate={() => setModal("job")} onComplete={completeJob} /> : null}
          {activeView === "machines" ? <MachinesView machines={filteredMachines} jobs={jobs} role={role} onCreate={() => setModal("machine")} onOffcut={() => setModal("offcut")} onScrap={() => setModal("scrap")} onComplete={completeJob} /> : null}
          {activeView === "offcuts" ? <OffcutsView offcuts={offcuts} scraps={scraps} onCreate={() => setModal("offcut")} onScrap={() => setModal("scrap")} /> : null}
        </div>
      </main>

      <RoleRail role={role} onChange={setRoleAndView} />
      {modal === "stock" ? <StockModal materials={materials} onClose={() => setModal(null)} onSave={(materialId, direction, quantity, inputUnit, note) => {
        const material = materials.find((entry) => entry.id === materialId);
        if (!material) return;
        const base = convertToBase(quantity, inputUnit, material.unit, material.rollEquivalent, material.sheetEquivalent);
        setMaterials((current) => applyStockMovement(current, materialId, direction, quantity, inputUnit));
        setNotice(`${material.name}: ${direction === "in" ? "stock-in" : "stock-out"} ${formatQuantity(base, material.unit)} — ${note || "recorded"}`);
        setModal(null);
      }} /> : null}
      {modal === "job" ? <JobModal materials={materials} machines={machines} onClose={() => setModal(null)} onSave={(job) => { setJobs((current) => [job, ...current]); setMachines((current) => assignJobToMachine(current, job)); setNotice(`${job.code} ተመዝግቧል እና ለማሽን ተመድቧል`); setModal(null); }} /> : null}
      {modal === "offcut" ? <OffcutModal materials={materials} onClose={() => setModal(null)} onSave={(offcut) => { setOffcuts((current) => [offcut, ...current]); setMaterials((current) => returnOffcutToInventory(current, offcut)); setNotice(`${offcut.label} ቅሪት ወደ ንቁ ክምችት ተመልሷል`); setModal(null); }} /> : null}
      {modal === "scrap" ? <ScrapModal materials={materials} onClose={() => setModal(null)} onSave={(scrap) => { setScraps((current) => recordScrap(current, scrap)); setNotice(`${scrap.label} ብክነት ለወጪ እና ቅነሳ ትንተና ተመዝግቧል`); setModal(null); }} /> : null}
      {modal === "material" ? <MaterialModal onClose={() => setModal(null)} onSave={(material) => { setMaterials((current) => [...current, material]); setNotice(`${material.name} ወደ የእቃ መዝገብ ታክሏል`); setModal(null); }} /> : null}
      {modal === "machine" ? <MachineModal onClose={() => setModal(null)} onSave={(machine) => { setMachines((current) => [...current, machine]); setNotice(`${machine.name} ወደ ማሽኖች ዝርዝር ታክሏል`); setModal(null); }} /> : null}
    </div>
  );
}

function Overview({ materials, machines, jobs, lowStock, stockValue, waste, onView, onComplete }: { materials: Material[]; machines: Machine[]; jobs: JobCard[]; lowStock: Material[]; stockValue: number; waste: number; onView: (view: View) => void; onComplete: (id: string) => void }) {
  const stats = [
    { label: "የክምችት ንጥሎች", en: "Tracked inventory", value: materials.length.toString(), meta: "6 categories live", icon: Boxes, trend: "+2 this week", tone: "cyan" },
    { label: "በሂደት ላይ ያሉ ሥራዎች", en: "Active production", value: jobs.filter((job) => job.status === "In production").length.toString(), meta: "Across 3 machines", icon: Factory, trend: "Operational", tone: "gold" },
    { label: "የዛሬ ብክነት", en: "Waste ratio", value: `${waste}%`, meta: "Target below 5.0%", icon: Trash2, trend: "Within target", tone: "violet" },
    { label: "የክምችት ንቁ መጠን", en: "Active stock units", value: stockValue.toLocaleString("en-US", { maximumFractionDigits: 0 }), meta: "All base units", icon: Gauge, trend: "Live count", tone: "blue" },
  ];
  return <>
    <section className="stats-grid">{stats.map((stat) => { const Icon = stat.icon; return <article className={`stat-card ${stat.tone}`} key={stat.en}><div className="stat-top"><span className="stat-icon"><Icon size={19} /></span><span className="trend"><ArrowUpRight size={13} />{stat.trend}</span></div><strong>{stat.value}</strong><p>{stat.label}</p><small>{stat.en} · {stat.meta}</small></article>; })}</section>
    <section className="dashboard-grid">
      <article className="panel production-panel"><div className="panel-head"><div><span className="panel-kicker">LIVE PRODUCTION</span><h2>የማሽን የሥራ ሁኔታ</h2><p>Machine workflow status</p></div><button className="text-button" onClick={() => onView("machines")}>ሁሉን ይመልከቱ <MoveUpRight size={15} /></button></div><div className="machine-strip">{machines.map((machine) => <div className="machine-row" key={machine.id}><div className={`machine-symbol ${machine.status === "Running" ? "running" : ""}`}>{machine.type.includes("Laser") ? <Scissors size={18} /> : machine.type.includes("Printer") ? <Printer size={18} /> : <Command size={18} />}</div><div className="machine-main"><div><strong>{machine.name}</strong><span>{machine.code} · {machine.type}</span></div><div className="progress-rail"><i style={{ width: machine.status === "Running" ? "68%" : "10%" }} /></div></div><div className="machine-status"><span className={`status-dot ${statusTone(machine.status)}`} />{machine.status}<small>{machine.activeJob || "No assigned job"}</small></div><button className="icon-button subtle"><MoreHorizontal size={18} /></button></div>)}</div></article>
      <article className="panel alerts-panel"><div className="panel-head"><div><span className="panel-kicker coral">ATTENTION</span><h2>የቁጥጥር ማሳሰቢያዎች</h2><p>Discrepancies & stock alerts</p></div><CircleAlert className="alert-head-icon" size={20} /></div><div className="alert-list">{lowStock.map((material) => <div className="alert-entry" key={material.id}><span className="alert-icon"><AlertTriangle size={16} /></span><p><strong>{material.name}</strong><span>{formatQuantity(material.quantity, material.unit)} remains · reorder at {formatQuantity(material.reorderAt, material.unit)}</span></p><button onClick={() => onView("inventory")}>Review</button></div>)}{lowStock.length === 0 ? <div className="empty-state">አሁን ላይ የተገኘ የክምችት ማስጠንቀቂያ የለም</div> : null}</div></article>
    </section>
    <section className="dashboard-grid bottom-grid">
      <article className="panel job-panel"><div className="panel-head"><div><span className="panel-kicker">JOB BOARD</span><h2>ንቁ የሥራ ካርዶች</h2><p>Current production queue</p></div><button className="text-button" onClick={() => onView("jobs")}>Open job board <MoveUpRight size={15} /></button></div><div className="job-table"><div className="table-header"><span>JOB / CLIENT</span><span>MACHINE</span><span>MATERIAL</span><span>STATUS</span><span /></div>{jobs.filter((job) => job.status !== "Completed").slice(0, 4).map((job) => { const machine = machines.find((item) => item.id === job.machineId); const material = materials.find((item) => item.id === job.materialId); return <div className="table-row" key={job.id}><div><b>{job.code}</b><span>{job.client} · {job.title}</span></div><span>{machine?.code}</span><span>{material?.name}</span><span className={`status-pill ${statusTone(job.status)}`}>{job.status}</span><button className="icon-button subtle" onClick={() => job.status === "In production" && onComplete(job.id)} aria-label="Complete job"><MoreHorizontal size={18} /></button></div>; })}</div></article>
      <article className="panel materials-panel"><div className="panel-head"><div><span className="panel-kicker">MATERIAL PULSE</span><h2>ከፍተኛ መጠቀም ላይ ያሉ እቃዎች</h2><p>Material utilization</p></div><button className="text-button" onClick={() => onView("inventory")}>Inventory <MoveUpRight size={15} /></button></div><div className="material-pulse">{materials.slice(0, 4).map((material, index) => <div className="pulse-row" key={material.id}><div className={`material-swatch ${material.accent}`}><Box size={15} /></div><p><strong>{material.name}</strong><span>{formatQuantity(material.quantity, material.unit)} on hand</span></p><div className="utilization"><i style={{ width: `${Math.min(100, 30 + index * 17)}%` }} /></div><span>{`${30 + index * 17}%`}</span></div>)}</div></article>
    </section>
  </>;
}

function InventoryView({ materials, lowStock, onStock, onAdd }: { materials: Material[]; lowStock: Material[]; onStock: () => void; onAdd: () => void }) {
  return <section className="panel inventory-panel"><div className="inventory-callout"><div><span className="panel-kicker">STOREKEEPER CONSOLE</span><h2>የመጋዘን መዝገብ</h2><p>Stock is recorded in base units. Roll conversions are applied automatically on entry.</p></div><div><button className="button secondary" onClick={onStock}><ArrowUpRight size={16} />Stock In / Out</button><button className="button primary" onClick={onAdd}><PackagePlus size={16} />New material</button></div></div>{lowStock.length ? <div className="low-stock-banner"><AlertTriangle size={18} /><span><b>{lowStock.length} reorder alert{lowStock.length > 1 ? "s" : ""}</b> require storekeeper attention before the next production cycle.</span></div> : null}<div className="inventory-table"><div className="table-header"><span>MATERIAL</span><span>CATEGORY</span><span>AVAILABLE</span><span>REORDER LEVEL</span><span>STATE</span><span /></div>{materials.map((material) => { const low = material.quantity <= material.reorderAt; return <div className="table-row material-row" key={material.id}><div className="material-name"><span className={`material-swatch ${material.accent}`}><Box size={16} /></span><p><b>{material.name}</b><small>Base unit: {material.unit}{material.rollEquivalent ? ` · 1 roll = ${material.rollEquivalent} ${material.unit}` : ""}</small></p></div><span>{material.category}</span><strong>{formatQuantity(material.quantity, material.unit)}</strong><span>{formatQuantity(material.reorderAt, material.unit)}</span><span className={`status-pill ${low ? "warning" : "success"}`}>{low ? "Reorder" : "Healthy"}</span><button className="icon-button subtle" onClick={onStock}><MoreHorizontal size={18} /></button></div>; })}</div></section>;
}

function JobsView({ jobs, machines, materials, onCreate, onComplete }: { jobs: JobCard[]; machines: Machine[]; materials: Material[]; onCreate: () => void; onComplete: (id: string) => void }) {
  return <section className="jobs-layout"><div className="kanban-head"><p>Production queue <span>{jobs.filter((job) => job.status !== "Completed").length} open cards</span></p><button className="button primary" onClick={onCreate}><Plus size={16} />Create job card</button></div><div className="kanban-board">{(["Queued", "In production", "Completed"] as const).map((status) => <article className="kanban-column" key={status}><div className="kanban-column-head"><h3>{status}</h3><b>{jobs.filter((job) => job.status === status).length}</b></div><div className="job-stack">{jobs.filter((job) => job.status === status).map((job) => { const machine = machines.find((item) => item.id === job.machineId); const material = materials.find((item) => item.id === job.materialId); return <div className="job-card" key={job.id}><div className="job-card-head"><span>{job.code}</span><em className={job.priority.toLowerCase()}>{job.priority}</em></div><h4>{job.title}</h4><p>{job.client}</p><div className="job-card-data"><span><Wrench size={13} />{machine?.code}</span><span><Box size={13} />{formatQuantity(job.quantity, job.unit)}</span></div><div className="job-card-footer"><small>{material?.name}</small>{status === "In production" ? <button onClick={() => onComplete(job.id)}>Complete</button> : null}</div></div>; })}{jobs.filter((job) => job.status === status).length === 0 ? <div className="empty-column">No cards</div> : null}</div></article>)}</div></section>;
}

function MachinesView({ machines, jobs, role, onCreate, onOffcut, onScrap, onComplete }: { machines: Machine[]; jobs: JobCard[]; role: Role; onCreate: () => void; onOffcut: () => void; onScrap: () => void; onComplete: (id: string) => void }) {
  const context: Record<Role, { action: string; detail: string; unit: string }> = {
    admin: { action: "View machine plan", detail: "Monitor every production lane and active allocation.", unit: "Enterprise view" },
    storekeeper: { action: "Issue material", detail: "Confirm issued quantity against the job card and unit rule.", unit: "Store issue mode" },
    laser_operator: { action: "Measure acrylic offcut", detail: "Record usable acrylic or MDF sections in square meters.", unit: "Sheet area · m²" },
    cnc_operator: { action: "Confirm board cut", detail: "Track wood or aluminium sheet output against the assigned job.", unit: "Board area · m²" },
    plotter_operator: { action: "Advance vinyl roll", detail: "Capture roll consumption and plotter output in running meters.", unit: "Roll length · m" },
    printer_operator: { action: "Start print meter", detail: "Record banner usage and print area before final inspection.", unit: "Print area · m²" },
  };
  const focus = context[role];
  const primaryMachine = machines[0];
  const primaryJob = primaryMachine ? jobs.find((job) => job.code === primaryMachine.activeJob) : undefined;
  if (role === "laser_operator" && primaryMachine) return <LaserOperatorWorkspace machine={primaryMachine} job={primaryJob} onComplete={onComplete} onOffcut={onOffcut} onScrap={onScrap} />;
  if (role === "cnc_operator" && primaryMachine) return <CncOperatorWorkspace machine={primaryMachine} job={primaryJob} onComplete={onComplete} onOffcut={onOffcut} onScrap={onScrap} />;
  if (role === "plotter_operator" && primaryMachine) return <PlotterOperatorWorkspace machine={primaryMachine} job={primaryJob} onComplete={onComplete} onOffcut={onOffcut} onScrap={onScrap} />;
  if (role === "printer_operator" && primaryMachine) return <PrinterOperatorWorkspace machine={primaryMachine} job={primaryJob} onComplete={onComplete} onOffcut={onOffcut} onScrap={onScrap} />;
  return <section className="machines-view"><div className="operator-banner"><div><span className="panel-kicker">{role === "admin" || role === "storekeeper" ? "MACHINE WORKFLOW" : "OPERATOR CONSOLE"}</span><h2>{role === "admin" || role === "storekeeper" ? "የማሽን ቁጥጥር ማዕከል" : `${roleLabels[role].am} የሥራ ማዕከል`}</h2><p>{focus.detail}</p></div><div><button className="button secondary" onClick={onScrap}><Trash2 size={16} />Log scrap</button><button className="button primary" onClick={onCreate}><Plus size={16} />Add machine</button></div></div><div className="operator-focus"><span>UNIT MODE</span><strong>{focus.unit}</strong><p>{focus.action}</p><button className="button secondary small" onClick={onOffcut}><Scissors size={15} />{role === "plotter_operator" ? "Log vinyl remainder" : "Log usable offcut"}</button></div><div className="machine-card-grid">{machines.map((machine) => { const job = jobs.find((entry) => entry.code === machine.activeJob); return <article className="machine-card" key={machine.id}><div className="machine-card-top"><span className={`equipment-glyph ${machine.status === "Running" ? "run" : ""}`}>{machine.type.includes("Printer") ? <Printer size={22} /> : machine.type.includes("Laser") ? <Scissors size={22} /> : <Command size={22} />}</span><span className={`status-pill ${statusTone(machine.status)}`}>{machine.status}</span></div><h3>{machine.name}</h3><p>{machine.code} · {machine.type}</p><div className="machine-job-box">{job ? <><small>ACTIVE JOB CARD</small><strong>{job.code}</strong><span>{job.title}</span><div><b>{formatQuantity(job.quantity, job.unit)}</b><em>Due {job.due}</em></div></> : <><small>READY FOR ASSIGNMENT</small><strong>No active job</strong><span>Machine is available for the next card.</span></>}</div><div className="machine-card-actions">{job ? <button className="button primary small" onClick={() => onComplete(job.id)}>Complete job</button> : <button className="button secondary small">{focus.action}</button>}<button className="button tertiary small" onClick={onOffcut}>Offcut</button></div></article>; })}</div></section>;
}

type WorkspaceProps = { machine: Machine; job?: JobCard; onComplete: (id: string) => void; onOffcut: () => void; onScrap: () => void };

function OperatorWorkspaceShell({ machine, job, mode, title, subtitle, children, onComplete, onOffcut, onScrap }: WorkspaceProps & { mode: string; title: string; subtitle: string; children: React.ReactNode }) {
  return <section className={`operator-workspace ${mode}`}><div className="workspace-topline"><span className="panel-kicker">DEDICATED OPERATOR WORKSPACE</span><span className={`status-pill ${statusTone(machine.status)}`}>{machine.status}</span></div><div className="workspace-title"><div><h2>{title}</h2><p>{subtitle}</p></div><div className="machine-identity"><Wrench size={17} /><span><b>{machine.name}</b><small>{machine.code} · {machine.materialUnit} tracking</small></span></div></div><div className="workspace-grid"><article className="operator-job-panel"><span className="panel-kicker">CURRENT JOB CARD</span>{job ? <><strong>{job.code}</strong><h3>{job.title}</h3><p>{job.client}</p><div className="job-quantity"><b>{formatQuantity(job.quantity, job.unit)}</b><span>planned material usage</span></div><button className="button primary full" onClick={() => onComplete(job.id)}>Complete production run <ArrowUpRight size={16} /></button></> : <div className="empty-state">No job is assigned to this machine.</div>}</article><article className="operator-control-panel">{children}</article></div><div className="workspace-foot-actions"><button className="button secondary" onClick={onOffcut}><Scissors size={16} />Log usable remainder</button><button className="button tertiary" onClick={onScrap}><Trash2 size={16} />Log unusable scrap</button></div></section>;
}

function LaserOperatorWorkspace({ machine, job, onComplete, onOffcut, onScrap }: WorkspaceProps) {
  const [area, setArea] = useState(job?.quantity ?? 0); const [kerf, setKerf] = useState("0.20"); const [safeStart, setSafeStart] = useState(false);
  return <OperatorWorkspaceShell machine={machine} job={job} mode="laser" title="Laser cutter control" subtitle="Acrylic and MDF sheet workflow with area, kerf, and offcut controls." onComplete={onComplete} onOffcut={onOffcut} onScrap={onScrap}><span className="panel-kicker">LASER RUN SETUP</span><h3>Sheet cut confirmation</h3><div className="operator-form-grid"><label>Sheet area (m²)<input type="number" value={area} onChange={(event) => setArea(Number(event.target.value))} /></label><label>Kerf width (mm)<input value={kerf} onChange={(event) => setKerf(event.target.value)} /></label></div><label className="control-check"><input type="checkbox" checked={safeStart} onChange={(event) => setSafeStart(event.target.checked)} /> Safe-start and focus height verified</label><div className="control-readout"><Scissors size={17} /><span>Expected reusable remainder</span><b>{Math.max(0, area * 0.12).toFixed(2)} m²</b></div></OperatorWorkspaceShell>;
}

function CncOperatorWorkspace({ machine, job, onComplete, onOffcut, onScrap }: WorkspaceProps) {
  const [boardArea, setBoardArea] = useState(job?.quantity ?? 0); const [tool, setTool] = useState("6mm end mill"); const [passDepth, setPassDepth] = useState("3mm");
  return <OperatorWorkspaceShell machine={machine} job={job} mode="cnc" title="CNC router control" subtitle="Board cutting workspace for wood and aluminium sheet operations." onComplete={onComplete} onOffcut={onOffcut} onScrap={onScrap}><span className="panel-kicker">CNC CUT PARAMETERS</span><h3>Board preparation</h3><div className="operator-form-grid"><label>Board area (m²)<input type="number" value={boardArea} onChange={(event) => setBoardArea(Number(event.target.value))} /></label><label>Tool profile<select value={tool} onChange={(event) => setTool(event.target.value)}><option>6mm end mill</option><option>3mm end mill</option><option>V-bit 90°</option></select></label></div><label>Pass depth<select value={passDepth} onChange={(event) => setPassDepth(event.target.value)}><option>3mm</option><option>6mm</option><option>9mm</option></select></label><div className="control-readout"><Command size={17} /><span>Calculated routing passes</span><b>{Math.max(1, Math.ceil(boardArea / 2.5))}</b></div></OperatorWorkspaceShell>;
}

function PlotterOperatorWorkspace({ machine, job, onComplete, onOffcut, onScrap }: WorkspaceProps) {
  const [length, setLength] = useState(job?.quantity ?? 0); const [pressure, setPressure] = useState("18"); const [weedTest, setWeedTest] = useState(false);
  return <OperatorWorkspaceShell machine={machine} job={job} mode="plotter" title="Vinyl plotter control" subtitle="Running-meter workflow for sticker and vinyl cutting, weeding, and roll remainder tracking." onComplete={onComplete} onOffcut={onOffcut} onScrap={onScrap}><span className="panel-kicker">PLOTTER RUN SETUP</span><h3>Roll and contour settings</h3><div className="operator-form-grid"><label>Vinyl length (m)<input type="number" value={length} onChange={(event) => setLength(Number(event.target.value))} /></label><label>Contour pressure<input value={pressure} onChange={(event) => setPressure(event.target.value)} /></label></div><label className="control-check"><input type="checkbox" checked={weedTest} onChange={(event) => setWeedTest(event.target.checked)} /> Weed test passed before full run</label><div className="control-readout"><Scissors size={17} /><span>Estimated roll remainder</span><b>{Math.max(0, 50 - length).toFixed(1)} m</b></div></OperatorWorkspaceShell>;
}

function PrinterOperatorWorkspace({ machine, job, onComplete, onOffcut, onScrap }: WorkspaceProps) {
  const [area, setArea] = useState(job?.quantity ?? 0); const [passes, setPasses] = useState("6-pass"); const [inkCheck, setInkCheck] = useState(false);
  return <OperatorWorkspaceShell machine={machine} job={job} mode="printer" title="Large-format print control" subtitle="Banner print-area workflow with pass-profile, ink readiness, and trim remainder checks." onComplete={onComplete} onOffcut={onOffcut} onScrap={onScrap}><span className="panel-kicker">PRINT RUN SETUP</span><h3>Media and ink readiness</h3><div className="operator-form-grid"><label>Print area (m²)<input type="number" value={area} onChange={(event) => setArea(Number(event.target.value))} /></label><label>Pass profile<select value={passes} onChange={(event) => setPasses(event.target.value)}><option>4-pass</option><option>6-pass</option><option>8-pass</option></select></label></div><label className="control-check"><input type="checkbox" checked={inkCheck} onChange={(event) => setInkCheck(event.target.checked)} /> Ink levels and nozzle check confirmed</label><div className="control-readout"><Printer size={17} /><span>Media feed estimate</span><b>{(area / 3.2).toFixed(1)} m</b></div></OperatorWorkspaceShell>;
}

function OffcutsView({ offcuts, scraps, onCreate, onScrap }: { offcuts: Offcut[]; scraps: ScrapLog[]; onCreate: () => void; onScrap: () => void }) {
  const scrapTotal = scraps.reduce((total, scrap) => total + scrap.quantity, 0);
  return <section className="offcut-layout"><div className="offcut-hero"><div className="offcut-icon"><Scissors size={25} /></div><div><span className="panel-kicker">RECOVERY INVENTORY</span><h2>ሊጠቀሙበት የሚችሉ ቅሪት እቃዎች</h2><p>Reusable sheet pieces are returned to active store stock automatically.</p></div><div className="recovery-actions"><button className="button secondary" onClick={onScrap}><Trash2 size={16} />Log scrap</button><button className="button primary" onClick={onCreate}><Scissors size={16} />Log new offcut</button></div></div><div className="offcut-grid">{offcuts.map((offcut) => <article className="offcut-card" key={offcut.id}><div className="offcut-preview"><i style={{ width: `${Math.min(100, offcut.width * 55)}%`, height: `${Math.min(100, offcut.length * 55)}%` }} /></div><div className="offcut-data"><div><span className="status-pill success">Available</span><small>{offcut.createdAt}</small></div><h3>{offcut.label}</h3><p>{offcut.width}m × {offcut.length}m <b>{offcut.area} m²</b></p><footer><span><Store size={14} />{offcut.location}</span><button className="icon-button subtle"><MoreHorizontal size={17} /></button></footer></div></article>)}</div><article className="scrap-panel"><div><span className="panel-kicker coral">WASTE CONTROL</span><h3>Unusable scrap register</h3><p>Separate from reusable offcuts and included in the live wastage metric.</p></div><strong>{scrapTotal.toFixed(1)} <small>logged units</small></strong><button className="button secondary small" onClick={onScrap}>Record scrap</button>{scraps.length ? <div className="scrap-list">{scraps.slice(0, 3).map((scrap) => <span key={scrap.id}><Trash2 size={13} /><b>{scrap.label}</b> · {formatQuantity(scrap.quantity, scrap.unit)} · {scrap.reason}</span>)}</div> : <div className="scrap-list empty">No unusable scrap logged in this session.</div>}</article></section>;
}

function RoleRail({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="role-rail"><button className="role-switcher" onClick={() => setOpen(!open)}><UserRound size={17} /><span>{roleLabels[role].am}<small>{roleLabels[role].en}</small></span><ChevronDown size={15} /></button>{open ? <div className="role-popover">{(Object.keys(roleLabels) as Role[]).map((key) => <button key={key} className={key === role ? "selected" : ""} onClick={() => { onChange(key); setOpen(false); }}><span className="avatar mini">{roleLabels[key].initial}</span><span>{roleLabels[key].am}<small>{roleLabels[key].en}</small></span></button>)}</div> : null}</div>;
}

function ModalShell({ title, subtitle, step, children, onClose }: { title: string; subtitle: string; step?: number; children: React.ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card"><div className="modal-head"><div><span className="panel-kicker">{step ? `STEP ${step} OF 3` : "OPERATIONS ENTRY"}</span><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Close modal"><X size={20} /></button></div>{step ? <div className="step-dots"><i className="filled" /><i className={step > 1 ? "filled" : ""} /><i className={step > 2 ? "filled" : ""} /></div> : null}{children}</div></div>;
}

function StockModal({ materials, onClose, onSave }: { materials: Material[]; onClose: () => void; onSave: (materialId: string, direction: "in" | "out", quantity: number, inputUnit: "roll" | "sheet" | Unit, note: string) => void }) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? ""); const [direction, setDirection] = useState<"in" | "out">("in"); const [quantity, setQuantity] = useState(1); const [inputUnit, setInputUnit] = useState<"roll" | "sheet" | Unit>("roll"); const [note, setNote] = useState(""); const material = materials.find((entry) => entry.id === materialId); const canRoll = Boolean(material?.rollEquivalent); const canSheet = Boolean(material?.sheetEquivalent); const converted = material ? (() => { try { return convertToBase(quantity, inputUnit, material.unit, material.rollEquivalent, material.sheetEquivalent); } catch { return 0; } })() : 0;
  return <ModalShell title="Stock movement" subtitle="Record stock in or out with roll and sheet conversions into the tracked base unit." onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave(materialId, direction, quantity, inputUnit, note); }}><div className="choice-row"><button type="button" className={direction === "in" ? "selected in" : ""} onClick={() => setDirection("in")}><ArrowDownRight size={18} />Stock In</button><button type="button" className={direction === "out" ? "selected out" : ""} onClick={() => setDirection("out")}><ArrowUpRight size={18} />Stock Out</button></div><label>Material<select value={materialId} onChange={(event) => { const next = materials.find((entry) => entry.id === event.target.value); setMaterialId(event.target.value); setInputUnit(next?.rollEquivalent ? "roll" : next?.sheetEquivalent ? "sheet" : next?.unit ?? "m²"); }}>{materials.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><div className="two-field"><label>Quantity<input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label>Entry unit<select value={inputUnit} onChange={(event) => setInputUnit(event.target.value as "roll" | "sheet" | Unit)}>{canRoll ? <option value="roll">Roll</option> : null}{canSheet ? <option value="sheet">Sheet</option> : null}<option value={material?.unit}>{material?.unit}</option></select></label></div><div className="conversion-box"><Sparkles size={17} /><span>Auto conversion</span><strong>{formatQuantity(converted, material?.unit ?? "m²")}</strong></div><label>Reference note<input placeholder="Supplier, job card, or issue reason" value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="button primary full" type="submit">Save stock movement <ArrowUpRight size={16} /></button></form></ModalShell>;
}

function JobModal({ materials, machines, onClose, onSave }: { materials: Material[]; machines: Machine[]; onClose: () => void; onSave: (job: JobCard) => void }) {
  const [step, setStep] = useState(1); const [client, setClient] = useState(""); const [title, setTitle] = useState(""); const [machineId, setMachineId] = useState(machines[0]?.id ?? ""); const [materialId, setMaterialId] = useState(materials[0]?.id ?? ""); const [quantity, setQuantity] = useState(1); const machine = machines.find((entry) => entry.id === machineId); const material = materials.find((entry) => entry.id === materialId);
  return <ModalShell title="Create job card" subtitle="Link order, machinery, and material deduction in one workflow." step={step} onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (step < 3) { setStep(step + 1); return; } const id = `job-${Date.now()}`; onSave({ id, code: `JC-${String(Math.floor(430 + Math.random() * 500)).padStart(4, "0")}`, client: client || "Walk-in client", title: title || "Untitled production job", machineId, materialId, quantity, unit: material?.unit ?? "m²", status: "Queued", due: "Newly scheduled", priority: "Normal" }); }}>
  {step === 1 ? <><label>Client / order owner<input autoFocus placeholder="e.g. Addis Breweries" value={client} onChange={(event) => setClient(event.target.value)} /></label><label>Job description<input placeholder="e.g. Building facade branding" value={title} onChange={(event) => setTitle(event.target.value)} /></label></> : null}
  {step === 2 ? <><label>Assigned machine<select value={machineId} onChange={(event) => setMachineId(event.target.value)}>{machines.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {entry.code}</option>)}</select></label><div className="assignment-preview"><Wrench size={18} /><div><strong>{machine?.name}</strong><span>Tracks consumption in {machine?.materialUnit} for this workflow</span></div></div></> : null}
  {step === 3 ? <><label>Raw material<select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>{materials.map((entry) => <option value={entry.id} key={entry.id}>{entry.name} · {formatQuantity(entry.quantity, entry.unit)}</option>)}</select></label><label>Planned material usage ({material?.unit})<input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><div className="conversion-box"><Box size={17} /><span>Available after job</span><strong>{material ? formatQuantity(Math.max(0, material.quantity - quantity), material.unit) : "—"}</strong></div></> : null}
  <div className="modal-actions"><button type="button" className="button tertiary" onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</button><button className="button primary" type="submit">{step === 3 ? "Create job card" : "Continue"} <ArrowUpRight size={16} /></button></div></form></ModalShell>;
}

function OffcutModal({ materials, onClose, onSave }: { materials: Material[]; onClose: () => void; onSave: (offcut: Offcut) => void }) {
  const sheetMaterials = materials.filter((material) => material.unit === "m²"); const [materialId, setMaterialId] = useState(sheetMaterials[0]?.id ?? ""); const [width, setWidth] = useState(1); const [length, setLength] = useState(0.5); const [location, setLocation] = useState("Rack B · Slot 01"); const material = materials.find((entry) => entry.id === materialId); const area = calculateOffcutArea(width, length);
  return <ModalShell title="Log usable offcut" subtitle="Return a reusable sheet piece to active inventory and a physical rack location." onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (!material) return; onSave({ id: `off-${Date.now()}`, materialId, label: material.name, width, length, area, location, createdAt: "Just now" }); }}><label>Sheet material<select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>{sheetMaterials.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label><div className="two-field"><label>Width (m)<input type="number" min="0.1" step="0.1" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label>Length (m)<input type="number" min="0.1" step="0.1" value={length} onChange={(event) => setLength(Number(event.target.value))} /></label></div><div className="conversion-box"><Scissors size={17} /><span>Usable area returned</span><strong>{area} m²</strong></div><label>Rack location<input value={location} onChange={(event) => setLocation(event.target.value)} /></label><button className="button primary full" type="submit">Return to active inventory <ArrowUpRight size={16} /></button></form></ModalShell>;
}

function MaterialModal({ onClose, onSave }: { onClose: () => void; onSave: (material: Material) => void }) {
  const [name, setName] = useState(""); const [unit, setUnit] = useState<Unit>("m²"); const [quantity, setQuantity] = useState(0); const [reorderAt, setReorderAt] = useState(0); const [rollEquivalent, setRollEquivalent] = useState(160); const [sheetEquivalent, setSheetEquivalent] = useState(2.98);
  return <ModalShell title="Add raw material" subtitle="Create a new trackable material with roll and sheet-to-base conversion rules." onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave({ id: `mat-${Date.now()}`, name: name || "New material", category: "Custom", unit, quantity, reorderAt, rollEquivalent: unit === "m²" || unit === "m" ? rollEquivalent : undefined, sheetEquivalent: unit === "m²" ? sheetEquivalent : undefined, accent: "cyan" }); }}><label>Material name<input autoFocus required placeholder="e.g. Dibond 3mm" value={name} onChange={(event) => setName(event.target.value)} /></label><div className="two-field"><label>Base unit<select value={unit} onChange={(event) => setUnit(event.target.value as Unit)}>{unitOptions.map((option) => <option key={option}>{option}</option>)}</select></label><label>Opening quantity<input type="number" min="0" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label></div><div className="two-field"><label>Reorder level<input type="number" min="0" step="0.1" value={reorderAt} onChange={(event) => setReorderAt(Number(event.target.value))} /></label>{unit === "m²" || unit === "m" ? <label>1 roll converts to<input type="number" min="0" step="0.1" value={rollEquivalent} onChange={(event) => setRollEquivalent(Number(event.target.value))} /></label> : <span />}</div>{unit === "m²" ? <label>1 standard sheet converts to (m²)<input type="number" min="0" step="0.01" value={sheetEquivalent} onChange={(event) => setSheetEquivalent(Number(event.target.value))} /></label> : null}<button className="button primary full" type="submit">Add material <Plus size={16} /></button></form></ModalShell>;
}

function ScrapModal({ materials, onClose, onSave }: { materials: Material[]; onClose: () => void; onSave: (scrap: ScrapLog) => void }) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? ""); const [quantity, setQuantity] = useState(0.2); const [reason, setReason] = useState("Misprint / trim loss"); const material = materials.find((entry) => entry.id === materialId);
  return <ModalShell title="Log unusable scrap" subtitle="Record non-recoverable waste separately so the wastage metric and discrepancy view remain accurate." onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (!material) return; onSave({ id: `scrap-${Date.now()}`, materialId, label: material.name, quantity, unit: material.unit, reason, createdAt: "Just now" }); }}><label>Material<select value={materialId} onChange={(event) => setMaterialId(event.target.value)}>{materials.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label><label>Unusable quantity ({material?.unit})<input type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><label>Waste reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="conversion-box"><Trash2 size={17} /><span>Wastage register</span><strong>{formatQuantity(quantity, material?.unit ?? "m²")}</strong></div><button className="button primary full" type="submit">Save scrap record <ArrowUpRight size={16} /></button></form></ModalShell>;
}

function MachineModal({ onClose, onSave }: { onClose: () => void; onSave: (machine: Machine) => void }) {
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [role, setRole] = useState<Role>("laser_operator"); const [unit, setUnit] = useState<Unit>("m²");
  return <ModalShell title="Add production machine" subtitle="Attach an unlimited number of machines to a dedicated operator workflow." onClose={onClose}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); onSave({ id: `machine-${Date.now()}`, name: name || "New machine", code: code || "NEW-01", type: "Custom production machine", operatorRole: role, materialUnit: unit, status: "Available" }); }}><label>Machine name<input autoFocus required placeholder="e.g. UV Flatbed 2513" value={name} onChange={(event) => setName(event.target.value)} /></label><label>Machine code<input required placeholder="e.g. UV-01" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label><div className="two-field"><label>Assigned operator<select value={role} onChange={(event) => setRole(event.target.value as Role)}>{(["laser_operator", "cnc_operator", "plotter_operator", "printer_operator"] as Role[]).map((option) => <option value={option} key={option}>{roleLabels[option].en}</option>)}</select></label><label>Consumption unit<select value={unit} onChange={(event) => setUnit(event.target.value as Unit)}>{unitOptions.map((option) => <option key={option}>{option}</option>)}</select></label></div><button className="button primary full" type="submit">Add machine <Plus size={16} /></button></form></ModalShell>;
}
