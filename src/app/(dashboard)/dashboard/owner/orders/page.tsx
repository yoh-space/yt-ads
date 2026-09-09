"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { StatCard } from "@/components/shared/ui/stat-card";
import { Panel, PanelHeader } from "@/components/shared/ui/panel";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/shared/ui/table";
import { InventoryLoader } from "@/components/dashboard/inventory-loader";
import { Inbox, AlertTriangle, CalendarClock } from "lucide-react";

const etb = (value: number) => `ETB ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function makeDueDate(timestamp: number) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function OwnerOrdersPage() {
  const summary = useQuery(api.owner.orders.getOrderSummary);

  if (summary === undefined) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <InventoryLoader label="Loading Orders…" />
      </div>
    );
  }

  const totalActive =
    Object.entries(summary.byStatus)
      .filter(([status]) => !["COMPLETED", "EXPIRED", "EXPIRED_JUNK", "CONFIRMED"].includes(status))
      .reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="Orders · የደንበኛ ትዕዛዞች"
        title="Orders"
        subtitle={`${summary.totalOrders} customer orders in the system.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Inbox size={16} />}
          label="Total Orders"
          subtitle="ጠቅላላ ትዕዛዞች"
          value={summary.totalOrders}
          variant="default"
        />
        <StatCard
          icon={<CalendarClock size={16} />}
          label="Active / In Progress"
          subtitle="በሂደት ላይ"
          value={totalActive}
          variant="sales"
        />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="Overdue"
          subtitle="ጊዜ ያለፈ"
          value={summary.overdue}
          description="Past their preferred due date and still open."
          variant="alert"
          isAlert={summary.overdue > 0}
        />
      </div>

      <Panel>
        <PanelHeader
          title="Recent Orders"
          subtitle="የቅርብ ትዕዛዞች"
          kicker="Latest"
          icon={<Inbox size={16} />}
        />
        {summary.recent.length === 0 ? (
          <p className="p-[17px] text-[12px] text-muted-foreground">No orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table dense>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.recent.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell mono>{order.code}</TableCell>
                    <TableCell>{order.clientName}</TableCell>
                    <TableCell muted>{order.serviceType}</TableCell>
                    <TableCell mono>{etb(order.amount)}</TableCell>
                    <TableCell muted>{order.status}</TableCell>
                    <TableCell mono>{makeDueDate(order.preferredDueDate)}</TableCell>
                    <TableCell muted>{order.priority}</TableCell>
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