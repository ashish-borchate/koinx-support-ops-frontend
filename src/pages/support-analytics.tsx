import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Info, RefreshCw } from "lucide-react";
import {
  DataTableShell,
  Empty,
  ErrorBlock,
  LoadingBlock,
  PageHeader,
  SectionHeader,
} from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatCalendarDate, formatNumber, formatWhen } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type OverviewPayload = {
  range: { from: string; to: string; timezone: string };
  compare: Record<string, number> | null;
  freshness: {
    lastSuccessfulTicketSyncAt: string | null;
    ticketsStored: number;
    coverageNote: string;
    lastError: string;
    partialBackfill: boolean;
  };
  metrics: {
    ticketsCreated: number;
    ticketsResolved: number;
    backlogOpen: number;
    pending: number;
    unassigned: number;
    overdueResolution: number;
    overdueFirstResponse: number;
  };
  breakdown: {
    byStatus: { id: number; label: string; count: number }[];
    byPriority: { id: number; label: string; count: number }[];
  };
  definitions: { id: string; label: string; description: string; kind: string; notes?: string }[];
};

type TicketRow = {
  freshdeskId: number;
  url: string | null;
  statusLabel: string;
  priorityLabel: string;
  sourceLabel: string;
  ticketType: string;
  updatedAt: string;
  assignmentProxy?: boolean;
};

function MetricCard({
  title,
  value,
  hint,
  onDrill,
}: {
  title: string;
  value: number;
  hint?: string;
  onDrill?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDrill}
      className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 disabled:cursor-default"
      disabled={!onDrill}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatNumber(value)}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </button>
  );
}

