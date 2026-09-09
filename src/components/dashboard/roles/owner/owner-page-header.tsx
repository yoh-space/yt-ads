import type { ReactNode } from "react";

export function OwnerPageHeader({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4 mb-5">
      <div>
        <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary">
          {kicker}
        </p>
        <h1 className="text-xl font-bold tracking-tight text-foreground mt-0.5">{title}</h1>
        {subtitle && <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}