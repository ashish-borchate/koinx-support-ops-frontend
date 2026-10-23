import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AcknowledgementStatusLine,
  ImportanceBadge,
  SupportUpdateAcknowledgeButton,
  type SupportUpdateItem,
} from "@/components/support-updates-feed";
import { formatWhen } from "@/lib/format";
import { api } from "@/lib/api";

type AckActivityRow = {
  userId: string;
  name: string;
  roleName: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
};

type AckActivity = {
  acknowledgementVersion: number;
  acknowledged: number;
  total: number;
  rows: AckActivityRow[];
};

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary underline break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function SupportUpdateDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: SupportUpdateItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useQuery({
    queryKey: ["support-update", item?.id],
    queryFn: () => api<{ item: SupportUpdateItem }>(`/api/support-updates/${item!.id}`),
    enabled: open && Boolean(item?.id),
  });
  const activity = useQuery({
    queryKey: ["support-update-acknowledgements", item?.id],
    queryFn: () => api<AckActivity>(`/api/support-updates/${item!.id}/acknowledgements`),
    enabled: open && Boolean(item?.id) && Boolean(item?.actions?.viewAcknowledgements),
  });

  const display = detail.data?.item || item;
  if (!display) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 text-left leading-snug">{display.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <ImportanceBadge importance={display.importance} />
            <span>{display.category}</span>
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90">
            {linkify(display.description || display.descriptionExcerpt)}
          </p>
          <p className="text-xs text-muted-foreground">
            Posted by {display.postedByName} · {formatWhen(display.postedAt)}
            {display.updatedByName && display.updatedAt && display.updatedAt !== display.postedAt ? (
              <span> · updated {formatWhen(display.updatedAt)}</span>
            ) : null}
          </p>
          <AcknowledgementStatusLine item={display} />
          {display.requiresAcknowledgement && display.viewerAcknowledged && display.viewerAcknowledgedAt ? (
            <p className="text-xs text-muted-foreground">Acknowledged {formatWhen(display.viewerAcknowledgedAt)}</p>
          ) : null}
          <SupportUpdateAcknowledgeButton item={display} />
          {display.actions?.viewAcknowledgements && display.requiresAcknowledgement ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-foreground">Acknowledgement activity</p>
              {activity.isLoading ? (
                <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
              ) : activity.isError ? (
                <p className="mt-2 text-xs text-destructive">Could not load activity.</p>
              ) : activity.data ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activity.data.acknowledged} of {activity.data.total} acknowledged
                  </p>
                  <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                    {activity.data.rows.map((row) => (
                      <li key={row.userId} className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-border/60 pb-2 last:border-0">
                        <div>
                          <p className="font-medium text-foreground">{row.name}</p>
                          <p className="text-[11px] text-muted-foreground">{row.roleName}</p>
                        </div>
                        <div className="text-right text-xs">
                          <p className={row.acknowledged ? "text-emerald-700" : "text-muted-foreground"}>
                            {row.acknowledged ? "Acknowledged" : "Pending"}
                          </p>
                          <p className="text-muted-foreground">
                            {row.acknowledgedAt ? formatWhen(row.acknowledgedAt) : "—"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
