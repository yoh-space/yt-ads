"use client";

import { useEffect, useState, type FocusEvent, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

type NumericValue = string | number;

export interface NumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "onBlur"> {
  value?: NumericValue | null;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  emptyValue?: NumericValue;
  onValidityChange?: (isValid: boolean) => void;
  helperText?: string;
  onBlur?: InputHTMLAttributes<HTMLInputElement>["onBlur"];
}

function displayValue(value: NumericValue | null | undefined) {
  if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) return "";
  return String(value);
}

function validationError(value: string, min?: number, max?: number) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "እባክዎ ትክክለኛ ቁጥር ያስገቡ";
  if (min !== undefined && parsed < min) return `ዋጋው ከ${min} ማነስ አይችልም`;
  if (max !== undefined && parsed > max) return `ዋጋው ከ${max} መብለጥ አይችልም`;
  return null;
}

/** Numeric control that keeps an editable string draft until the user leaves the field. */
export function NumericInput({
  value,
  onChange,
  min,
  max,
  emptyValue,
  onValidityChange,
  helperText,
  className,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const externalValue = displayValue(value);
  const [draft, setDraft] = useState(externalValue);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(validationError(externalValue, min, max));

  useEffect(() => {
    if (!focused) {
      setDraft(externalValue);
      const nextError = validationError(externalValue, min, max);
      setError(nextError);
      onValidityChange?.(nextError === null && (!props.required || externalValue.trim() !== ""));
    }
  }, [externalValue, focused, min, max, props.required]);

  function updateValidity(nextValue: string) {
    const nextError = validationError(nextValue, min, max);
    setError(nextError);
    onValidityChange?.(nextError === null && (!props.required || nextValue.trim() !== ""));
    return nextError;
  }

  function handleChange(nextValue: string) {
    setDraft(nextValue);
    updateValidity(nextValue);
    onChange(nextValue);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    setFocused(false);
    const nextValue = draft.trim() === "" && emptyValue !== undefined ? displayValue(emptyValue) : draft;
    if (nextValue !== draft) {
      setDraft(nextValue);
      onChange(nextValue);
    }
    updateValidity(nextValue);
    onBlur?.(event);
  }

  return (
    <div>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        value={draft}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        aria-invalid={error ? "true" : undefined}
        className={cn(
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          error && "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/30",
          className,
        )}
      />
      {error ? <p className="mt-1 text-[11px] text-red-500">{error}</p> : helperText ? <p className="mt-1.5 text-[11px] text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
