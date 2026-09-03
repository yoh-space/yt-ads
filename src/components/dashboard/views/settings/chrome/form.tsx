import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FormTone = "cyan" | "gold" | "blue" | "coral" | "navy" | "violet";

const toneTile: Record<FormTone, string> = {
  cyan: "bg-cyan/10 text-cyan-dark",
  gold: "bg-gold/10 text-gold",
  blue: "bg-blue/10 text-blue",
  coral: "bg-coral/10 text-coral",
  navy: "bg-navy/10 text-navy",
  violet: "bg-violet/10 text-violet",
};

/**
 * Card-style body section used inside the settings and operational panels.
 * Pairs a leading icon tile with a bold title and a muted subtitle.
 */
export function FormSection({
  icon,
  tone = "cyan",
  title,
  note,
  children,
  className,
}: {
  icon: ReactNode;
  tone?: FormTone;
  title: string;
  note: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center gap-3">
        <span className={cn("grid h-9 w-9 flex-none place-items-center rounded-lg", toneTile[tone])}>
          {icon}
        </span>
        <div className="min-w-0">
          <strong className="block text-sm font-bold text-navy">{title}</strong>
          <span className="mt-0.5 block text-xs text-gray-500">{note}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Standardised label used above each form control in the settings forms. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold text-navy">{children}</span>;
}

/** Inline banner used to surface success or error feedback next to save buttons. */
export function FormMessage({
  children,
  tone = "success",
}: {
  children: ReactNode;
  tone?: "success" | "error";
}) {
  return (
    <p
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-xs font-medium",
        tone === "success"
          ? "border-green/20 bg-green/10 text-green"
          : "border-coral/20 bg-coral/10 text-coral",
      )}
    >
      {children}
    </p>
  );
}
