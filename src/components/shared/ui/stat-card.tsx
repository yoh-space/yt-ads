import { cn } from "@/lib/utils";
import { type HTMLAttributes, type ReactNode, type ButtonHTMLAttributes } from "react";

export interface StatCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  icon: ReactNode;
  label: string;
  subtitle?: string;
  value: string | number;
  description?: string;
  metadata?: string;
  variant?: "default" | "sales" | "cost" | "profit" | "alert";
  isNegative?: boolean;
  isAlert?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export function StatCard({
  className,
  icon,
  label,
  subtitle,
  value,
  description,
  metadata,
  variant = "default",
  isNegative,
  isAlert,
  interactive,
  onClick,
  ...props
}: StatCardProps) {
  
  if (interactive) {
    return (
      <button
        className={cn(
          "relative flex flex-col gap-2 p-[18px] pb-4 rounded-xl",
           "bg-card border border-border/60 shadow-custom overflow-hidden",
          
          // Interactive styles
           "cursor-pointer transition-all duration-300 hover:shadow-[0_0_24px_rgba(14,165,233,0.16)] hover:border-cyan/60 hover:z-10",
          "focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2",

          // Variant-specific border bottom accents
          "after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:opacity-85",
          {
            "after:bg-cyan": variant === "default",
            "after:bg-gradient-to-r after:from-cyan after:to-blue": variant === "sales",
            "after:bg-gradient-to-r after:from-gold after:to-coral": variant === "cost",
            "after:bg-gradient-to-r after:from-green after:to-cyan": variant === "profit" && !isNegative,
            "after:bg-gradient-to-r after:from-coral after:to-red": variant === "profit" && isNegative,
            "after:bg-gradient-to-r after:from-coral after:to-danger": variant === "alert",
          },

          // Alert state styling
          {
           "border-danger/60 bg-danger/10 shadow-[0_0_24px_rgba(239,68,68,0.16)]":
              isAlert,
          },

          className
        )}
        onClick={onClick}
      >
        <StatCardContent 
          icon={icon}
          label={label}
          subtitle={subtitle}
          value={value}
          description={description}
          metadata={metadata}
          variant={variant}
          isNegative={isNegative}
          isAlert={isAlert}
        />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 p-[18px] pb-4 rounded-xl",
        "bg-card border border-border/60 shadow-custom overflow-hidden",

        // Variant-specific border bottom accents
        "after:absolute after:inset-x-0 after:bottom-0 after:h-1 after:opacity-85",
        {
          "after:bg-cyan": variant === "default",
          "after:bg-gradient-to-r after:from-cyan after:to-blue": variant === "sales",
          "after:bg-gradient-to-r after:from-gold after:to-coral": variant === "cost",
          "after:bg-gradient-to-r after:from-green after:to-cyan": variant === "profit" && !isNegative,
          "after:bg-gradient-to-r after:from-coral after:to-red": variant === "profit" && isNegative,
          "after:bg-gradient-to-r after:from-coral after:to-danger": variant === "alert",
        },

        // Alert state styling
        {
          "border-danger/60 bg-danger/10 shadow-[0_0_24px_rgba(239,68,68,0.16)]":
            isAlert,
        },

        className
      )}
      {...props}
    >
      <StatCardContent 
        icon={icon}
        label={label}
        subtitle={subtitle}
        value={value}
        description={description}
        metadata={metadata}
        variant={variant}
        isNegative={isNegative}
        isAlert={isAlert}
      />
    </div>
  );
}

function StatCardContent({
  icon,
  label,
  subtitle,
  value,
  description,
  metadata,
  variant = "default",
  isNegative,
  isAlert,
}: {
  icon: ReactNode;
  label: string;
  subtitle?: string;
  value: string | number;
  description?: string;
  metadata?: string;
  variant?: "default" | "sales" | "cost" | "profit" | "alert";
  isNegative?: boolean;
  isAlert?: boolean;
}) {
  return (
    <>
      {/* Alert badge */}
      {isAlert && (
        <span className="absolute top-3 right-[14px] px-[7px] py-[3px] rounded-full bg-danger text-white text-[9px] font-bold font-mono tracking-wider">
          ALERT
        </span>
      )}

      {/* Header with icon and label */}
      <div className="flex items-center gap-[10px]">
        <span
          className={cn(
            "flex-none w-8 h-8 rounded-lg grid place-items-center",
            "bg-cyan/15 text-cyan-dark",
            {
              "bg-gold/18 text-gold": variant === "cost",
              "bg-green/18 text-green": variant === "profit" && !isNegative,
              "bg-coral/18 text-danger": variant === "profit" && isNegative,
              "bg-coral/22 text-danger": variant === "alert" || isAlert,
            }
          )}
        >
          {icon}
        </span>
        <div className="flex flex-col">
          <span
            className={cn(
              "text-[12px] font-semibold leading-tight",
              "text-slate-100",
              {
                "text-gold": variant === "cost",
                "text-green": variant === "profit" && !isNegative,
                "text-red": variant === "profit" && isNegative,
                "text-danger": variant === "alert" || isAlert,
              }
            )}
          >
            {label}
          </span>
          {subtitle && (
            <span className="text-[10px] text-muted-foreground/70 leading-tight mt-[1px]">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Value */}
      <strong
        className={cn(
          "font-mono text-[26px] font-extrabold leading-none tracking-[-0.5px] text-foreground",
          {
            "text-danger": isNegative,
          }
        )}
      >
        {value}
      </strong>

      {/* Description */}
      {description && (
          <p className="font-sans text-[11px] text-muted-foreground leading-[1.45] m-0">
          {description}
        </p>
      )}

      {/* Metadata */}
      {metadata && (
        <small className="text-muted text-[10px]">
          {metadata}
        </small>
      )}
    </>
  );
}
