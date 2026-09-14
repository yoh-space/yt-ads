"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Button, Input, Select } from "@/components/shared/ui";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import {
  Boxes,
  Plus,
  Search,
  Layers,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  Scroll,
  FileText,
  Droplet,
  Grid,
} from "lucide-react";
import { RawMaterialModal, type RawMaterialItem } from "./raw-material-modal";
import { ModalShell } from "@/components/dashboard/modals/modal-shell";
import { cn } from "@/lib/utils";

export function RawMaterialsView() {
  const materials = useQuery(api.owner.materials.listRawMaterials, { includeInactive: true });
  const deleteMaterial = useMutation(api.owner.materials.deleteRawMaterial);

  const [searchQuery, setSearchQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RawMaterialItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<RawMaterialItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    if (!materials) return [];
    return materials.filter((m) => {
      if (statusFilter === "ACTIVE" && !m.active) return false;
      if (statusFilter === "INACTIVE" && m.active) return false;
      if (familyFilter !== "ALL" && m.catalogFamily !== familyFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        (m.inkColor && m.inkColor.toLowerCase().includes(q)) ||
        (m.storageLocation && m.storageLocation.toLowerCase().includes(q))
      );
    });
  }, [materials, searchQuery, familyFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    if (!materials) return { total: 0, active: 0, lowStock: 0, rolls: 0, sheets: 0, inks: 0, other: 0 };
    return {
      total: materials.length,
      active: materials.filter((m) => m.active).length,
      lowStock: materials.filter((m) => m.active && m.reorderAt > 0 && m.parentStockQuantity <= m.reorderAt).length,
      rolls: materials.filter((m) => m.active && m.catalogFamily === "ROLL").length,
      sheets: materials.filter((m) => m.active && m.catalogFamily === "RIGID_SHEET").length,
      inks: materials.filter((m) => m.active && m.catalogFamily === "INK_SOLVENT").length,
      other: materials.filter(
        (m) => m.active && m.catalogFamily !== "ROLL" && m.catalogFamily !== "RIGID_SHEET" && m.catalogFamily !== "INK_SOLVENT"
      ).length,
    };
  }, [materials]);

  function handleOpenCreate() {
    setEditingItem(null);
    setModalOpen(true);
  }

  function handleOpenEdit(item: RawMaterialItem) {
    setEditingItem(item);
    setModalOpen(true);
  }

  async function handleConfirmDelete() {
    if (!deletingItem) return;
    setIsDeleting(true);
    try {
      const res = await deleteMaterial({ materialId: deletingItem._id });
      if (res.action === "deactivated") {
        toast.info(res.message);
      } else {
        toast.success(res.message);
      }
      setDeletingItem(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete material.");
    } finally {
      setIsDeleting(false);
    }
  }

  if (materials === undefined) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <InventoryLoader label="Loading Raw Materials Catalog…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <OwnerPageHeader
          kicker="Single Source of Truth · ነጠላ የመረጃ ምንጭ"
          title="Raw Materials Management"
          subtitle="Define and control raw materials, category families (Roll, Sheet, Ink, Bars, Packages), packaging units, and reorder levels."
        />
        <Button
          variant="primary"
          onClick={handleOpenCreate}
          className="flex items-center gap-2 self-start sm:self-auto shadow-sm"
        >
          <Plus size={16} />
          <span>Add Raw Material</span>
        </Button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Raw Materials"
          value={stats.total}
          subtitle={`${stats.active} active in operations`}
          icon={<Boxes size={20} className="text-cyan-dark" />}
          variant="default"
        />
        <StatCard
          label="Media Rolls & Sheets"
          value={`${stats.rolls} rolls · ${stats.sheets} sheets`}
          subtitle="Large format media & rigid boards"
          icon={<Scroll size={20} className="text-violet-400" />}
          variant="default"
        />
        <StatCard
          label="Inks, Bars & Packages"
          value={`${stats.inks} inks · ${stats.other} hardware`}
          subtitle="Consumables & structural hardware"
          icon={<Droplet size={20} className="text-amber-400" />}
          variant="cost"
        />
        <StatCard
          label="Low Stock Warnings"
          value={stats.lowStock}
          subtitle={stats.lowStock > 0 ? "Items at or below reorder level" : "All materials adequately stocked"}
          icon={<AlertTriangle size={20} className={stats.lowStock > 0 ? "text-rose-400" : "text-emerald-400"} />}
          variant={stats.lowStock > 0 ? "alert" : "profit"}
          isAlert={stats.lowStock > 0}
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search material by name, category, or warehouse location…"
            className="pl-9 bg-background"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Select
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
            className="w-44 bg-background text-xs"
          >
            <option value="ALL">All Families</option>
            <option value="ROLL">Rolls (Banner, Sticker)</option>
            <option value="RIGID_SHEET">Rigid Sheets (Boards)</option>
            <option value="INK_SOLVENT">Inks & Solvents</option>
            <option value="BARS">Bars & Extrusions</option>
            <option value="PACKAGES">Packages & Hardware</option>
            <option value="HARDWARE">General Hardware</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-32 bg-background text-xs"
          >
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
            <option value="ALL">All Statuses</option>
          </Select>
        </div>
      </div>

      {/* ── Materials Table ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Material & Category</th>
                <th className="px-4 py-3">Category Family</th>
                <th className="px-4 py-3">Packaging & Ratio</th>
                <th className="px-4 py-3">Central Store Stock</th>
                <th className="px-4 py-3">Reorder Threshold</th>
                <th className="px-4 py-3">Storage Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMaterials.map((item) => {
                const isLowStock = item.active && item.reorderAt > 0 && item.parentStockQuantity <= item.reorderAt;

                return (
                  <tr key={item._id} className="transition-colors hover:bg-secondary/20">
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{item.name}</span>
                        {item.inkColor && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                              item.inkColor === "CYAN"
                                ? "bg-cyan-500/10 text-cyan-500 border-cyan-500/30"
                                : item.inkColor === "MAGENTA"
                                ? "bg-pink-500/10 text-pink-500 border-pink-500/30"
                                : item.inkColor === "YELLOW"
                                ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30 dark:text-yellow-400"
                                : item.inkColor === "BLACK"
                                ? "bg-neutral-800/10 text-neutral-800 border-neutral-400 dark:bg-neutral-800 dark:text-neutral-200"
                                : "bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                item.inkColor === "CYAN"
                                  ? "bg-cyan-500"
                                  : item.inkColor === "MAGENTA"
                                  ? "bg-pink-500"
                                  : item.inkColor === "YELLOW"
                                  ? "bg-yellow-400"
                                  : item.inkColor === "BLACK"
                                  ? "bg-neutral-900 dark:bg-neutral-100"
                                  : "bg-white border border-neutral-400"
                              )}
                            />
                            {item.inkColor}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{item.category}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                          item.catalogFamily === "ROLL"
                            ? "bg-cyan/10 text-cyan-dark border-cyan/20"
                            : item.catalogFamily === "RIGID_SHEET"
                            ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                            : item.catalogFamily === "INK_SOLVENT"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : item.catalogFamily === "BARS"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        }`}
                      >
                        {item.catalogFamily === "ROLL" && <Scroll size={12} />}
                        {item.catalogFamily === "RIGID_SHEET" && <FileText size={12} />}
                        {item.catalogFamily === "INK_SOLVENT" && <Droplet size={12} />}
                        {item.catalogFamily === "BARS" && <Grid size={12} />}
                        {(item.catalogFamily === "PACKAGES" || item.catalogFamily === "HARDWARE") && <Package size={12} />}
                        {item.catalogFamily}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-xs font-mono font-medium text-foreground">
                        1 {item.purchaseUnit} = {item.conversionRatio} {item.unit}
                      </div>
                      {item.rollWidth && (
                        <div className="text-[11px] text-muted-foreground">Width: {item.rollWidth}m</div>
                      )}
                      {item.sheetWidth && item.sheetLength && (
                        <div className="text-[11px] text-muted-foreground">
                          {item.sheetWidth}m × {item.sheetLength}m
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-foreground">
                        {item.parentStockQuantity} {item.purchaseUnit}s
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {item.quantity.toLocaleString()} {item.unit} live base
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${isLowStock ? "text-rose-400 font-bold" : "text-foreground"}`}>
                          {item.reorderAt} {item.purchaseUnit}s
                        </span>
                        {isLowStock && (
                          <AlertTriangle size={13} className="text-rose-400" />
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      {item.storageLocation || "Central store"}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          item.active
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.active ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                        {item.active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => handleOpenEdit(item)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit specification"
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => setDeletingItem(item)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-400"
                          title="Delete or deactivate"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredMaterials.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-xs text-muted-foreground">
                    <Layers size={28} className="mx-auto mb-2 text-muted-foreground/50" />
                    No raw materials match your current search and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {modalOpen && (
        <RawMaterialModal material={editingItem} onClose={() => setModalOpen(false)} />
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deletingItem && (
        <ModalShell
          title={`Remove Material: ${deletingItem.name}`}
          subtitle="Are you sure you want to remove or deactivate this raw material?"
          kicker="CONFIRM ACTION · ማረጋገጫ"
          onClose={() => setDeletingItem(null)}
          className="max-w-md"
        >
          <div className="space-y-4 p-4 text-sm">
            <p className="text-muted-foreground">
              If this material has historical stock ledger events, job consumption, or store requests, it will be{" "}
              <strong className="text-foreground">safely deactivated</strong> to preserve audit integrity. If it is
              completely unused, it will be deleted permanently.
            </p>

            <div className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="text-xs font-semibold text-foreground">{deletingItem.name}</div>
              <div className="text-xs text-muted-foreground">
                {deletingItem.category} · {deletingItem.catalogFamily} · {deletingItem.parentStockQuantity} {deletingItem.purchaseUnit}s in stock
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setDeletingItem(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isDeleting ? "Processing…" : "Confirm Removal"}
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
