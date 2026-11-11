import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCalendarDate } from "@/lib/format";
import {
  resolveDatePreset,
  type DatePresetId,
} from "@/lib/support-analytics-date-presets";

const PRESETS: { id: DatePresetId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "thisWeek", label: "This week" },
  { id: "thisMonth", label: "This month" },
  { id: "custom", label: "Custom" },
];

export type ReportingPeriodSectionProps = {
  draftFrom: string;
  draftTo: string;
  appliedFrom: string;
  appliedTo: string;
  preset: DatePresetId;
  onPresetChange: (preset: DatePresetId) => void;
  onDraftFrom: (value: string) => void;
  onDraftTo: (value: string) => void;
  onApply: (from: string, to: string) => void;
  showIstInSummary?: boolean;
};

export function ReportingPeriodSection({
  draftFrom,
  draftTo,
  appliedFrom,
  appliedTo,
  preset,
  onPresetChange,
  onDraftFrom,
  onDraftTo,
  onApply,
  showIstInSummary = true,
}: ReportingPeriodSectionProps) {
  const [customEditing, setCustomEditing] = useState(false);

  function selectPreset(next: DatePresetId) {
    if (next === "custom") {
      if (preset === "custom") {
        setCustomEditing((open) => !open);
        return;
      }
      onPresetChange("custom");
      setCustomEditing(true);
      return;
    }
    setCustomEditing(false);
    onPresetChange(next);
    const { from, to } = resolveDatePreset(next);
    onDraftFrom(from);
    onDraftTo(to);
    onApply(from, to);
  }

  function applyCustom() {
    onApply(draftFrom, draftTo);
    setCustomEditing(false);
  }

  const showCustomInputs = preset === "custom" && customEditing;

  return (
    <section className="rounded-lg border border-border bg-card px-3 py-3">
      <p className="mb-2 text-sm font-semibold text-foreground">Reporting period</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={preset === p.id ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => selectPreset(p.id)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {appliedFrom && appliedTo ? (
          <span className="rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium tabular-nums text-foreground">
            {formatCalendarDate(appliedFrom)} – {formatCalendarDate(appliedTo)}
            {showIstInSummary ? " (IST)" : ""}
          </span>
        ) : null}
        {showCustomInputs ? (
          <span className="flex flex-wrap items-end gap-2">
            <DateBoundInput label="FROM" value={draftFrom} onChange={onDraftFrom} />
            <DateBoundInput label="TO" value={draftTo} onChange={onDraftTo} />
            <Button size="sm" className="h-9" onClick={applyCustom}>
              Apply range
            </Button>
          </span>
        ) : null}
      </div>
    </section>
  );
}

function DateBoundInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Input
        type="date"
        className="h-9 w-[10.5rem]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} date`}
      />
    </div>
  );
}
