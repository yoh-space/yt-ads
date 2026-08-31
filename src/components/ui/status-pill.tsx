import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "success" | "warning" | "neutral" | "danger" | "info";
  children: React.ReactNode;
}

export function StatusPill({ className, variant = "neutral", children, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-max px-[7px] py-1 rounded text-[8px] font-bold whitespace-nowrap",
        {
          "bg-[#e7f7ef] text-[#2e8b68]": variant === "success",
          "bg-[#fff3df] text-[#a86e11]": variant === "warning", 
          "bg-[#eef4f6] text-[#65818e]": variant === "neutral",
          "bg-[#fde8e6] text-[#b84440]": variant === "danger",
          "bg-[#e7f0fd] text-[#2f6fb3]": variant === "info",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}