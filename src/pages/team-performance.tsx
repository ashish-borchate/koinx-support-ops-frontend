import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { DateRangeDialog } from "@/components/date-range-dialog";
import { api } from "@/lib/api";

type Preset = "this_week" | "last_week" | "this_month" | "last_month" | "custom";

type Dashboard = {
  period: { label: string; startIst: string; endIst: string };
  overview: Record<string, number | string | boolean | null>;
  comparison: {
    agentId: string;
    name: string;
    eligibleWorkingDays: number;
    pgCompleted: number;
    pgCompliancePercent: number | null;
    riResolved: number;
    riOverdueNow: number;
    productFeedbackSubmitted: number | null;
    qaAverage: number | null;
    kpiComposite: string | null;
    coachingPending: number | null;
    openTeamAttention: number;
  }[];
  trends: { weekStartIst: string; weekEndIst: string; complete: boolean; team: Record<string, number | null> }[];
};

const PRESETS: { value: Preset; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom range" },
];

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return String(v);
}

export function TeamPerformancePage() {
  const [preset, setPreset] = useState<Preset>("this_week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [sortKey, setSortKey] = useState("name");

  const qs = useMemo(() => {
    const p = new URLSearchParams({ preset });
    if (preset === "custom" && customFrom && customTo) {
      p.set("from", customFrom);
      p.set("to", customTo);
    }
    return p.toString();
  }, [preset, customFrom, customTo]);

  const dashQ = useQuery({
    queryKey: ["team-performance", qs],
    queryFn: () => api<Dashboard>(`/api/team-performance/dashboard?${qs}`),
    enabled: preset !== "custom" || (Boolean(customFrom) && Boolean(customTo)),
  });

  const rows = useMemo(() => {
    const list = [...(dashQ.data?.comparison ?? [])];
    list.sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      const av = (a as Record<string, unknown>)[sortKey] as number | null;
      const bv = (b as Record<string, unknown>)[sortKey] as number | null;
      return (bv ?? -1) - (av ?? -1);
    });
    return list;
  }, [dashQ.data, sortKey]);

  if (dashQ.isLoading) return <LoadingBlock label="Loading team performance…" />;
  if (dashQ.isError) return <ErrorBlock message={String(dashQ.error)} />;
  const d = dashQ.data!;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Team Performance"
        description="Management insights from live Hub modules. Period activity is separate from current outstanding work."
        secondaryAction={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/team-attention">Team Attention</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/weekly-agent-reviews">Weekly Reviews</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Select value={preset} onValueChange={(v) => setPreset(v as Preset)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {preset === "custom" ? (
          <Button variant="outline" onClick={() => setRangeOpen(true)}>
            {customFrom && customTo ? `${customFrom} – ${customTo}` : "Choose range"}
          </Button>
        ) : null}
      </div>

      <p className="text-sm text-muted-foreground">{d.period.label}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Active agents" value={String(d.overview.activeAgents)} />
        <Metric
          title="PG compliance (team)"
          value={
            d.overview.pgCompliancePercent != null
              ? `${d.overview.pgCompliancePercent}%`
              : "—"
          }
        />
        <Metric title="RI resolved (period)" value={String(d.overview.riResolvedTotal)} />
        <Metric title="RI overdue (now)" value={String(d.overview.riOverdueNowTotal)} />
        <Metric title="QA avg (period)" value={fmt(d.overview.qaAverageTeam as number | null)} />
        <Metric title="Team Attention (open)" value={String(d.overview.teamAttentionOpen)} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Sort comparison by</span>
        <Select value={sortKey} onValueChange={setSortKey}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="pgCompliancePercent">PG compliance</SelectItem>
            <SelectItem value="riOverdueNow">Overdue RIs</SelectItem>
            <SelectItem value="openTeamAttention">Team Attention</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <Empty title="No agents" body="No canonical agents found for comparison." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Eligible days</th>
                <th className="px-3 py-2">PG done</th>
                <th className="px-3 py-2">PG %</th>
                <th className="px-3 py-2">RI resolved</th>
                <th className="px-3 py-2">RI overdue</th>
                <th className="px-3 py-2">Feedback</th>
                <th className="px-3 py-2">QA avg</th>
                <th className="px-3 py-2">KPI</th>
                <th className="px-3 py-2">Attention</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.agentId} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2 tabular-nums">{row.eligibleWorkingDays}</td>
                  <td className="px-3 py-2 tabular-nums">{row.pgCompleted}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {fmt(row.pgCompliancePercent)}
                    {row.pgCompliancePercent != null ? "%" : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.riResolved}</td>
                  <td className="px-3 py-2 tabular-nums">{row.riOverdueNow}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(row.productFeedbackSubmitted)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmt(row.qaAverage)}</td>
                  <td className="px-3 py-2">{row.kpiComposite ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{row.openTeamAttention}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/agent-activity?agentId=${row.agentId}`}>Dashboard</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Weekly trends (team)</h2>
        <p className="text-xs text-muted-foreground">Incomplete weeks are labeled and use data available so far.</p>
        <ul className="space-y-2">
          {d.trends.map((w) => (
            <li key={w.weekStartIst} className="rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium">
                {w.weekStartIst} – {w.weekEndIst}
                {!w.complete ? " (in progress)" : ""}
              </span>
              <span className="ml-3 text-muted-foreground">
                PG {fmt(w.team.pgCompliancePercent)}% · RI resolved {w.team.riResolved} · overdue now{" "}
                {w.team.riOverdueNow}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <DateRangeDialog
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        initialFrom={customFrom}
        initialTo={customTo}
        onConfirm={(from: string, to: string) => {
          setCustomFrom(from);
          setCustomTo(to);
        }}
      />
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs uppercase text-muted-foreground">{title}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
