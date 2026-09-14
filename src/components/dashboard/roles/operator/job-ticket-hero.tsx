"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  Maximize2,
  Pause,
  Play,
  Scissors,
  Tag,
  Trash2,
  X,
  Phone,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { SubstrateMatchInfo } from "@/convex/operator/overview";
import { NumericInput, StatusPill } from "@/components/shared/ui";
import { formatQuantity } from "@/lib/units";

interface JobTicketHeroProps {
  job: {
    id: string;
    code: string;
    title: string;
    client: string;
    clientPhone?: string;
    quantity: number;
    unit: string;
    status: string;
    priority?: string;
    due?: string;
    orderDueTimestamp?: number;
    dimensions?: string;
    orderLength?: number;
    orderWidth?: number;
    length?: number;
    width?: number;
    serviceType?: string;
    specifications?: Record<string, string>;
    notes?: string;
    artworkUrl?: string | null;
    fileName?: string;
    attachmentUrls?: Array<{ name: string; url: string | null }>;
    substrateMatch?: SubstrateMatchInfo;
    startedAt?: number;
    pausedAt?: number;
    pauseReason?: string;
  };
  requirements: Array<{
    _id: string;
    materialName: string;
    materialUnit: string;
    plannedBaseQuantity: number;
    approvedScrapQuantity: number;
    consumedBaseQuantity?: number;
    status: string;
  }>;
  machineSlug: string;
  machine: {
    id: string;
    name: string;
    status: string;
    materialUnit?: string;
  };
  isOverdue: boolean;
  hasPendingClearance: boolean;
  onStartJob: () => Promise<void>;
  onPauseJob: (reason: string) => Promise<void>;
  onCompleteJob: () => Promise<void>;
  onRecordProduction: (input: number, output: number, waste: number) => Promise<void>;
  onOpenOffcutModal: () => void;
  onOpenScrapModal: () => void;
  isActionPending: (key: string) => boolean;
}

const QUICK_PAUSE_REASONS = [
  "የህትመት ራስ ማጽዳት (Head Cleaning / Purge)",
  "ጥሬ እቃ ማስተካከል / መቀየር (Material Jam / Roll Change)",
  "ቀለም መሙላት (Refilling Ink)",
  "የደንበኛ ማረጋገጫ በመጠባበቅ ላይ (Waiting Customer Confirmation)",
  "የሺፍት ቅያሬ (Shift Handover)",
];