export function SupportAnalyticsPage() {
  const { can, readOnly } = useAuth();
  const qc = useQueryClient();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [compare, setCompare] = useState(true);
  const [drillKind, setDrillKind] = useState<string | null>(null);

  const queryKey = useMemo(() => ["support-analytics", "overview", from, to, compare], [from, to, compare]);

  const overview = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (compare) params.set("compare", "true");
      const q = params.toString();
      return api<OverviewPayload>(`/support-analytics/overview${q ? `?${q}` : ""}`);
    },
    staleTime: STALE.operational,
  });

  const tickets = useQuery({
    queryKey: ["support-analytics", "tickets", drillKind, from, to],
    enabled: Boolean(drillKind),
    queryFn: () => {
      const params = new URLSearchParams({ kind: drillKind! });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return api<{ tickets: TicketRow[] }>(`/support-analytics/tickets?${params}`);
    },
  });

  const syncRun = useMutation({
    mutationFn: () => api<{ run: { status: string; message: string } }>("/support-analytics/sync/run", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-analytics"] });
    },
  });

  const canSync = can("support_analytics.sync") && !readOnly;
  const data = overview.data;
  const freshness = data?.freshness;

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        eyebrow="Operations"
        title="Support Analytics"
        description="Freshdesk ticket operations — separate from official KPI Performance scoring."
        action={
          canSync ? (
            <Button
              variant="outline"
              size="sm"
              disabled={syncRun.isPending}
              onClick={() => syncRun.mutate()}
            >
              <RefreshCw className={syncRun.isPending ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Sync Freshdesk
            </Button>
          ) : null
        }
      />

      {freshness ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            freshness.partialBackfill || freshness.lastError
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-border bg-muted/30"
          }`}
        >
          <p className="font-medium text-foreground">Data freshness</p>
          <p className="mt-1 text-muted-foreground">
            {freshness.ticketsStored} tickets in analytics store
            {freshness.lastSuccessfulTicketSyncAt
              ? ` · Last sync ${formatWhen(freshness.lastSuccessfulTicketSyncAt)}`
              : " · No successful sync yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{freshness.coverageNote}</p>
          {freshness.lastError ? (
            <p className="mt-1 text-xs text-destructive">Last sync error: {freshness.lastError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">From (IST)</label>
          <Input type="date" className="h-9 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">To (IST)</label>
          <Input type="date" className="h-9 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant={compare ? "default" : "outline"} size="sm" onClick={() => setCompare((v) => !v)}>
          Compare prior period
        </Button>
        {data?.definitions ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Info className="mr-2 h-4 w-4" />
                Metric definitions
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Metric definitions</DialogTitle>
              </DialogHeader>
              <ul className="space-y-3 text-sm">
                {data.definitions.map((d) => (
                  <li key={d.id}>
                    <p className="font-medium">
                      {d.label}{" "}
                      <span className="text-xs font-normal text-muted-foreground">({d.kind})</span>
                    </p>
                    <p className="text-muted-foreground">{d.description}</p>
                    {d.notes ? <p className="text-xs text-amber-700 dark:text-amber-400">{d.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {overview.isLoading ? <LoadingBlock label="Loading analytics…" /> : null}
      {overview.isError ? <ErrorBlock message="Could not load Support Analytics." /> : null}

      {data ? (
        <>
          {data.range ? (
            <p className="text-sm text-muted-foreground">
              Period {formatCalendarDate(data.range.from)} – {formatCalendarDate(data.range.to)} ({data.range.timezone})
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Tickets created"
              value={data.metrics.ticketsCreated}
              onDrill={() => setDrillKind("created")}
            />
            <MetricCard
              title="Tickets resolved"
              value={data.metrics.ticketsResolved}
              onDrill={() => setDrillKind("resolved")}
            />
            <MetricCard
              title="Backlog (synced)"
              value={data.metrics.backlogOpen}
              hint="Snapshot among stored tickets"
              onDrill={() => setDrillKind("backlog")}
            />
            <MetricCard
              title="Unassigned backlog"
              value={data.metrics.unassigned}
              hint="Assignment-based proxy"
              onDrill={() => setDrillKind("unassigned")}
            />
            <MetricCard
              title="Pending"
              value={data.metrics.pending}
              onDrill={() => setDrillKind("pending")}
            />
            <MetricCard
              title="Overdue (resolution SLA)"
              value={data.metrics.overdueResolution}
              onDrill={() => setDrillKind("overdue_resolution")}
            />
            <MetricCard
              title="FR SLA overdue / missed"
              value={data.metrics.overdueFirstResponse}
              onDrill={() => setDrillKind("backlog")}
            />
          </div>

          {data.compare ? (
            <p className="text-xs text-muted-foreground">
              Prior period — created {formatNumber(data.compare.ticketsCreated)}, resolved{" "}
              {formatNumber(data.compare.ticketsResolved)}
            </p>
          ) : null}

          <SectionHeader title="Status breakdown (backlog)" />
          <DataTableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.byStatus.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>

          <SectionHeader title="Priority breakdown (backlog)" />
          <DataTableShell>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2 text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.byPriority.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-3 py-2">{row.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        </>
      ) : null}

      {drillKind ? (
        <div className="space-y-3">
          <SectionHeader title={`Tickets · ${drillKind.replace(/_/g, " ")}`} />
          {tickets.isLoading ? <LoadingBlock label="Loading tickets…" /> : null}
          {tickets.data?.tickets.length === 0 ? (
            <Empty title="No tickets in this slice" body="Nothing in the analytics store matches this filter yet." />
          ) : null}
          {tickets.data && tickets.data.tickets.length > 0 ? (
            <DataTableShell>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2">Ticket</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Priority</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {tickets.data.tickets.map((t) => (
                    <tr key={t.freshdeskId} className="border-b border-border/60">
                      <td className="px-3 py-2 font-medium">#{t.freshdeskId}</td>
                      <td className="px-3 py-2">{t.statusLabel}</td>
                      <td className="px-3 py-2">{t.priorityLabel}</td>
                      <td className="px-3 py-2">{t.ticketType || "—"}</td>
                      <td className="px-3 py-2">{formatWhen(t.updatedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        {t.url ? (
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-primary hover:underline"
                          >
                            Freshdesk
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          ) : null}
        </div>
      ) : null}

      {syncRun.data?.run ? (
        <p className="text-xs text-muted-foreground">
          Sync: {syncRun.data.run.status} — {syncRun.data.run.message}
        </p>
      ) : null}
    </div>
  );
}
