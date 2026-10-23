import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { QaModuleNav } from "@/components/qa-module-nav";
import { DataTableShell, Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatMonth, formatWeek, monthKey, recentMonths, recentWeeks } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { QaRandomAuditDetail, QaRandomAuditOutcome } from "@/pages/qa-types";
import { formatQaRandomAuditDate } from "@/pages/qa-random-audit-ui";

const outcomeStyles: Record<QaRandomAuditOutcome, string> = {
  accurate: "text-emerald-700 dark:text-emerald-300",
  minor_issue: "text-amber-700 dark:text-amber-300",
  major_issue: "text-rose-700 dark:text-rose-300",
};

export function QaRandomAuditsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [week, setWeek] = useState(recentWeeks()[recentWeeks().length - 1]);
  const [month, setMonth] = useState(monthKey());
  const [reviewerFilter, setReviewerFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");

  const query = useQuery({
    queryKey: ["qa-random-audits", periodType, week, month, reviewerFilter, outcomeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ periodType });
      if (periodType === "weekly") params.set("week", week);
      else params.set("month", month);
      if (reviewerFilter !== "all") params.set("reviewerId", reviewerFilter);
      if (outcomeFilter !== "all") params.set("outcome", outcomeFilter);
      return api<{ audits: QaRandomAuditDetail[] }>(`/api/qa/random-audits?${params.toString()}`);
    },
    enabled: can("qa.random_audit.view_team"),
  });

  const reviewers = useMemo(() => {
    if (!query.data) return [];
    const map = new Map<string, string>();
    for (const row of query.data.audits) map.set(row.qaReviewerId, row.qaReviewerName);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [query.data]);

  return (
    <div className="space-y-5">
      <PageHeader title="QA Performance" description="Random audits of Senior Agent QA evaluations." className="mb-2" />
      <QaModuleNav />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={periodType} onValueChange={(v) => setPeriodType(v as "weekly" | "monthly")}>
          <SelectTrigger className="h-8 w-[7.5rem]" aria-label="Period type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        {periodType === "weekly" ? (
          <Select value={week} onValueChange={setWeek}>
            <SelectTrigger className="h-8 w-[10.5rem]" aria-label="Week"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...recentWeeks()].reverse().map((item) => (
                <SelectItem key={item} value={item}>{formatWeek(item)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="h-8 w-[10.5rem]" aria-label="Month"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...recentMonths()].reverse().map((item) => (
                <SelectItem key={item} value={item}>{formatMonth(item)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={reviewerFilter} onValueChange={setReviewerFilter}>
          <SelectTrigger className="h-8 w-[9.5rem]" aria-label="QA reviewer"><SelectValue placeholder="QA reviewer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reviewers</SelectItem>
            {reviewers.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
          <SelectTrigger className="h-8 w-[9rem]" aria-label="Outcome"><SelectValue placeholder="Outcome" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All outcomes</SelectItem>
            <SelectItem value="accurate">Accurate</SelectItem>
            <SelectItem value="minor_issue">Minor issue</SelectItem>
            <SelectItem value="major_issue">Major issue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}

      {query.data ? (
        query.data.audits.length === 0 ? (
          <Empty title="No random audits" body="No random audits match this period and filters." />
        ) : (
          <DataTableShell>
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Ticket</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">QA reviewer</th>
                  <th className="px-3 py-2 font-medium">QA score</th>
                  <th className="px-3 py-2 font-medium">Audited by</th>
                  <th className="px-3 py-2 font-medium">Outcome</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Audit date</th>
                  <th className="w-8 px-2 py-2" aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {query.data.audits.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-border/50 hover:bg-muted/30"
                    onClick={() => navigate(`/qa/${row.qaReviewId}`)}
                  >
                    <td className="px-3 py-2.5 font-medium">#{row.ticketRef}</td>
                    <td className="px-3 py-2.5">{row.agentName}</td>
                    <td className="px-3 py-2.5">{row.qaReviewerName}</td>
                    <td className="px-3 py-2.5 tabular-nums">{row.originalQaScore}</td>
                    <td className="px-3 py-2.5">{row.auditedByName}</td>
                    <td className={cn("px-3 py-2.5 font-medium", outcomeStyles[row.outcome])}>{row.outcomeLabel}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.workflowStatusLabel}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatQaRandomAuditDate(row.auditedAt)}</td>
                    <td className="px-2 py-2 text-muted-foreground"><ChevronRight className="size-4" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableShell>
        )
      ) : null}

      <p className="text-xs text-muted-foreground">
        <Link to="/qa" className="text-primary hover:underline">Back to QA evaluations</Link>
      </p>
    </div>
  );
}
