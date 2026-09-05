"use client";

import type { ReactNode } from "react";
import type { AccessContext } from "@/lib/access-policy";
import { resolveWorkspace, visibleModules } from "./workspace-registry";
import { DashboardAccessDenied } from "./access-denied";

export function WorkspaceRenderer({
  context,
  children,
}: {
  context: AccessContext;
  children: ReactNode;
}) {
  const workspace = resolveWorkspace(context);

  if (!workspace) return <DashboardAccessDenied />;

  const modules = visibleModules(workspace, context);
  return (
    <section
      data-workspace={workspace.id}
      data-workspace-modules={modules.map((module) => module.id).join(",")}
      aria-label={`${workspace.id} workspace`}
    >
      {children}
    </section>
  );
}