export function JobTicketHero({
  job,
  requirements,
  machineSlug,
  machine,
  isOverdue,
  hasPendingClearance,
  onStartJob,
  onPauseJob,
  onCompleteJob,
  onRecordProduction,
  onOpenOffcutModal,
  onOpenScrapModal,
  isActionPending,
}: JobTicketHeroProps) {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseCustomReason, setPauseCustomReason] = useState("");
  const [showManualLogger, setShowManualLogger] = useState(false);

  // Manual logging state
  const [inputQuantity, setInputQuantity] = useState(String(job.quantity));
  const [outputQuantity, setOutputQuantity] = useState(String(job.quantity));
  const [wasteQuantity, setWasteQuantity] = useState("0");
  const [productionInputsValid, setProductionInputsValid] = useState({
    input: true,
    output: true,
    waste: true,
  });

  const isCompleted = job.status === "Completed";
  const isInProduction = job.status === "In production";
  const isPaused = job.status === "Paused";

  const inputNum = Number(inputQuantity);
  const outputNum = Number(outputQuantity);
  const wasteNum = Number(wasteQuantity);
  const hasCrossFieldDraft = inputNum > 0 || outputNum > 0 || wasteNum > 0;
  const outputExceedsInput =
    hasCrossFieldDraft && outputNum > 0 && inputNum > 0 && outputNum > inputNum;
  const inputExceedsTotal =
    hasCrossFieldDraft && inputNum > 0 && outputNum + wasteNum > inputNum;

  const priorityTone: Record<string, string> = {
    High: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    Medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    Low: "bg-slate-700/40 text-slate-300 border-slate-600/50",
  };

  const priorityLabel: Record<string, string> = {
    High: "ከፍተኛ (High)",
    Medium: "መካከለኛ (Normal)",
    Low: "ዝቅተኛ (Low)",
  };

  const isPending =
    isActionPending(`start-${job.id}`) ||
    isActionPending(`pause-${job.id}`) ||
    isActionPending(`complete-${job.id}`) ||
    isActionPending(`prod-${job.id}`);

  // Quick preset scrap increment
  const handleQuickScrapPreset = async (additionalWaste: number) => {
    const currentWaste = Number(wasteQuantity) || 0;
    const newWaste = Number((currentWaste + additionalWaste).toFixed(2));
    setWasteQuantity(String(newWaste));
    const currentInput = Number(inputQuantity) || job.quantity;
    const newGoodOutput = Math.max(0, Number((currentInput - newWaste).toFixed(2)));
    setOutputQuantity(String(newGoodOutput));
    await onRecordProduction(currentInput, newGoodOutput, newWaste);
  };

  const match = job.substrateMatch;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0E121A] p-5 shadow-2xl shadow-black/50 space-y-5">
      {/* 1. Header: Job Ticket Identifier & Critical Flags */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs px-2.5 py-1 rounded bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/30 font-bold tracking-wider">
            ሥራ ካርድ #{job.code}
          </span>
          <StatusPill
            variant={
              isInProduction
                ? "info"
                : isCompleted
                  ? "success"
                  : isPaused
                    ? "warning"
                    : "neutral"
            }
          >
            {job.status}
          </StatusPill>
          {job.priority ? (
            <span
              className={`inline-flex items-center rounded px-2.5 py-0.5 text-xs font-semibold border ${
                priorityTone[job.priority] ?? priorityTone.Medium
              }`}
            >
              {priorityLabel[job.priority] ?? job.priority}
            </span>
          ) : null}
          {isOverdue ? (
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
              <Clock size={12} /> ጊዜ ያለፈበት (Overdue)
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">
              የሚመረተው መጠን
            </span>
            <span className="font-mono text-xl font-extrabold text-white">
              {formatQuantity(job.quantity, (job.unit as any) ?? "m²")}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Body: Artwork Preview & Job Specifications Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column (Artwork & RIP File) */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-lg border border-slate-800 bg-[#090B0F] p-3.5 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Layers size={13} className="text-[#00B4D8]" /> የሕትመት ፋይል (Artwork)
              </span>
              {job.fileName ? (
                <span className="truncate max-w-[120px] text-[10px] text-slate-500" title={job.fileName}>
                  {job.fileName}
                </span>
              ) : null}
            </div>

            {/* Artwork Thumbnail / Preview Box */}
            {job.artworkUrl ? (
              <div className="relative group rounded-md overflow-hidden border border-slate-800 bg-black/40 aspect-[4/3] flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={job.artworkUrl}
                  alt={job.title}
                  className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="p-2 rounded-full bg-slate-800/90 text-white hover:bg-slate-700 transition-colors shadow-lg"
                    title="ሙሉ እይታ (View full artwork)"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <a
                    href={job.artworkUrl}
                    download={job.fileName ?? `${job.code}-artwork`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-full bg-[#00B4D8] text-[#0B132B] hover:bg-[#90E0EF] transition-colors shadow-lg font-bold"
                    title="ለ RIP ፋይል አውርድ"
                  >
                    <Download size={16} />
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-slate-800 bg-slate-900/30 aspect-[4/3] flex flex-col items-center justify-center text-center p-4 text-slate-500">
                <FileText size={32} className="text-slate-600 mb-1" />
                <span className="text-xs">የህትመት ፋይል አልተጫነም</span>
                <span className="text-[10px] text-slate-600 mt-0.5">ከሪሴፕሽን ወይም ትእዛዝ ያረጋግጡ</span>
              </div>
            )}
          </div>

          {/* Direct RIP Download Action Button */}
          {job.artworkUrl ? (
            <a
              href={job.artworkUrl}
              download={job.fileName ?? `${job.code}-artwork`}
              target="_blank"
              rel="noreferrer"
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-md bg-[#00B4D8] hover:bg-[#90E0EF] text-[#07131F] font-bold text-xs tracking-wide transition-all shadow-md shadow-[#00B4D8]/10 active:scale-[0.98]"
            >
              <Download size={16} /> ለ RIP አውርድ (Download Print File)
            </a>
          ) : null}

          {/* Attachment list if proofs or cut vectors exist */}
          {job.attachmentUrls && job.attachmentUrls.length > 0 ? (
            <div className="pt-2 border-t border-slate-800/60 space-y-1">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">ተያያዥ ፋይሎች:</span>
              <div className="flex flex-wrap gap-1.5">
                {job.attachmentUrls.map((att, idx) =>
                  att.url ? (
                    <a
                      key={idx}
                      href={att.url}
                      download={att.name}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-mono transition-colors"
                    >
                      <Download size={10} /> {att.name}
                    </a>
                  ) : null
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column (Specifications, Notes, Substrate Pre-Flight) */}
        <div className="lg:col-span-8 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {/* Title, Client & Dimensions */}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-[#00B4D8]">
                  {job.serviceType ?? "የህትመት ሥራ"}
                </span>
                {job.orderDueTimestamp ? (
                  <span className="text-xs text-slate-400 font-mono">
                    የማስረከቢያ ቀን: {new Date(job.orderDueTimestamp).toLocaleDateString("en-GB")}
                  </span>
                ) : null}
              </div>
              <h2 className="text-xl font-bold text-white mt-1 leading-snug">{job.title}</h2>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                <span>ደንበኛ: <strong className="text-slate-200">{job.client}</strong></span>
                {job.clientPhone ? (
                  <a
                    href={`tel:${job.clientPhone}`}
                    className="inline-flex items-center gap-1 text-[#00B4D8] hover:underline"
                  >
                    <Phone size={11} /> {job.clientPhone}
                  </a>
                ) : null}
              </div>
            </div>

            {/* Dimension & Area Highlight Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-lg border border-slate-800 bg-[#090B0F]">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">ስፋት እና ቁመት</span>
                <span className="font-mono text-sm font-bold text-white">
                  {job.dimensions ??
                    (job.length && job.width ? `${job.length}m × ${job.width}m` : "—")}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-mono block">ብዛት (Quantity)</span>
                <span className="font-mono text-sm font-bold text-white">
                  {job.quantity} {job.unit}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">የማሽን መለኪያ</span>
                <span className="font-mono text-sm font-bold text-[#00B4D8]">
                  {machine.materialUnit ?? "m²"}
                </span>
              </div>
            </div>

            {/* Finishing Specifications Tags */}
            {job.specifications && Object.keys(job.specifications).length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase text-slate-400 block flex items-center gap-1">
                  <Tag size={11} /> ማጠናቀቂያና ዝርዝር መስፈርቶች (Specifications):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(job.specifications).map(([key, val]) => (
                    <span
                      key={key}
                      className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-200"
                    >
                      <strong className="text-slate-400 font-normal">{key}:</strong> {val}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Special Operator / Customer Notes */}
            {job.notes ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-2.5 text-xs text-amber-200/90 flex items-start gap-2">
                <AlertTriangle size={14} className="flex-none text-amber-400 mt-0.5" />
                <div>
                  <strong className="text-amber-300 font-semibold block text-[11px]">የደንበኛ / የሪሴፕሽን ማስታወሻ:</strong>
                  <p className="mt-0.5">{job.notes}</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* 3. Pre-Flight Substrate Match Status Banner */}
          {match ? (
            <div
              className={`rounded-lg p-3 border text-xs flex items-center justify-between gap-3 ${
                match.status === "MATCHED"
                  ? "border-emerald-500/40 bg-emerald-950/25 text-emerald-200"
                  : match.status === "ROLL_CHANGE_REQUIRED"
                    ? "border-amber-500/40 bg-amber-950/25 text-amber-200"
                    : "border-rose-500/40 bg-rose-950/25 text-rose-200"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`p-1.5 rounded-full flex-none ${
                    match.status === "MATCHED"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : match.status === "ROLL_CHANGE_REQUIRED"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-rose-500/20 text-rose-400"
                  }`}
                >
                  {match.status === "MATCHED" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertTriangle size={16} />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-sm block">
                    {match.status === "MATCHED"
                      ? "ጥሬ እቃ ተገጥሟል (Substrate Ready)"
                      : match.status === "ROLL_CHANGE_REQUIRED"
                        ? "ሮል / ጥሬ እቃ መቀየር ያስፈልጋል (Roll Change Required)"
                        : "በማሽኑ ላይ ጥሬ እቃ አልተመዘገበም (No Substrate Loaded)"}
                  </span>
                  <p className="text-[11px] opacity-90 truncate">
                    {match.status === "MATCHED"
                      ? `በማሽኑ ላይ: ${match.materialName} · ${match.remaining} ${match.unit} አለ`
                      : match.status === "ROLL_CHANGE_REQUIRED"
                        ? `የሚፈለገው: ${match.requiredMaterialName} · አሁን የተጫነው: ${match.loadedMaterialName} (${match.loadedRemaining} ${match.unit})`
                        : `ይህ ሥራ ${match.requiredMaterialName} ይፈልጋል`}
                  </p>
                </div>
              </div>

              {match.status === "MATCHED" ? (
                <span className="flex-none px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                  ተዘጋጅቷል (READY)
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* 4. Action Cockpit: Big-Touch Physical Controls */}
      <div className="pt-2 border-t border-slate-800 space-y-3">
        {isCompleted ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 text-center text-sm text-emerald-200 font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> ይህ የስራ ካርድ ተጠናቋል። የምርት መረጃ ተመዝግቧል።
          </div>
        ) : (
          <div className="space-y-3">
            {/* Primary Action Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Left State Controls */}
              <div className="flex items-center gap-2">
                {!isInProduction ? (
                  <button
                    type="button"
                    disabled={isPending || hasPendingClearance}
                    onClick={() => void onStartJob()}
                    className="h-12 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-sm tracking-wide inline-flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={18} /> ሥራ ጀምር (Start Production)
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setShowPauseDialog(true)}
                    className="h-12 px-5 rounded-lg border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/50 text-amber-200 font-semibold text-xs inline-flex items-center gap-2 transition-colors active:scale-[0.98]"
                  >
                    <Pause size={16} /> ለጊዜው አቁም (Pause Job)
                  </button>
                )}

                {isInProduction ? (
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    ማሽኑ በስራ ላይ ነው (Running)
                  </span>
                ) : isPaused ? (
                  <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono">
                    ሥራው ቆሟል: {job.pauseReason ?? "በኦፕሬተር ምክንያት"}
                  </span>
                ) : null}
              </div>

              {/* Right Fast Complete Action */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void onCompleteJob()}
                  className="h-12 px-6 rounded-lg bg-[#38B000] hover:bg-[#2D8B00] active:scale-[0.98] text-white font-bold text-sm inline-flex items-center gap-2 transition-all shadow-lg shadow-green-950/40 disabled:opacity-50"
                  title="ሙሉ በሙሉ በጥሩ ሁኔታ ተጠናቋል"
                >
                  <CheckCircle2 size={18} /> ሙሉ በሙሉ አጠናቅ ({job.quantity} {job.unit})
                </button>

                <button
                  type="button"
                  onClick={() => setShowManualLogger((prev) => !prev)}
                  className="h-12 px-3.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  title="ዝርዝር የምርት መረጃ እና ብክነት መዝግብ"
                >
                  {showManualLogger ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  ዝርዝር መዝግብ
                </button>
              </div>
            </div>

            {/* Quick Scrap Presets & Remainder Logging Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono text-[11px]">ፈጣን ብክነት (Quick Waste):</span>
                <button
                  type="button"
                  onClick={() => void handleQuickScrapPreset(0.2)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono transition-colors"
                >
                  +0.2 {job.unit} Lead-in
                </button>
                <button
                  type="button"
                  onClick={() => void handleQuickScrapPreset(0.5)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-mono transition-colors"
                >
                  +0.5 {job.unit} Side Trim
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenOffcutModal}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors"
                >
                  <Scissors size={12} className="text-[#00B4D8]" /> ጥቅም ላይ የሚውል ቀሪ ዕቃ (Off-cut)
                </button>
                <button
                  type="button"
                  onClick={onOpenScrapModal}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-300 text-[11px] font-semibold transition-colors"
                >
                  <Trash2 size={12} className="text-rose-400" /> የማይጠቅም ብክነት (Scrap)
                </button>
              </div>
            </div>

            {/* Collapsible Detailed Production Logger */}
            {showManualLogger ? (
              <div className="p-4 rounded-lg border border-slate-800 bg-[#090B0F] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-[#00B4D8]">
                    ዝርዝር የምርት እና ብክነት ምዝገባ ({job.unit})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    የታቀደ መጠን: <strong className="text-white font-mono">{job.quantity} {job.unit}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">የገባ ዕቃ (Input)</label>
                    <NumericInput
                      min={0}
                      step="0.1"
                      value={inputQuantity}
                      onChange={setInputQuantity}
                      onValidityChange={(isValid) =>
                        setProductionInputsValid((curr) => ({ ...curr, input: isValid }))
                      }
                      className="w-full h-10 px-3 rounded border border-slate-700 bg-slate-900 text-sm font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ጥሩ ውጤት (Good Output)</label>
                    <NumericInput
                      min={0}
                      step="0.1"
                      value={outputQuantity}
                      onChange={setOutputQuantity}
                      onValidityChange={(isValid) =>
                        setProductionInputsValid((curr) => ({ ...curr, output: isValid }))
                      }
                      className="w-full h-10 px-3 rounded border border-slate-700 bg-slate-900 text-sm font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">ብክነት (Waste/Scrap)</label>
                    <NumericInput
                      min={0}
                      step="0.1"
                      value={wasteQuantity}
                      onChange={setWasteQuantity}
                      onValidityChange={(isValid) =>
                        setProductionInputsValid((curr) => ({ ...curr, waste: isValid }))
                      }
                      className="w-full h-10 px-3 rounded border border-slate-700 bg-slate-900 text-sm font-mono text-white focus:outline-none focus:border-[#00B4D8]"
                    />
                  </div>
                </div>

                {outputExceedsInput || inputExceedsTotal ? (
                  <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
                    <AlertTriangle size={14} className="mt-0.5 flex-none" />
                    <span>
                      {outputExceedsInput
                        ? "የተመዘገበው ውጤት ከገባው ዕቃ ይበልጣል። እባክዎን ይመልከቱ። "
                        : ""}
                      {inputExceedsTotal
                        ? "የገባ ዕቃ ከውጤት እና ብክነት ድምር ያነሰ ነው።"
                        : ""}
                    </span>
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isPending || outputExceedsInput || inputExceedsTotal}
                    onClick={() =>
                      void onRecordProduction(
                        Number(inputQuantity) || job.quantity,
                        Number(outputQuantity) || job.quantity,
                        Number(wasteQuantity) || 0
                      )
                    }
                    className="h-9 px-4 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                  >
                    መረጃውን ብቻ አስቀምጥ (Save Draft)
                  </button>
                  <button
                    type="button"
                    disabled={isPending || outputExceedsInput || inputExceedsTotal}
                    onClick={async () => {
                      await onRecordProduction(
                        Number(inputQuantity) || job.quantity,
                        Number(outputQuantity) || job.quantity,
                        Number(wasteQuantity) || 0
                      );
                      await onCompleteJob();
                    }}
                    className="h-9 px-4 rounded bg-[#38B000] hover:bg-[#2D8B00] text-xs font-bold text-white transition-colors"
                  >
                    በዚህ መረጃ አጠናቅ (Complete with Log)
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Artwork Lightbox Zoom Modal */}
      {showPreviewModal && job.artworkUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative max-w-4xl max-h-[90vh] w-full rounded-xl border border-slate-800 bg-[#0E121A] p-4 flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-mono text-sm font-bold text-white">
                {job.code} · {job.title}
              </span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>
            <div className="my-4 max-h-[70vh] overflow-auto flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={job.artworkUrl}
                alt={job.title}
                className="max-h-[68vh] object-contain rounded"
              />
            </div>
            <div className="w-full flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-mono">
                {job.dimensions ?? "መጠን ያልተገለጸ"}
              </span>
              <a
                href={job.artworkUrl}
                download={job.fileName ?? `${job.code}-artwork`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-md bg-[#00B4D8] text-[#07131F] font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Download size={14} /> ፋይሉን አውርድ
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* Quick Pause Reason Touch Modal */}
      {showPauseDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-w-md w-full rounded-xl border border-slate-800 bg-[#0E121A] p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Pause size={18} className="text-amber-400" />
                <h3 className="text-base font-bold text-white">ሥራውን ለምን ማቆም ፈለጉ?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPauseDialog(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              ፈጣን ምክንያት ይምረጡ ወይም የራስዎን ያክሉ:
            </p>

            <div className="space-y-2">
              {QUICK_PAUSE_REASONS.map((reason, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={async () => {
                    setShowPauseDialog(false);
                    await onPauseJob(reason);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 hover:border-amber-500/50 text-xs text-slate-200 font-medium transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="text-[11px] text-slate-400 block">ሌላ ምክንያት:</label>
              <input
                type="text"
                value={pauseCustomReason}
                onChange={(e) => setPauseCustomReason(e.target.value)}
                placeholder="ለምሳሌ: የኤሌክትሪክ መቆራረጥ..."
                className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-900 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPauseDialog(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-white"
                >
                  ይቅር
                </button>
                <button
                  type="button"
                  disabled={!pauseCustomReason.trim()}
                  onClick={async () => {
                    setShowPauseDialog(false);
                    await onPauseJob(pauseCustomReason.trim());
                  }}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-[#0E121A] font-bold text-xs disabled:opacity-50"
                >
                  አረጋግጥና አቁም
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
