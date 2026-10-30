"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatNumber, formatPercent, parseDigits, parsePercent } from "@/lib/card/calc";

/** Comma-formatted integer input that keeps the caret after the same digit while typing. */
export function NumberField({ value, max, onChange, id, suffix, ariaLabel, placeholder = suffix }: {
  value: number | null;
  max: number;
  onChange: (v: number | null) => void;
  id: string;
  suffix: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const digitsBeforeCaret = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const digits = digitsBeforeCaret.current;
    if (!el || digits === null) return;
    digitsBeforeCaret.current = null;
    let pos = 0;
    for (let seen = 0; pos < el.value.length && seen < digits; pos += 1) {
      if (/\d/.test(el.value[pos])) seen += 1;
    }
    el.setSelectionRange(pos, pos);
  });

  return (
    <div className="min-w-0 flex-1">
      <input
        ref={ref}
        id={id}
        className="field-input num"
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={error !== null}
        placeholder={placeholder}
        value={formatNumber(value)}
        onBlur={() => setError(null)}
        onChange={(e) => {
          const parsed = parseDigits(e.target.value, max);
          if (parsed === "invalid") {
            setError("소수점이나 음수 없이 정수만 입력할 수 있어요.");
            return;
          }
          if (parsed === "over") {
            setError(`최대 ${formatNumber(max)}${suffix}까지 입력할 수 있어요.`);
            return;
          }
          setError(null);
          digitsBeforeCaret.current = e.target.value.slice(0, e.target.selectionStart ?? 0).replace(/\D/g, "").length;
          onChange(parsed);
        }}
      />
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

/** Keeps what is being typed ("5.") while the card holds the number it means (5). */
export function PercentField({ value, onChange, id, ariaLabel, placeholder = "%" }: {
  value: number | null;
  onChange: (v: number | null) => void;
  id: string;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="min-w-0 flex-1">
      <input
        id={id}
        className="field-input num"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={error !== null}
        placeholder={placeholder}
        value={parsePercent(draft) === value ? draft : formatPercent(value)}
        onBlur={() => setError(null)}
        onChange={(e) => {
          const parsed = parsePercent(e.target.value);
          if (parsed === "invalid" || parsed === "over") {
            setError("0부터 100까지, 소수 둘째 자리까지 입력할 수 있어요.");
            return;
          }
          setError(null);
          setDraft(e.target.value);
          onChange(parsed);
        }}
      />
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}
