import { cn } from "@/lib/utils";
import { type HTMLAttributes, type ReactNode, type ButtonHTMLAttributes } from "react";

export interface StatCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> {
  icon: ReactNode;
  label: string;
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
          "bg-gradient-to-br from-white to-[#f5fbfc] border border-[#dfecef]",
          "shadow-[0_6px_17px_rgba(23,57,72,0.05)] overflow-hidden",
          
          // Interactive styles
          "cursor-pointer transition-all duration-300 hover:shadow-[0_10px_26px_rgba(23,57,72,0.08)] hover:border-[#b8d8e2] hover:z-10",
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
            "border-[#f4c4be] bg-gradient-to-br from-[#fff1ed] to-[#fff7f5] shadow-[0_10px_26px_rgba(232,117,102,0.18)]":
              isAlert,
          },

          className
        )}
        onClick={onClick}
      >
        <StatCardContent 
          icon={icon}
          label={label}
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
        "bg-gradient-to-br from-white to-[#f5fbfc] border border-[#dfecef]",
        "shadow-[0_6px_17px_rgba(23,57,72,0.05)] overflow-hidden",

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
          "border-[#f4c4be] bg-gradient-to-br from-[#fff1ed] to-[#fff7f5] shadow-[0_10px_26px_rgba(232,117,102,0.18)]":
            isAlert,
        },

        className
      )}
      {...props}
    >
      <StatCardContent 
        icon={icon}
        label={label}
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
  value,
  description,
  metadata,
  variant = "default",
  isNegative,
  isAlert,
}: {
  icon: ReactNode;
  label: string;
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
            "bg-cyan/12 text-cyan-dark",
            {
              "bg-gold/18 text-[#b77e15]": variant === "cost",
              "bg-green/18 text-[#2f7d61]": variant === "profit" && !isNegative,
              "bg-coral/18 text-danger": variant === "profit" && isNegative,
              "bg-coral/22 text-danger": variant === "alert" || isAlert,
            }
          )}
        >
          {icon}
        </span>
        <span
          className={cn(
            "font-mono text-[10px] font-semibold tracking-[0.6px] uppercase",
            "text-cyan-dark",
            {
              "text-[#b77e15]": variant === "cost",
              "text-[#2f7d61]": variant === "profit" && !isNegative,
              "text-red": variant === "profit" && isNegative,
              "text-danger": variant === "alert" || isAlert,
            }
          )}
        >
          {label}
        </span>
      </div>

      {/* Value */}
      <strong
        className={cn(
          "font-mono text-[26px] font-extrabold leading-none tracking-[-0.5px] text-[#10364d]",
          {
            "text-danger": isNegative,
          }
        )}
      >
        {value}
      </strong>

      {/* Description */}
      {description && (
        <p className="font-sans text-[11px] text-[#34566a] leading-[1.45] m-0">
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