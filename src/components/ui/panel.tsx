import { cn } from "@/lib/utils";
import { type HTMLAttributes, type ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface PanelHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  kicker?: string;
  kickerVariant?: "default" | "coral";
  action?: ReactNode;
  icon?: ReactNode;
}

export function Panel({ className, children, ...props }: PanelProps) {
  return (
    <article
      className={cn(
        "bg-white border border-[#e4edf1] rounded-[9px] shadow-[0_6px_17px_rgba(23,57,72,0.03)]",
        className
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export function PanelHeader({
  className,
  title,
  subtitle,
  kicker,
  kickerVariant = "default",
  action,
  icon,
  ...props
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex justify-between items-start gap-[15px] px-[17px] pt-4 pb-[13px] border-b border-[#edf2f4]",
        className
      )}
      {...props}
    >
      <div className="flex-1">
        {kicker && (
          <span
            className={cn(
              "block mb-[5px] font-mono text-[9px] font-medium tracking-[1px] uppercase",
              "text-[#3d8396]",
              {
                "text-[#c86256]": kickerVariant === "coral",
              }
            )}
          >
            {kicker}
          </span>
        )}
        <h2 className="m-0 text-[#173c53] font-sans text-[15px] leading-[1.25]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-[3px] mb-0 text-[#8598a4] text-[10px]">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-none">{action}</div>}
      {icon && <div className="flex-none text-[#2b8a9c]">{icon}</div>}
    </div>
  );
}