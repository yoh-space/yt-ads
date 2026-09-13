"use client";

import { useState, useMemo } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxOption {
  value: string;
  label: string;
  description?: string;
}

export interface CheckboxGroupFieldProps {
  label: string;
  description?: string;
  options: CheckboxOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  columns?: 1 | 2 | 3;
  emptyMessage?: string;
}

export function CheckboxGroupField({
  label,
  description,
  options,
  selected = [],
  onChange,
  className,
  columns = 2,
  emptyMessage = "No options available",
}: CheckboxGroupFieldProps) {
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const query = search.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        opt.value.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query)),
    );
  }, [options, search]);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const gridColsClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </label>
          {description && (
            <p className="text-[11px] text-muted-foreground/80 mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Clear ({selected.length})
            </button>
          )}
          {options.length > 0 && selected.length < options.length && (
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="text-[10px] text-primary hover:underline transition-colors"
            >
              Select All
            </button>
          )}
        </div>
      </div>

      {options.length > 6 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
          <input
            type="text"
            placeholder={`Filter ${label.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs placeholder:text-muted-foreground/60 focus:border-cyan focus:outline-none"
          />
        </div>
      )}

      {filteredOptions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-2 max-h-56 overflow-y-auto p-1 border border-border/70 rounded-lg bg-secondary/15 [scrollbar-width:thin]",
            gridColsClass,
          )}
        >
          {filteredOptions.map((option) => {
            const isChecked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleOption(option.value)}
                className={cn(
                  "flex items-start gap-2.5 rounded-md p-2 text-left transition-all border text-xs",
                  isChecked
                    ? "border-primary/50 bg-primary/10 text-foreground font-medium"
                    : "border-transparent bg-background/60 hover:bg-muted/30 text-muted-foreground",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
                    isChecked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40 bg-background",
                  )}
                >
                  {isChecked && <Check className="h-3 w-3" strokeWidth={3} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{option.label}</div>
                  {option.description && (
                    <div className="text-[10px] text-muted-foreground/70 truncate">
                      {option.description}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
