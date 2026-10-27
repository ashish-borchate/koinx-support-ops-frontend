import { Info } from "lucide-react";
import type { PlaybookRoleKey } from "@/handbook/lib/roles";
import { PLAYBOOK_ROLE_LABELS } from "@/handbook/lib/roles";

type HandbookRoleNoticeProps = {
  viewerRoleKey: string;
  playbookRoleKey: PlaybookRoleKey;
};

export function HandbookRoleNotice({ viewerRoleKey, playbookRoleKey }: HandbookRoleNoticeProps) {
  if (viewerRoleKey === playbookRoleKey) return null;

  const playbookLabel = PLAYBOOK_ROLE_LABELS[playbookRoleKey];
  const viewerLabel =
    viewerRoleKey in PLAYBOOK_ROLE_LABELS
      ? PLAYBOOK_ROLE_LABELS[viewerRoleKey as PlaybookRoleKey]
      : "your role";

  return (
    <div
      className="mb-6 flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground dark:border-amber-400/25 dark:bg-amber-950/40"
      role="status"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
      <div>
        <p className="font-medium">Reading another role’s playbook</p>
        <p className="mt-1 text-muted-foreground">
          You are signed in as <span className="font-medium text-foreground">{viewerLabel}</span>. This material
          describes responsibilities for <span className="font-medium text-foreground">{playbookLabel}</span>. Steps
          here may require permissions or duties you do not have.
        </p>
      </div>
    </div>
  );
}
