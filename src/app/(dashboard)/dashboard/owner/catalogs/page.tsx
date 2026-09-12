"use client";

import { OwnerPageHeader } from "@/components/dashboard/roles/owner/owner-page-header";
import { DatabaseCatalogSuite } from "@/components/dashboard/roles/owner/catalogs/database-catalog-suite";

export default function OwnerCatalogsPage() {
  return (
    <div className="space-y-6">
      <OwnerPageHeader
        kicker="MASTER DATA & INFRASTRUCTURE"
        title="Production & Master Catalogs"
        subtitle="Manage services, raw materials, machine routes, operator roles, and permissions directly from database tables."
      />
      <DatabaseCatalogSuite />
    </div>
  );
}
