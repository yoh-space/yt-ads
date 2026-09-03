import { Input } from "@/components/ui";

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
        <span className="text-xs font-semibold text-navy">{label}</span>
        {suffix ? (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
            {suffix}
          </span>
        ) : null}
      </span>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? "any"}
        onChange={(event) => {
          const raw = event.target.value;
          const parsed = raw === "" ? 0 : Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {hint ? <small className="mt-1.5 block text-[11px] text-gray-500">{hint}</small> : null}
    </label>
  );
}
