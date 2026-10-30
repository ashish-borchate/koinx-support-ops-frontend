import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

type ConcernRow = {
  id: string;
  agentId: string;
  agentName: string;
  category: string;
  concernType: string;
  description: string;
  priority: string;
  firstDetectedAt: string | null;
  status: string;
  deadlineIst: string | null;
  deadlineAt: string | null;
  destinationUrl: string;
};

type Summary = {
  agentsWithOpenConcerns: number;
  missedProductGuideReviews: number;
  overdueReportedIssues: number;
  pendingQaActions: number;
  overdueCoachingActions: number;
  totalOpenConcerns: number;
};

export function TeamAttentionPage() {
  const { can } = useAuth();
  const [agentId, setAgentId] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");

  const rosterQ = useQuery({
    queryKey: ["agent-activity-roster"],
    queryFn: () => api<{ agents: { id: string; name: string }[] }>("/api/agent-activity/roster"),
    enabled: can("notification_center.view_team"),
  });

  const attentionQ = useQuery({
    queryKey: ["team-attention"],
    queryFn: () => api<{ summary: Summary; items: ConcernRow[] }>("/api/team-attention"),
    enabled: can("notification_center.view_team"),
  });

  const items = useMemo(() => {
    let rows = attentionQ.data?.items ?? [];
    if (agentId !== "all") rows = rows.filter((r) => r.agentId === agentId);
    if (category !== "all") rows = rows.filter((r) => r.category === category);
    if (priority !== "all") rows = rows.filter((r) => r.priority === priority);
    return rows;
  }, [attentionQ.data, agentId, category, priority]);

  if (!can("notification_center.view_team")) {
    return <ErrorBlock title="Forbidden" detail="Team Attention is available to Senior Agents, Supervisors, and Admins." />;
  }

  if (attentionQ.isLoading) return <LoadingBlock label="Loading team concerns…" />;
  if (attentionQ.isError) return <ErrorBlock title="Could not load Team Attention" detail={String(attentionQ.error)} />;

  const summary = attentionQ.data?.summary;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Attention"
        description="Live operational concerns across agents. Rows disappear when the underlying record is resolved — no manual dismiss required."
        actions={
          <Button variant="outline" asChild>
            <Link to="/notifications">Your notifications</Link>
          </Button>
        }
      />

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard label="Agents with open concerns" value={summary.agentsWithOpenConcerns} />
          <SummaryCard label="Product Guide gaps" value={summary.missedProductGuideReviews} />
          <SummaryCard label="Overdue Reported Issues" value={summary.overdueReportedIssues} />
          <SummaryCard label="Pending QA actions" value={summary.pendingQaActions} />
          <SummaryCard label="Overdue Coaching" value={summary.overdueCoachingActions} />
          <SummaryCard label="Total open concerns" value={summary.totalOpenConcerns} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {(rosterQ.data?.agents ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem value="product_guides">Product Guides</SelectItem>
            <SelectItem value="reported_issues">Reported Issues</SelectItem>
            <SelectItem value="qa">QA</SelectItem>
            <SelectItem value="coaching">Coaching</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="important">Important</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <Empty title="No open concerns" detail="No operational items match these filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">First detected</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{row.agentName}</td>
                  <td className="px-4 py-3 capitalize">{row.category.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.description}</td>
                  <td className="px-4 py-3 capitalize">{row.priority}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.firstDetectedAt ? formatWhen(row.firstDetectedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.deadlineIst || (row.deadlineAt ? formatWhen(row.deadlineAt) : "—")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={row.destinationUrl}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
