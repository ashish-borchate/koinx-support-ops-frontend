import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  GUIDE_UPDATE_REASON_OPTIONS,
  parseGuideUpdateReason,
  serializeGuideUpdateReason,
  type GuideUpdateReasonOption,
} from "@/lib/guide-update-reason";

type Props = {
  value: string;
  onChange: (stored: string) => void;
  required?: boolean;
  disabled?: boolean;
};

export function GuideUpdateReasonFields({ value, onChange, required, disabled }: Props) {
  const parsed = parseGuideUpdateReason(value);
  const selectedOption: GuideUpdateReasonOption | "" =
    parsed.mode === "canonical" || parsed.mode === "other"
      ? (parsed.option ?? "Other")
      : parsed.mode === "legacy"
        ? ""
        : "";
  const legacyNote = parsed.mode === "legacy" ? parsed.legacyText : undefined;
  const otherDetail = parsed.mode === "other" ? parsed.otherDetail || "" : "";

  function setOption(option: GuideUpdateReasonOption) {
    if (option === "Other") {
      onChange(serializeGuideUpdateReason("Other", otherDetail));
      return;
    }
    onChange(serializeGuideUpdateReason(option));
  }

  return (
    <div className="space-y-2">
      <Label>
        Reason for update
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {legacyNote ? (
        <p className="rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          Previously recorded: <span className="text-foreground">{legacyNote}</span>. Select a reason below to replace it
          on save.
        </p>
      ) : null}
      <Select
        value={selectedOption || undefined}
        onValueChange={(v) => setOption(v as GuideUpdateReasonOption)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a reason" />
        </SelectTrigger>
        <SelectContent>
          {GUIDE_UPDATE_REASON_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedOption === "Other" ? (
        <Input
          placeholder="Briefly describe the reason"
          value={otherDetail}
          disabled={disabled}
          onChange={(e) => onChange(serializeGuideUpdateReason("Other", e.target.value))}
        />
      ) : null}
    </div>
  );
}
