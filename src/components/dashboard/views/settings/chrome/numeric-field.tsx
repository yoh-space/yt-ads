import { NumericInput } from "@/components/shared/ui";

export interface NumericFieldProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: string | number;
  hint?: string;
}

/**
 * Numeric form control used by every operational rule field.
 * Hides the native spinner buttons to match the dashboard's visual language.
 */
export function NumericField({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step,
  hint,
}: NumericFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {suffix ? (
          <span className="rounded border border-border bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-cyan-dark">
            {suffix}
          </span>
        ) : null}
      </span>
      <NumericInput
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step ?? "any"}
        emptyValue={min ?? 0}
        onChange={(raw) => {
          if (raw.trim() === "") return;
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        helperText={hint}
        className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </label>
  );
}
