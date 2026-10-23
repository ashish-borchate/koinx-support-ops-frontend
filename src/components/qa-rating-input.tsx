import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { qaRatingValidationMessage } from "@/lib/qa-rating-validation";

type Props = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function QaRatingInput({ id, label, value, onChange, className }: Props) {
  const [error, setError] = useState<string | null>(null);

  function validateAndCommit(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setError(null);
      onChange("");
      return;
    }
    const message = qaRatingValidationMessage(trimmed);
    setError(message);
    if (!message) onChange(trimmed);
  }

  return (
    <div className={className}>
      {label ? <Label className="text-xs" htmlFor={id}>{label}</Label> : null}
      <Input
        id={id}
        className="h-9 tabular-nums"
        inputMode="decimal"
        placeholder="0–10"
        value={value}
        onChange={(e) => {
          setError(null);
          onChange(e.target.value);
        }}
        onBlur={() => validateAndCommit(value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function assertValidQaRatingsForSubmit(
  ratings: Record<string, string>,
  labels: Record<string, string>,
): void {
  for (const [key, raw] of Object.entries(ratings)) {
    const trimmed = raw.trim();
    if (!trimmed) throw new Error(`Select a rating for “${labels[key] || key}”.`);
    const message = qaRatingValidationMessage(trimmed);
    if (message) throw new Error(`${labels[key] || key}: ${message}`);
  }
}
