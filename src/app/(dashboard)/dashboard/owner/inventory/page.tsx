"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/owner/owner-page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { Boxes, Warehouse, PackageOpen, AlertTriangle } from "lucide-react";

const etb = (value: number) => `ETB ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function OwnerInventoryPage() {
  const summary = useQuery(api.owner.inventory.getInventorySummary);

  if (summary === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Inventory…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Stock Levels · ክምችት ደረጃ"
        title="Inventory"
        subtitle="Approximate stock value across the central store and production floor."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Boxes size={16} />}
          label="Total Stock Value"
          subtitle="ጠቅላላ የክምችት ዋጋ"
          value={etb(summary.totalValue)}
          variant="sales"
        />
        <StatCard
          icon={<Warehouse size={16} />}
          label="Central Store"
          subtitle="ዋና መጋዘን"
          value={etb(summary.mainStoreValue)}
          variant="default"
        />
        <StatCard
          icon={<PackageOpen size={16} />}
          label="Production Floor"
          subtitle="መስሪያ ቤት ክምችት"
          value={etb(summary.floorValue)}
          variant="cost"
        />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="Uncleared Value"
          subtitle="ያልተመረመረ"
          value={etb(summary.unclearedValue)}
          description="Estimate tied up in stock awaiting clearance."
          variant="alert"
          isAlert={summary.unclearedValue > 0}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Missing Stock / Discrepancies"
          subtitle="የክምችት አለመመጣጠን"
          kicker="Issues"
          icon={<AlertTriangle size={16} />}
        />
        {summary.issues.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">
            No clearance discrepancies right now.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Operator</TableHead>
                  <TableHead>Machine</TableHead>
                  <TableHead>Value at risk</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="font-medium text-foreground">{issue.itemName}</TableCell>
                    <TableCell muted>{issue.operatorName}</TableCell>
                    <TableCell muted>{issue.machineName}</TableCell>
                    <TableCell mono>{etb(issue.amount)}</TableCell>
                    <TableCell>
                      <span className="rounded-full border border-danger/50 bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                        {issue.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}