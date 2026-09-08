"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/owner/owner-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { PackageOpen, AlertTriangle, Layers } from "lucide-react";

export default function OwnerOperationalConfigurationPage() {
  const summary = useQuery(api.owner.materials.getMaterialsSummary);

  if (summary === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Configuration…" />
      </div>
    );
  }

  const categories = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Operational Configuration · የሥራ ማስተካከያ"
        title="Operational Configuration"
        subtitle="Material catalog and reorder settings."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<PackageOpen size={16} />}
          label="Active Materials"
          subtitle="ንቁ ዕቃዎች"
          value={summary.totalMaterials}
          variant="default"
        />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="At or Below Reorder Point"
          subtitle="መልሶ ለማዘዝ ደረጃ"
          value={summary.reorderMaterials.length}
          variant="alert"
          isAlert={summary.reorderMaterials.length > 0}
        />
        <StatCard
          icon={<Layers size={16} />}
          label="Material Categories"
          subtitle="የዕቃ ዓይነቶች"
          value={categories.length}
          variant="sales"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Materials at or Below Reorder Point"
          subtitle="መልሶ ለማዘዝ ደረጃ ላይ ያሉ"
          kicker="Restock"
          icon={<AlertTriangle size={16} />}
        />
        {summary.reorderMaterials.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">
            All materials are above their reorder point.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>On hand</TableHead>
                  <TableHead>Reorder at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.reorderMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium text-foreground">{material.name}</TableCell>
                    <TableCell muted>{material.category}</TableCell>
                    <TableCell muted>{material.unit}</TableCell>
                    <TableCell mono>{material.quantity}</TableCell>
                    <TableCell mono muted>{material.reorderAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          title="Materials by Category"
          subtitle="በዓይነት የተከፋፈለ"
          kicker="Catalog"
          icon={<Layers size={16} />}
        />
        {categories.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">No material categories tracked.</p>
        ) : (
          <div className="grid gap-3 p-[17px] sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(([category, count]) => (
              <div
                key={category}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2.5"
              >
                <span className="text-[12px] text-muted-foreground">{category}</span>
                <span className="font-mono text-[13px] font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}