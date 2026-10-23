import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  INTEGRATION_UPDATE_REASON_OPTIONS,
  parseIntegrationUpdateReason,
  serializeIntegrationUpdateReason,
  type IntegrationUpdateReasonOption,
} from "@/lib/integration-update-reason";

type Props = {
  value: string;
  onChange: (stored: string) => void;
  required?: boolean;
  disabled?: boolean;
  /** Defaults to "Reason" (e.g. new integration). Use "Reason for update" on pending edit forms. */
  label?: string;
};

export function IntegrationUpdateReasonFields({
  value,
  onChange,
  required,
  disabled,
  label = "Reason",
}: Props) {
  const parsed = parseIntegrationUpdateReason(value);
  const selectedOption: IntegrationUpdateReasonOption | "" =
    parsed.mode === "canonical" || parsed.mode === "other"
      ? (parsed.option ?? "Other")
      : "";
  const legacyNote = parsed.mode === "legacy" ? parsed.legacyText : undefined;
  const otherDetail = parsed.mode === "other" ? parsed.otherDetail || "" : "";

  function setOption(option: IntegrationUpdateReasonOption) {
    if (option === "Other") {
      onChange(serializeIntegrationUpdateReason("Other", otherDetail));
      return;
    }
    onChange(serializeIntegrationUpdateReason(option));
  }

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {legacyNote ? (
        <p className="rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          Previously recorded: <span className="text-foreground">{legacyNote}</span>. Select a reason below to replace it on save.
        </p>
      ) : null}
      <Select
        value={selectedOption || undefined}
        onValueChange={(v) => setOption(v as IntegrationUpdateReasonOption)}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a reason" />
        </SelectTrigger>
        <SelectContent>
          {INTEGRATION_UPDATE_REASON_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedOption === "Other" ? (
        <Input
          placeholder="Briefly describe the reason"
          value={otherDetail}
          disabled={disabled}
          onChange={(e) => onChange(serializeIntegrationUpdateReason("Other", e.target.value))}
        />
      ) : null}
    </div>
  );
}
