import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "w-full h-[37px] px-[10px] rounded-md border border-border",
          "bg-background text-foreground text-[11px] outline-none",
          "focus:border-cyan focus:shadow-[0_0_0_3px_rgba(25,196,210,0.1)]",
          "placeholder:text-muted-foreground",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
