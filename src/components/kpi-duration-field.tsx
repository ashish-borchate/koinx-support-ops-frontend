import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  durationComponentsToHours,
  emptyDurationComponents,
  formatFreshdeskDurationLabel,
  formatStoredHoursDisplay,
  hoursToDurationComponents,
  parseFreshdeskDurationPaste,
  type DurationComponents,
  validateDurationComponents,
} from "@/lib/kpi-duration";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  /** Decimal hours string; empty when unset. */
  value: string;
  onChange: (hoursString: string) => void;
  className?: string;
  disabled?: boolean;
  /** When true, duration dialog stacks above a parent modal (Agent KPI entry). */
  nestedInDialog?: boolean;
  compact?: boolean;
};

function parseFieldInt(raw: string, fallback = 0) {
  if (raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) ? n : NaN;
}

function componentsFromFields(fields: Record<keyof DurationComponents, string>): DurationComponents | { error: string } {
  const parts = {
    hours: parseFieldInt(fields.hours, 0),
    minutes: parseFieldInt(fields.minutes, 0),
    seconds: parseFieldInt(fields.seconds, 0),
    milliseconds: parseFieldInt(fields.milliseconds, 0),
  };
  if (Object.values(parts).some((n) => Number.isNaN(n))) {
    return { error: "Enter whole numbers only." };
  }
  const validation = validateDurationComponents(parts);
  if (validation) return { error: validation };
  return parts;
}

export function KpiDurationField({
  label,
  value,
  onChange,
  className,
  disabled,
  nestedInDialog = false,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<keyof DurationComponents, string>>({
    hours: "0",
    minutes: "0",
    seconds: "0",
    milliseconds: "0",
  });
  const [paste, setPaste] = useState("");
  const [pasteError, setPasteError] = useState("");
  const [modalError, setModalError] = useState("");
  const savedHoursRef = useRef(value);
  const pasteId = useId();

  const savedHours = value.trim() === "" ? null : Number(value);
  const displayHours = savedHours != null && !Number.isNaN(savedHours) ? formatStoredHoursDisplay(savedHours) : "";
  const freshdeskSubtitle =
    savedHours != null && !Number.isNaN(savedHours)
      ? formatFreshdeskDurationLabel(hoursToDurationComponents(savedHours))
      : null;

  const previewHours = useMemo(() => {
    const parsed = componentsFromFields(draft);
    if ("error" in parsed) return null;
    return durationComponentsToHours(parsed);
  }, [draft]);

  function openModal() {
    if (disabled) return;
    savedHoursRef.current = value;
    const base =
      value.trim() !== "" && !Number.isNaN(Number(value))
        ? hoursToDurationComponents(Number(value))
        : emptyDurationComponents();
    setDraft({
      hours: String(base.hours),
      minutes: String(base.minutes),
      seconds: String(base.seconds),
      milliseconds: String(base.milliseconds),
    });
    setPaste("");
    setPasteError("");
    setModalError("");
    setOpen(true);
  }

  function cancel() {
    setOpen(false);
  }

  function save() {
    const parsed = componentsFromFields(draft);
    if ("error" in parsed) {
      setModalError(parsed.error);
      return;
    }
    const hours = durationComponentsToHours(parsed);
    onChange(String(hours));
    setOpen(false);
  }

  function applyPaste() {
    const result = parseFreshdeskDurationPaste(paste);
    if ("error" in result) {
      setPasteError(result.error);
      return;
    }
    setPasteError("");
    setDraft({
      hours: String(result.hours),
      minutes: String(result.minutes),
      seconds: String(result.seconds),
      milliseconds: String(result.milliseconds),
    });
  }

  useEffect(() => {
    if (!open) return;
    const first = document.getElementById(`${pasteId}-hours`);
    first?.focus();
  }, [open, pasteId]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openModal}
        className={cn(
          "flex w-full flex-col rounded-md border border-input bg-background text-left text-sm shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "mt-1.5 min-h-8 px-2 py-1" : "mt-1.5 px-2 py-1.5",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
        aria-label={`${label}, edit duration`}
      >
        <span className="font-medium tabular-nums text-foreground">{displayHours || "—"}</span>
        {freshdeskSubtitle ? (
          <span className="text-[10px] leading-tight text-muted-foreground">Freshdesk: {freshdeskSubtitle}</span>
        ) : (
          <span className="text-[10px] leading-tight text-muted-foreground">Click to enter duration</span>
        )}
      </button>

      <Dialog open={open} onOpenChange={(next) => !next && cancel()}>
        <DialogContent layer={nestedInDialog ? "stacked" : "default"} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["hours", "minutes", "seconds", "milliseconds"] as const).map((key) => (
              <div key={key} className="space-y-1">
                <Label htmlFor={`${pasteId}-${key}`} className="text-xs capitalize">
                  {key === "milliseconds" ? "Ms" : key}
                </Label>
                <Input
                  id={`${pasteId}-${key}`}
                  inputMode="numeric"
                  className="h-9"
                  value={draft[key]}
                  onChange={(e) => {
                    setDraft((prev) => ({ ...prev, [key]: e.target.value.replace(/[^\d]/g, "") }));
                    setModalError("");
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Preview:{" "}
            <span className="font-medium tabular-nums text-foreground">
              {previewHours == null ? "—" : `${formatStoredHoursDisplay(previewHours)} h`}
            </span>
          </p>
          <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/20 p-3">
            <Label htmlFor={`${pasteId}-paste`} className="text-xs">Paste from Freshdesk (optional)</Label>
            <div className="flex gap-2">
              <Input
                id={`${pasteId}-paste`}
                className="h-9 flex-1"
                placeholder="1h 43m 22s 130ms"
                value={paste}
                onChange={(e) => {
                  setPaste(e.target.value);
                  setPasteError("");
                }}
              />
              <Button type="button" size="sm" variant="secondary" className="h-9 shrink-0" onClick={applyPaste}>
                Parse
              </Button>
            </div>
            {pasteError ? <p className="text-xs text-destructive">{pasteError}</p> : null}
          </div>
          {modalError ? <p className="text-sm text-destructive">{modalError}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
            <Button type="button" onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
