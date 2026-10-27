import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PLAYBOOK_ROLE_KEYS, PLAYBOOK_ROLE_LABELS, type PlaybookRoleKey } from "@/handbook/lib/roles";
import { cn } from "@/lib/utils";

const MY_ROLE_VALUE = "__my_role__";

export function HandbookRolePreviewSelect({
  viewerRole,
  previewRole,
  onSelect,
  className,
}: {
  viewerRole: PlaybookRoleKey;
  previewRole: PlaybookRoleKey | null;
  onSelect: (role: PlaybookRoleKey | null) => void;
  className?: string;
}) {
  const selected = previewRole ?? MY_ROLE_VALUE;
  const label = previewRole ? PLAYBOOK_ROLE_LABELS[previewRole] : PLAYBOOK_ROLE_LABELS[viewerRole];

  return (
    <Select
      value={selected}
      onValueChange={(v) => onSelect(v === MY_ROLE_VALUE ? null : (v as PlaybookRoleKey))}
    >
      <SelectTrigger
        className={cn("h-8 min-w-[8.5rem] rounded-full border-border/80 bg-background px-3 text-xs font-medium", className)}
        aria-label="Preview handbook as role"
      >
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={MY_ROLE_VALUE}>My role ({PLAYBOOK_ROLE_LABELS[viewerRole]})</SelectItem>
        {PLAYBOOK_ROLE_KEYS.map((k) => (
          <SelectItem key={k} value={k}>{PLAYBOOK_ROLE_LABELS[k]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
