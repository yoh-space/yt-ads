"use client";

import { use } from "react";
import { WorkspacePageHeader } from "@/components/dashboard/shell/workspace-page-header";
import { WasteLogger } from "@/components/dashboard/roles/operator/waste-logger";

export default function OperatorWastePage({
  params,
}: {
  params: Promise<{ machine: string }>;
}) {
  const { machine } = use(params);
  const machineParam = machine.toLowerCase();

  return (
    <div className="space-y-6">
      <WorkspacePageHeader
        kicker="Offcuts & Scrap · ቀሪ ዕቃ እና ብክነት"
        title="Offcuts & Scrap Logging"
        subtitle={`Return usable offcuts and record scrap against owner-set material limits on this ${machineParam.toUpperCase()} line.`}
      />
      <WasteLogger machineSlug={machineParam} />
    </div>
  );
}