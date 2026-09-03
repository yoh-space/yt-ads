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
            "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(14,165,233,0.18)] hover:bg-cyan-dark":
              variant === "primary",
            
            // Secondary
            "bg-card text-foreground border-border hover:border-cyan hover:bg-secondary":
              variant === "secondary",
            
            // Tertiary
            "bg-secondary text-muted-foreground hover:bg-border":
              variant === "tertiary",
            
            // Ghost
            "bg-transparent text-foreground border-border hover:bg-secondary":
              variant === "ghost",
            
            // Text
            "bg-transparent text-cyan-dark hover:text-foreground border-0 font-bold":
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
