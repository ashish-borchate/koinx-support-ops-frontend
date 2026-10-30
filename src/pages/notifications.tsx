import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  readAt: string | null;
  actionRequired: boolean;
  destinationUrl: string;
  createdAt: string;
  relatedAgentId: string | null;
};

export function NotificationsPage() {
  const { can, viewAs } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("open");
  const [filter, setFilter] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [offset, setOffset] = useState(0);
  const limit = 30;
  const readOnly = Boolean(viewAs);

  const queryString = useMemo(() => {
    const p = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status === "open" || status === "resolved") p.set("status", status);
    if (filter === "unread") p.set("unread", "1");
    if (filter === "action") p.set("action", "1");
    if (category !== "all") p.set("category", category);
    return p.toString();
  }, [status, filter, category, offset]);

  const listQ = useQuery({
    queryKey: ["notifications-list", queryString],
    queryFn: () =>
      api<{ items: NotificationRow[]; total: number; unread: number }>(`/api/notifications?${queryString}`),
    enabled: can("notification_center.view_own") || can("notification_center.view_team"),
  });

  async function markRead(id: string) {
    if (readOnly) return;
    await api(`/api/notifications/${id}/read`, { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  }

  async function markAllRead() {
    if (readOnly) return;
    await api("/api/notifications/read-all", { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
    await queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  }

  if (!can("notification_center.view_own") && !can("notification_center.view_team")) {
    return <ErrorBlock title="Forbidden" detail="You do not have access to the Notification Center." />;
  }

  if (listQ.isLoading) return <LoadingBlock label="Loading notifications…" />;
  if (listQ.isError) return <ErrorBlock title="Could not load notifications" detail={String(listQ.error)} />;

  const items = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="Persistent in-app alerts for your responsibilities. Marking read does not resolve the underlying work item."
        actions={
          <div className="flex flex-wrap gap-2">
            {can("notification_center.view_team") ? (
              <Button variant="outline" asChild>
                <Link to="/performance-center?focus=attention">Needs attention</Link>
              </Button>
            ) : null}
            <Button variant="secondary" disabled={readOnly} onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v); setOffset(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved / history</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={(v) => { setFilter(v); setOffset(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Read state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread only</SelectItem>
            <SelectItem value="action">Action required</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v); setOffset(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="product_guides">Product Guides</SelectItem>
            <SelectItem value="qa">QA</SelectItem>
            <SelectItem value="reported_issues">Reported Issues</SelectItem>
            <SelectItem value="coaching">Coaching</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <Empty title="No notifications" detail="Nothing matches these filters." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card shadow-[var(--shadow-card)]">
          {items.map((row) => (
            <li key={row.id} className={cn("p-4", !row.readAt && "bg-primary/[0.03]")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="uppercase">{row.category.replace(/_/g, " ")}</span>
                    <span>·</span>
                    <span className={row.priority === "critical" ? "text-destructive" : ""}>{row.priority}</span>
                    {row.actionRequired ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">Action required</span> : null}
                    {row.status === "resolved" ? <span className="rounded bg-muted px-1.5 py-0.5">Resolved</span> : null}
                    {!row.readAt ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">Unread</span> : null}
                  </div>
                  <p className="font-medium">{row.title}</p>
                  {row.message ? <p className="text-sm text-muted-foreground">{row.message}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatWhen(row.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {row.destinationUrl ? (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={row.destinationUrl}>Open</Link>
                    </Button>
                  ) : null}
                  {!row.readAt && !readOnly ? (
                    <Button size="sm" variant="secondary" onClick={() => void markRead(row.id)}>
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {offset + limit < total ? (
        <Button variant="outline" onClick={() => setOffset((o) => o + limit)}>
          Load more
        </Button>
      ) : null}
    </div>
  );
}
