import { Link, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatWhen } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export type SupportUpdateItem = {
  id: string;
  title: string;
  category: string;
  description?: string;
  descriptionExcerpt: string;
  importance: string;
  pinned: boolean;
  requiresAcknowledgement?: boolean;
  acknowledgementVersion?: number;
  viewerAcknowledged?: boolean;
  viewerAcknowledgedAt?: string;
  acknowledgementSummary?: { acknowledged: number; total: number };
  postedByName: string;
  postedAt: string;
  updatedAt?: string;
  updatedByName?: string;
  actions?: {
    edit: boolean;
    delete: boolean;
    pin: boolean;
    viewAcknowledgements?: boolean;
  };
};

const importanceTone: Record<string, string> = {
  Normal: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)] ring-1 ring-[var(--status-neutral-border)]",
  Important: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] ring-1 ring-[var(--status-warning-border)]",
  Critical: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] ring-1 ring-[var(--status-danger-border)]",
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

export function ImportanceBadge({ importance }: { importance: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${importanceTone[importance] || importanceTone.Normal}`}>
      {importance}
    </span>
  );
}

const acknowledgedButtonClass =
  "pointer-events-none border-emerald-200 bg-emerald-50 text-emerald-800 opacity-100 shadow-none";

export function ViewerAcknowledgedBadge({ className }: { className?: string }) {
  return (
    <Button size="sm" variant="outline" disabled className={cn(acknowledgedButtonClass, className)}>
      Acknowledged
    </Button>
  );
}

type AckActivityRow = {
  userId: string;
  name: string;
  roleName: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
};

function AcknowledgementRosterDialog({
  item,
  open,
  onOpenChange,
}: {
  item: SupportUpdateItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const activity = useQuery({
    queryKey: ["support-update-acknowledgements", item.id],
    queryFn: () =>
      api<{
        acknowledgementVersion: number;
        acknowledged: number;
        total: number;
        rows: AckActivityRow[];
      }>(`/api/support-updates/${item.id}/acknowledgements`),
    enabled: open && Boolean(item.actions?.viewAcknowledgements),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-left">Who acknowledged</DialogTitle>
        </DialogHeader>
        {activity.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : activity.isError ? (
          <p className="text-sm text-destructive">Could not load acknowledgements.</p>
        ) : activity.data ? (
          <>
            <p className="text-xs text-muted-foreground">
              {activity.data.acknowledged} of {activity.data.total} acknowledged
            </p>
            <ul className="mt-3 max-h-[min(20rem,55vh)] space-y-2 overflow-y-auto">
              {activity.data.rows.map((row) => (
                <li
                  key={row.userId}
                  className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-border/60 pb-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.name}</p>
                    <p className="text-[11px] text-muted-foreground">{row.roleName}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className={row.acknowledged ? "font-medium text-emerald-700" : "text-muted-foreground"}>
                      {row.acknowledged ? "Acknowledged" : "Pending"}
                    </p>
                    <p className="text-muted-foreground">{row.acknowledgedAt ? formatWhen(row.acknowledgedAt) : "—"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AcknowledgementBesideAckButton({
  item,
  onOpenRoster,
}: {
  item: SupportUpdateItem;
  onOpenRoster: () => void;
}) {
  if (!item.requiresAcknowledgement || item.viewerAcknowledged) return null;
  const summary = item.acknowledgementSummary;
  const canOpenRoster = Boolean(item.actions?.viewAcknowledgements && summary);

  return (
    <span className="text-xs text-muted-foreground">
      Acknowledgement required
      {summary ? (
        <>
          {" · "}
          {canOpenRoster ? (
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenRoster();
              }}
            >
              {summary.acknowledged}/{summary.total} acknowledged
            </button>
          ) : (
            <span>{summary.acknowledged}/{summary.total} acknowledged</span>
          )}
        </>
      ) : null}
    </span>
  );
}

export function SupportUpdateCardToolbar({
  item,
  onView,
  onEdit,
  onPin,
  onDelete,
  readOnly,
}: {
  item: SupportUpdateItem;
  onView: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const [rosterOpen, setRosterOpen] = useState(false);

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onView}>
          View
        </Button>
        {item.requiresAcknowledgement && item.viewerAcknowledged ? <ViewerAcknowledgedBadge /> : null}
        {!readOnly && item.actions?.edit && onEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {!readOnly && item.actions?.pin && onPin ? (
          <Button type="button" size="sm" variant="outline" onClick={onPin}>
            {item.pinned ? "Unpin" : "Pin"}
          </Button>
        ) : null}
        {!readOnly && item.actions?.delete && onDelete ? (
          <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <SupportUpdateAcknowledgeButton item={item} />
          <AcknowledgementBesideAckButton item={item} onOpenRoster={() => setRosterOpen(true)} />
        </div>
      </div>
      {item.actions?.viewAcknowledgements ? (
        <AcknowledgementRosterDialog item={item} open={rosterOpen} onOpenChange={setRosterOpen} />
      ) : null}
    </>
  );
}

export function AcknowledgementStatusLine({
  item,
  hideViewerAcknowledged,
}: {
  item: SupportUpdateItem;
  /** When true, acknowledged state is shown in the card action row instead. */
  hideViewerAcknowledged?: boolean;
}) {
  if (!item.requiresAcknowledgement) return null;
  if (item.viewerAcknowledged) {
    if (hideViewerAcknowledged) return null;
    return <ViewerAcknowledgedBadge className="mt-0" />;
  }
  if (item.acknowledgementSummary) {
    return (
      <p className="text-xs text-muted-foreground">
        Acknowledgement required · {item.acknowledgementSummary.acknowledged}/{item.acknowledgementSummary.total} acknowledged
      </p>
    );
  }
  return <p className="text-xs font-medium text-amber-800">Acknowledgement required</p>;
}

export function SupportUpdateCard({
  item,
  compact,
  children,
  onOpenDetail,
  ackInToolbar,
}: {
  item: SupportUpdateItem;
  compact?: boolean;
  children?: ReactNode;
  onOpenDetail?: () => void;
  ackInToolbar?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border border-border bg-card shadow-[var(--shadow-card)] ${item.importance === "Critical" ? "border-destructive/35" : ""} ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {item.pinned ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        ) : null}
        <ImportanceBadge importance={item.importance} />
        <span>{item.category}</span>
      </div>
      {onOpenDetail ? (
        <button type="button" onClick={onOpenDetail} className="mt-2 text-left">
          <h3 className={`font-semibold text-foreground hover:text-primary ${compact ? "text-base" : "text-lg"}`}>{item.title}</h3>
        </button>
      ) : (
        <h3 className={`mt-2 font-semibold text-foreground ${compact ? "text-base" : "text-lg"}`}>{item.title}</h3>
      )}
      <p className={`mt-2 whitespace-pre-wrap text-foreground/90 ${compact ? "text-sm line-clamp-3" : "text-[15px] leading-relaxed"}`}>
        {linkify(compact ? item.descriptionExcerpt : item.description || item.descriptionExcerpt)}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {item.postedByName} · {formatWhen(item.postedAt)}
        {item.updatedByName && item.updatedAt && item.updatedAt !== item.postedAt ? (
          <span> · edited {formatWhen(item.updatedAt)}</span>
        ) : null}
      </p>
      {!ackInToolbar ? (
        <div className="mt-2">
          <AcknowledgementStatusLine item={item} />
        </div>
      ) : null}
      {children}
    </article>
  );
}

export function SupportUpdateAcknowledgeButton({ item }: { item: SupportUpdateItem }) {
  const { readOnly, effective } = useAuth();
  const client = useQueryClient();
  const ack = useMutation({
    mutationFn: () => api<{ item: SupportUpdateItem }>(`/api/support-updates/${item.id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["dashboard", effective?.id] });
      void client.invalidateQueries({ queryKey: ["support-updates"] });
      void client.invalidateQueries({ queryKey: ["support-update", item.id] });
      void client.invalidateQueries({ queryKey: ["support-update-acknowledgements", item.id] });
    },
  });
  if (!item.requiresAcknowledgement || item.viewerAcknowledged) return null;
  if (readOnly) return null;
  return (
    <Button
      size="sm"
      disabled={ack.isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        ack.mutate();
      }}
    >
      Read & Acknowledge
    </Button>
  );
}

export function LatestSupportUpdatesSection({
  items,
  showViewAll = true,
}: {
  items: SupportUpdateItem[];
  showViewAll?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Latest Support Updates</h2>
        {showViewAll ? (
          <Link to="/support-updates" className="text-xs font-medium text-primary">
            View all updates →
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          No support updates yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const pendingAck = item.requiresAcknowledgement && !item.viewerAcknowledged;
            if (pendingAck) {
              return (
                <SupportUpdateCard key={item.id} item={item} compact ackInToolbar>
                  <SupportUpdateCardToolbar
                    item={item}
                    onView={() => navigate("/support-updates")}
                  />
                </SupportUpdateCard>
              );
            }
            return (
              <Link key={item.id} to="/support-updates" className="block">
                <SupportUpdateCard item={item} compact />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
