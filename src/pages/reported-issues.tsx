import { Link, Navigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

export type ReportedIssueItem = {
  id: string;
  sourceType: string;
  sourceTypeLabel: string;
  sourceId: string;
  sourceLabel: string;
  sourceHref: string;
  sourceAvailable: boolean;
  sourceUnavailableReason?: string;
  description: string;
  priority: string;
  status: string;
  reportedById: string;
  reportedByName: string;
  reportedAt: string;
  resolutionNote: string;
  noActionReason: string;
  resolvedAt: string | null;
  resolvedByName: string;
  updatedAt: string;
  actions: { manage: boolean };
};

const priorityTone: Record<string, string> = {
  Normal: "bg-slate-100 text-slate-700",
  Important: "bg-amber-100 text-amber-900",
  Critical: "bg-rose-100 text-rose-900",
};

const statusTone: Record<string, string> = {
  "Pending Review": "bg-blue-100 text-blue-900",
  "In Progress": "bg-violet-100 text-violet-900",
  Resolved: "bg-emerald-100 text-emerald-900",
  "No Action Required": "bg-slate-200 text-slate-800",
};

export function ReportedIssuesPage() {
  const { can } = useAuth();

  if (!can("reported_issues.view_all", "reported_issues.view_own")) return <Navigate to="/" replace />;

  const title = can("reported_issues.view_all") ? "Reported Issues" : "My Reported Issues";

  return <ReportedIssuesList title={title} />;
}

function ReportedIssuesList({ title }: { title: string }) {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);

  const meta = useQuery({
    queryKey: ["reported-issues-meta"],
    queryFn: () =>
      api<{ sourceTypes: { key: string; label: string }[]; priorities: string[]; statuses: string[]; authors: { id: string; name: string }[] }>(
        "/api/reported-issues/meta",
      ),
  });

  const list = useQuery({
    queryKey: ["reported-issues", q, sourceType, priority, status, reportedBy, from, to, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "40", offset: String(offset) });
      if (q) params.set("q", q);
      if (sourceType) params.set("sourceType", sourceType);
      if (priority) params.set("priority", priority);
      if (status) params.set("status", status);
      if (reportedBy) params.set("reportedBy", reportedBy);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return api<{ items: ReportedIssueItem[]; total: number }>(`/api/reported-issues?${params}`);
    },
  });

  if (list.isLoading || meta.isLoading) return <LoadingBlock />;
  if (list.isError) return <ErrorBlock message={list.error.message} />;

  const items = list.data?.items || [];
  const total = list.data?.total || 0;
  const emptyBody = can("reported_issues.view_all")
    ? "Issues reported from Support resources will appear here."
    : "Issues you report will appear here.";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHeader eyebrow="Support resources" title={title} />

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <Input className="max-w-xs" placeholder="Search…" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (setQ(draftQ.trim()), setOffset(0))} />
        <Select value={sourceType || "all"} onValueChange={(v) => { setSourceType(v === "all" ? "" : v); setOffset(0); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {(meta.data?.sourceTypes || []).map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority || "all"} onValueChange={(v) => { setPriority(v === "all" ? "" : v); setOffset(0); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {(meta.data?.priorities || []).map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status || "all"} onValueChange={(v) => { setStatus(v === "all" ? "" : v); setOffset(0); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {(meta.data?.statuses || []).map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {can("reported_issues.view_all") ? (
          <Select value={reportedBy || "all"} onValueChange={(v) => { setReportedBy(v === "all" ? "" : v); setOffset(0); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Reported by" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              {(meta.data?.authors || []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Input type="date" className="w-36" value={from} onChange={(e) => { setFrom(e.target.value); setOffset(0); }} />
        <Input type="date" className="w-36" value={to} onChange={(e) => { setTo(e.target.value); setOffset(0); }} />
        <Button variant="secondary" size="sm" onClick={() => { setQ(draftQ.trim()); setOffset(0); }}>Search</Button>
      </div>

      {items.length === 0 ? (
        <Empty title="No reported issues" body={emptyBody} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Reported</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">By</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{formatWhen(row.reportedAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{row.sourceTypeLabel}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{row.sourceLabel}</td>
                  <td className="max-w-xs px-4 py-3">
                    <Link to={`/reported-issues/${row.id}`} className="line-clamp-2 text-blue-700 hover:underline">
                      {row.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.reportedByName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone[row.priority] || priorityTone.Normal}`}>{row.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone[row.status] || ""}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {offset + items.length < total ? (
            <div className="border-t p-3">
              <Button variant="secondary" className="w-full" onClick={() => setOffset(offset + 40)}>Load more</Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ReportedIssueDetailPage() {
  const { id } = useParams();
  if (!id) return <Navigate to="/reported-issues" replace />;
  return <ReportedIssueDetail id={id} />;
}

function ReportedIssueDetail({ id }: { id: string }) {
  const { canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [noActionReason, setNoActionReason] = useState("");

  const query = useQuery({
    queryKey: ["reported-issue", id],
    queryFn: () => api<{ item: ReportedIssueItem }>(`/api/reported-issues/${id}`),
  });

  const save = useMutation({
    mutationFn: () =>
      api<{ item: ReportedIssueItem }>(`/api/reported-issues/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: status || undefined,
          priority: priority || undefined,
          resolutionNote,
          noActionReason,
        }),
      }),
    onSuccess: () => {
      toast.success("Report updated");
      void query.refetch();
      void client.invalidateQueries({ queryKey: ["reported-issues"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;
  const item = query.data!.item;
  const manage = item.actions.manage && canMutate("reported_issues.manage") && !readOnly;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <Link to="/reported-issues" className="text-sm text-blue-700">
        ← Reported Issues
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone[item.priority]}`}>{item.priority}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone[item.status]}`}>{item.status}</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">{item.sourceLabel}</h1>
        <p className="text-sm text-slate-500">{item.sourceTypeLabel} · Reported {formatWhen(item.reportedAt)} by {item.reportedByName}</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Source</h2>
        <p className="text-sm text-slate-700">{item.sourceTypeLabel}<br />{item.sourceLabel}</p>
        {item.sourceAvailable ? (
          <Link to={item.sourceHref} className="text-sm font-medium text-blue-700">View source →</Link>
        ) : (
          <p className="text-sm text-amber-800">{item.sourceUnavailableReason || "Source unavailable"}</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">Report</h2>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{item.description}</p>
      </section>

      {(item.status === "Resolved" && item.resolutionNote) || (item.status === "No Action Required" && item.noActionReason) ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Outcome</h2>
          {item.resolutionNote ? <p className="text-sm"><strong>Resolution:</strong> {item.resolutionNote}</p> : null}
          {item.noActionReason ? <p className="text-sm"><strong>No action:</strong> {item.noActionReason}</p> : null}
          {item.resolvedByName && item.resolvedAt ? (
            <p className="text-xs text-slate-500">Resolved by {item.resolvedByName} · {formatWhen(item.resolvedAt)}</p>
          ) : null}
        </section>
      ) : null}

      {manage ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Workflow</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status || item.status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Pending Review", "In Progress", "Resolved", "No Action Required"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority || item.priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Normal", "Important", "Critical"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(status || item.status) === "Resolved" || item.status === "Resolved" ? (
            <div className="space-y-2">
              <Label>Resolution note (optional)</Label>
              <Textarea rows={3} value={resolutionNote || item.resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} />
            </div>
          ) : null}
          {(status || item.status) === "No Action Required" ? (
            <div className="space-y-2">
              <Label>Reason (required)</Label>
              <Textarea rows={3} value={noActionReason || item.noActionReason} onChange={(e) => setNoActionReason(e.target.value)} />
            </div>
          ) : null}
          <Button disabled={save.isPending} onClick={() => save.mutate()}>Save changes</Button>
        </section>
      ) : null}
    </div>
  );
}
