import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "tertiary" | "ghost" | "text";
  size?: "default" | "small" | "tiny" | "full";
  pending?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", pending, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center gap-[7px] rounded-md font-semibold transition-all",
          "border border-transparent",
          
          // Variant styles
          {
            // Primary
            "bg-navy text-white shadow-[0_4px_10px_rgba(0,46,75,0.14)] hover:bg-navy-2":
              variant === "primary",
            
            // Secondary
            "bg-white text-[#16445f] border-[#cbdde5] hover:border-[#83bdcd] hover:bg-[#f4fbfc]":
              variant === "secondary",
            
            // Tertiary
            "bg-[#eff5f7] text-[#52707f] hover:bg-[#e4f1f4]":
              variant === "tertiary",
            
            // Ghost
            "bg-transparent text-navy border-[#cadbe2] hover:bg-[#eef6f8]":
              variant === "ghost",
            
            // Text
            "bg-transparent text-[#28788e] hover:text-navy border-0 font-bold":
              variant === "text",
          },
          
          // Size styles
          {
            "min-h-[35px] px-3 text-[11px]": size === "default",
            "min-h-[29px] px-[9px] text-[10px]": size === "small",
            "min-h-[27px] px-2 text-[9px]": size === "tiny",
            "w-full min-h-[40px]": size === "full",
          },
          
          // Disabled/Pending state
          {
            "opacity-55 cursor-not-allowed pointer-events-none": disabled || pending,
          },
          
          className
        )}
        disabled={disabled || pending}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
