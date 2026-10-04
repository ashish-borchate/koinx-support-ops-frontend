import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBlock, LoadingBlock, PageHeader, SourceBadge } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDays, formatNumber, formatWeek, recentWeeks, weekStartKey, type Metric } from "@/lib/format";

type Weekly = {
  label: string;
  partial: boolean;
  commentary: string;
  ticketHealth: Record<string, Metric | undefined> & { deltas: Record<string, number | null> };
  qa: { reviews: number; average: number | null; weakCategories: { label: string; count: number }[] };
  documentation: { created: number; updated: number; pending: number; overdue: number };
  product: { openEscalations: number; topIssues: { name: string; count: number }[] };
  operations: { tasksCompleted: number; tasksOpen: number };
  attention: { text: string }[];
  agents: { name: string; slaPercent: Metric; csatPercent: Metric }[];
};

export function WeeklyPage() {
  const { canMutate } = useAuth();
  const client = useQueryClient();
  const [week, setWeek] = useState(addDays(weekStartKey(), -7));
  const query = useQuery({ queryKey: ["weekly", week], queryFn: () => api<Weekly>(`/api/weekly?week=${week}`) });
  const [draft, setDraft] = useState<string | null>(null);
  const commentary = draft ?? query.data?.commentary ?? "";
  const save = useMutation({
    mutationFn: () => api(`/api/weekly/${week}`, { method: "PUT", body: JSON.stringify({ commentary }) }),
    onSuccess: () => {
      toast.success("Commentary saved");
      setDraft(null);
      void client.invalidateQueries({ queryKey: ["weekly", week] });
    },
    onError: (error) => toast.error(error.message),
  });
  const health = query.data?.ticketHealth;
  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Weekly summary"
        action={
          <Select value={week} onValueChange={(value) => { setWeek(value); setDraft(null); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{recentWeeks().map((item) => <SelectItem key={item} value={item}>{formatWeek(item)}</SelectItem>)}</SelectContent>
          </Select>
        }
      />
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.data && health ? (
        <div className="space-y-4">
          {query.data.partial ? <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">This week is still in progress. Treat the totals as a midpoint, not a verdict.</p> : null}
          <Section title="Ticket health">
            <MetricLine label="Received" metric={health.received} />
            <MetricLine label="Resolved" metric={health.resolved} />
            <MetricLine label="Backlog" metric={health.backlog} />
            <MetricLine label="Pending" metric={health.pending} />
            <MetricLine label="SLA" metric={health.sla} suffix="%" />
            <MetricLine label="First response" metric={health.firstResponseHours} suffix="h" />
            <MetricLine label="Resolution" metric={health.resolutionHours} suffix="h" />
          </Section>
          <Section title="Team performance">
            <p className="text-sm">QA average {query.data.qa.average ?? "—"} from {query.data.qa.reviews} human reviews.</p>
            <MetricLine label="CSAT" metric={health.csat} suffix="%" />
            {query.data.qa.weakCategories.map((item) => <p key={item.label} className="text-sm">{item.label} missed the bar {item.count} times</p>)}
            {query.data.agents.filter((agent) => (agent.slaPercent.value ?? 100) < 95).map((agent) => (
              <p key={agent.name} className="text-sm">{agent.name} SLA {formatNumber(agent.slaPercent.value, 1)}%</p>
            ))}
          </Section>
          <Section title="Product">
            <p className="text-sm">{query.data.product.openEscalations} escalations still open.</p>
            {query.data.product.topIssues.map((issue) => <p key={issue.name} className="text-sm">{issue.name} · {issue.count}</p>)}
          </Section>
          <Section title="Documentation">
            <p className="text-sm">{query.data.documentation.created} created in the week · {query.data.documentation.updated} touched · {query.data.documentation.pending} pending · {query.data.documentation.overdue} overdue for review.</p>
          </Section>
          <Section title="Risks and attention">
            {query.data.attention.length === 0 ? <p className="text-sm text-muted-foreground">No automatic risks for this week.</p> : null}
            {query.data.attention.map((item) => <p key={item.text} className="text-sm">{item.text}</p>)}
            <p className="text-sm">{query.data.operations.tasksOpen} operational tasks still open. {query.data.operations.tasksCompleted} were completed in the week.</p>
          </Section>
          <Card>
            <CardHeader><CardTitle>Commentary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Written by a person. The numbers above are assembled from KPI, QA, guides, escalations, and tasks.</p>
              {canMutate("weekly.edit") ? (
                <>
                  <Textarea value={commentary} onChange={(event) => setDraft(event.target.value)} className="min-h-32" />
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>Save commentary</Button>
                </>
              ) : (
                <p className="whitespace-pre-wrap text-sm">{commentary || "No commentary yet."}</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function MetricLine({ label, metric, suffix = "" }: { label: string; metric?: Metric; suffix?: string }) {
  if (!metric) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-36 text-muted-foreground">{label}</span>
      <span className="font-medium">{formatNumber(metric.value, 1)}{metric.value == null ? "" : suffix}</span>
      <SourceBadge metric={metric} />
    </p>
  );
}
