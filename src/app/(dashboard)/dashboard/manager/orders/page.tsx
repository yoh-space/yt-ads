"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { InventoryLoader } from "@/components/dashboard/widgets/inventory-loader";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shared/ui/table";
import { cn } from "@/lib/utils";
import { CalendarClock, ClipboardList, Inbox, Search } from "lucide-react";
import { OrderDetailDrawer } from "@/components/dashboard/roles/common/order-detail-drawer";

type ManagerOrder = {
  id: Id<"customerOrders">;
  code: string;
  clientName: string;
  serviceType: string;
  dimensions: string;
  quantity: string;
  preferredDueDate: number;
  status: string;
  priority: string;
  source: string;
  machineName?: string;
  jobCardAssigned: boolean;
  overdue: boolean;
  createdAt: number;
};

const statusOptions = ["ALL", "PENDING_REVIEW", "IN_REVIEW", "READY_FOR_PRODUCTION", "JOB_CARD_CREATED", "IN_PRODUCTION", "COMPLETED", "READY_FOR_PICKUP", "EXPIRED"];

function formatStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status: string) {
  if (status === "COMPLETED" || status === "READY_FOR_PICKUP") return "border-success/30 bg-success/10 text-success";
  if (status === "EXPIRED" || status === "EXPIRED_JUNK") return "border-danger/30 bg-danger/10 text-danger";
  if (status === "IN_PRODUCTION") return "border-cyan/30 bg-cyan/10 text-cyan-dark";
  return "border-border bg-muted/20 text-muted-foreground";
}

export default function ManagerOrdersPage() {
  const orderSnapshot = useQuery(api.manager.orders.getOrders);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOrderId, setSelectedOrderId] = useState<Id<"customerOrders"> | null>(null);
  const orders = (orderSnapshot?.orders ?? []) as ManagerOrder[];
  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "ALL" || order.status === statusFilter;
      const matchesSearch = !query || [order.code, order.clientName, order.serviceType, order.machineName ?? ""].join(" ").toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [orders, searchTerm, statusFilter]);

  if (orderSnapshot === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <InventoryLoader label="Loading manager orders…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Orders · የደንበኛ ማዘዣ"
        title="Orders"
        subtitle="Keep track of customer requests, deadlines, and progress."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={<Inbox size={16} />} label="Total Orders" subtitle="ጠቅላላ ትዕዛዞች" value={orderSnapshot.total} />
        <StatCard icon={<ClipboardList size={16} />} label="Active Orders" subtitle="በሂደት ላይ" value={orderSnapshot.active} variant="sales" />
        <StatCard icon={<CalendarClock size={16} />} label="Overdue" subtitle="ጊዜ ያለፈ" value={orderSnapshot.overdue} variant="alert" isAlert={orderSnapshot.overdue > 0} />
      </div>

      <Panel>
        <PanelHeader title="Recent orders" subtitle="Customer details and progress." icon={<Inbox size={16} />} />
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search code, client, service..." className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary" />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary">
            {statusOptions.map((status) => <option key={status} value={status}>{status === "ALL" ? "All statuses" : formatStatus(status)}</option>)}
          </select>
        </div>
        {filteredOrders.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">No operational orders match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Client</TableHead><TableHead>Service / specs</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id} interactive selected={selectedOrderId === order.id} onClick={() => setSelectedOrderId(order.id)}>
                    <TableCell mono>{order.code}</TableCell>
                    <TableCell>{order.clientName}</TableCell>
                    <TableCell muted><span className="block">{order.serviceType}</span><span className="text-[10px]">{order.dimensions} · Qty {order.quantity}</span></TableCell>
                    <TableCell mono>{formatDate(order.preferredDueDate)}</TableCell>
                    <TableCell><span className={cn("inline-flex rounded-full border px-2 py-1 text-[9px] font-semibold", statusTone(order.status))}>{formatStatus(order.status)}</span></TableCell>
                    <TableCell muted>{order.priority}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
