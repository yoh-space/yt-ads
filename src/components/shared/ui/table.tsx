import { cn } from "@/lib/utils";
import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  dense?: boolean;
}

export function Table({ className, dense, ...props }: TableProps) {
  return (
    <table
      className={cn("w-full border-collapse text-left", dense && "text-[10px]", className)}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-[#1e293b]", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  interactive?: boolean;
}

export function TableRow({ className, selected, interactive, ...props }: TableRowProps) {
  return (
    <tr
      aria-selected={selected}
      className={cn(
        "border-b border-[#16202f] last:border-b-0 transition-colors",
        interactive && "cursor-pointer hover:bg-[#16202f]",
        selected &&
          "bg-[#1E293B] border-l-4 border-l-[#00B4D8] shadow-[inset_3px_0_0_rgba(0,180,216,0.35)]",
        className
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  mono?: boolean;
  muted?: boolean;
}

export function TableCell({ className, mono, muted, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        "px-3 py-2 align-middle text-[11px] text-foreground",
        mono && "font-mono tabular-nums tracking-[0.02em]",
        muted && "text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
