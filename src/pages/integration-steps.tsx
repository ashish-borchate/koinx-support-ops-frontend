import { Link, NavLink, Outlet, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { ReportIssueButton } from "@/components/report-issue-dialog";
import { IntegrationStepsEditor } from "@/components/integration-steps-editor";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

export type IntegrationRow = {
  id: string;
  exchangeName: string;
  integrationType: string;
  contentUpdated: boolean;
  stepsHtml?: string;
  summaryOfChanges: string;
  whyChangesWereMade: string;
  workflowStatus: string;
  reviewStatus: string;
  mintlifyStatus: string;
  frontendStatus: string;
  overallStatus: string;
  assignedTechAgentName?: string;
  nextReviewDate?: string;
  reviewDue?: boolean;
  updatedAt?: string;
  slas?: Record<string, { state: string; timer?: string | null }>;
  actions?: Record<string, boolean>;
};

function IntegrationLayout() {
  const { can } = useAuth();
  const links = [
    { to: "/integration-steps/dashboard", label: "Dashboard", any: ["integration.dashboard"] },
    { to: "/integration-steps/tracker", label: "Tracker", any: ["integration.tracker"] },
    { to: "/integration-steps/reviews", label: "My reviews", any: ["integration.review"] },
    { to: "/integration-steps/tasks", label: "My tasks", any: ["integration.tech"] },
    { to: "/integration-steps/library", label: "Library", any: ["integration.library"] },
  ].filter((l) => can(...l.any));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Operations" title="Integration Steps" />
      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm ${isActive ? "bg-blue-50 font-medium text-blue-800" : "text-slate-600 hover:bg-slate-50"}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500">{label}</CardTitle></CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

export function IntegrationStepsDashboardPage() {
  const { can } = useAuth();
  const stats = useQuery({
    queryKey: ["is-stats"],
    queryFn: () => api<{ stats: Record<string, number> }>("/api/integration-steps/stats"),
    enabled: can("integration.dashboard"),
  });
  const reviews = useQuery({
    queryKey: ["is-reviews"],
    queryFn: () => api<{ integrations: IntegrationRow[] }>("/api/integration-steps?mode=reviews"),
    enabled: can("integration.review"),
  });
  const tech = useQuery({
    queryKey: ["is-tech"],
    queryFn: () => api<{ integrations: IntegrationRow[] }>("/api/integration-steps?mode=tech"),
    enabled: can("integration.tech"),
  });

  if (stats.isLoading) return <LoadingBlock />;
  return (
    <div className="space-y-6">
      {stats.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Total" value={stats.data.stats.total || 0} />
          <Stat label="Pending review" value={stats.data.stats.pendingReview || 0} />
          <Stat label="Pending approval" value={stats.data.stats.pendingApproval || 0} />
          <Stat label="Mintlify pending" value={stats.data.stats.mintlifyPending || 0} />
          <Stat label="Frontend pending" value={stats.data.stats.frontendPending || 0} />
          <Stat label="Overdue SLAs" value={stats.data.stats.overdue || 0} />
          <Stat label="Review due" value={stats.data.stats.reviewDue || 0} />
        </div>
      ) : null}
      {can("integration.review") ? (
        <Card>
          <CardHeader><CardTitle>Pending action by me</CardTitle></CardHeader>
          <CardContent>
            {reviews.data?.integrations.length === 0 ? (
              <Empty title="No integrations are waiting for review." body="Everything in your queue is up to date." />
            ) : (
              reviews.data?.integrations.map((row) => (
                <Link key={row.id} to={`/integration-steps/${row.id}`} className="block border-b py-2 last:border-0 hover:text-blue-700">
                  {row.exchangeName} · {row.slas?.review?.timer || row.slas?.review?.state}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
      {can("integration.tech") ? (
        <Card>
          <CardHeader><CardTitle>My frontend tasks</CardTitle></CardHeader>
          <CardContent>
            {tech.data?.integrations.length === 0 ? (
              <Empty title="No frontend tasks assigned to you." body="Assigned work will appear here." />
            ) : (
              tech.data?.integrations.map((row) => (
                <Link key={row.id} to={`/integration-steps/${row.id}`} className="block border-b py-2 last:border-0 hover:text-blue-700">
                  {row.exchangeName} · {row.frontendStatus} · {row.slas?.frontend?.timer || row.slas?.frontend?.state}
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
      {can("integration.library") && !can("integration.tracker") ? (
        <Card>
          <CardHeader><CardTitle>Integration library</CardTitle></CardHeader>
          <CardContent>
            <Link to="/integration-steps/library" className="text-sm text-blue-700">Browse published integration instructions</Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function IntegrationTrackerPage() {
  const { canMutate } = useAuth();
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["is-tracker", q],
    queryFn: () => api<{ integrations: IntegrationRow[] }>(`/api/integration-steps?mode=tracker${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Input className="max-w-md" placeholder="Search exchange" value={q} onChange={(e) => setQ(e.target.value)} />
        {canMutate("integration.manage") ? (
          <Link to="/integration-steps/new" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground">
            New integration
          </Link>
        ) : null}
      </div>
      {list.isLoading ? <LoadingBlock /> : null}
      {list.data?.integrations.length === 0 ? (
        <Empty title="No integrations yet" body="Integration records will appear here once they are created." />
      ) : null}
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Exchange</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2">Workflow</th>
              <th className="px-3 py-2">Review</th>
              <th className="px-3 py-2">Mintlify</th>
              <th className="px-3 py-2">Frontend</th>
              <th className="px-3 py-2">Tech Agent</th>
              <th className="px-3 py-2">Next review</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.integrations.map((row, index) => (
              <tr key={row.id} className="border-t hover:bg-slate-50">
                <td className="px-3 py-2">{index + 1}</td>
                <td className="px-3 py-2"><Link className="font-medium text-blue-700" to={`/integration-steps/${row.id}`}>{row.exchangeName}</Link></td>
                <td className="px-3 py-2">{row.integrationType}</td>
                <td className="px-3 py-2">{row.contentUpdated ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{row.workflowStatus}</td>
                <td className="px-3 py-2">{row.reviewStatus}</td>
                <td className="px-3 py-2">{row.mintlifyStatus}</td>
                <td className="px-3 py-2">{row.frontendStatus}</td>
                <td className="px-3 py-2">{row.assignedTechAgentName || "—"}</td>
                <td className="px-3 py-2">{row.nextReviewDate || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IntegrationLibraryPage() {
  const [q, setQ] = useState("");
  const list = useQuery({
    queryKey: ["is-library", q],
    queryFn: () => api<{ integrations: IntegrationRow[] }>(`/api/integration-steps?mode=library${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });
  return (
    <div className="space-y-4">
      <Input placeholder="Search exchange" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.data?.integrations.length === 0 ? (
        <Empty title="No published integrations yet" body="Published integration instructions will appear in the library." />
      ) : null}
      <div className="grid gap-3">
        {list.data?.integrations.map((row) => (
          <Link key={row.id} to={`/integration-steps/${row.id}`} className="rounded-xl border bg-white px-4 py-3 hover:border-blue-200">
            <p className="font-medium">{row.exchangeName}</p>
            <p className="text-xs text-slate-500">{row.integrationType} · Updated {formatWhen(row.updatedAt)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function IntegrationReviewsPage() {
  return <IntegrationStepsDashboardPage />;
}

export function IntegrationTasksPage() {
  return <IntegrationStepsDashboardPage />;
}

export function IntegrationFormPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [exchangeName, setExchangeName] = useState("");
  const [integrationType, setIntegrationType] = useState("API");
  const [contentUpdated, setContentUpdated] = useState(false);
  const [summaryOfChanges, setSummaryOfChanges] = useState("");
  const [whyChangesWereMade, setWhyChangesWereMade] = useState("");
  const [stepsHtml, setStepsHtml] = useState("");

  const save = useMutation({
    mutationFn: (): Promise<{ id: string }> =>
      api("/api/integration-steps", {
        method: "POST",
        body: JSON.stringify({ exchangeName, integrationType, contentUpdated, summaryOfChanges, whyChangesWereMade, stepsHtml }),
      }),
    onSuccess: (data) => {
      toast.success("Integration created");
      void client.invalidateQueries({ queryKey: ["is-tracker"] });
      navigate(`/integration-steps/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      className="mx-auto max-w-3xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <PageHeader title="New integration" />
      <Label>Exchange name</Label><Input value={exchangeName} onChange={(e) => setExchangeName(e.target.value)} required />
      <Label>Integration type</Label>
      <Select value={integrationType} onValueChange={setIntegrationType}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {["File Upload", "API", "Direct Connect"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Label>Updated?</Label>
      <Select value={contentUpdated ? "yes" : "no"} onValueChange={(v) => setContentUpdated(v === "yes")}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
      </Select>
      <Label>Summary of changes</Label><Textarea value={summaryOfChanges} onChange={(e) => setSummaryOfChanges(e.target.value)} />
      <Label>Why changes were made</Label><Textarea value={whyChangesWereMade} onChange={(e) => setWhyChangesWereMade(e.target.value)} />
      <Label>Integration steps</Label>
      <IntegrationStepsEditor value={stepsHtml} onChange={setStepsHtml} />
      <Button type="submit" disabled={save.isPending}>Create</Button>
    </form>
  );
}

export function IntegrationDetailPage() {
  const { id } = useParams();
  const { canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const [feedback, setFeedback] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [clarification, setClarification] = useState("");
  const [clarificationResponse, setClarificationResponse] = useState("");
  const [techNotes, setTechNotes] = useState("");
  const [mintlifyNotes, setMintlifyNotes] = useState("");
  const [techAgentId, setTechAgentId] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: ["is-detail", id],
    queryFn: () =>
      api<{ integration: IntegrationRow; activity: { summary: string; actorName: string; createdAt: string }[]; versions: { version: number; summaryNote: string; savedByName: string; createdAt: string }[] }>(
        `/api/integration-steps/${id}`,
      ),
    enabled: Boolean(id),
  });
  const techAgents = useQuery({
    queryKey: ["is-tech-agents"],
    queryFn: () => api<{ users: { id: string; name: string }[] }>("/api/integration-steps/tech-agents"),
    enabled: canMutate("integration.manage"),
  });

  useEffect(() => {
    if (query.data?.integration.stepsHtml) setEditHtml(query.data.integration.stepsHtml);
  }, [query.data?.integration.stepsHtml]);

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object }) =>
      api(`/api/integration-steps/${id}${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      toast.success("Updated");
      void client.invalidateQueries({ queryKey: ["is-detail", id] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: () => api(`/api/integration-steps/${id}`, { method: "PATCH", body: JSON.stringify({ stepsHtml: editHtml }) }),
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      void client.invalidateQueries({ queryKey: ["is-detail", id] });
    },
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) return <ErrorBlock message={query.error?.message || "Not found"} />;
  const { integration, activity, versions } = query.data;
  const a = integration.actions || {};

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={integration.exchangeName}
        eyebrow={integration.integrationType}
        action={
          <ReportIssueButton
            source={{
              sourceType: "integration_step",
              sourceId: integration.id,
              sourceTypeLabel: "Integration Steps",
              sourceLabel: integration.exchangeName,
            }}
          />
        }
      />
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <span>{integration.workflowStatus}</span>
        <span>· Review: {integration.reviewStatus}</span>
        <span>· Mintlify: {integration.mintlifyStatus}</span>
        <span>· Frontend: {integration.frontendStatus}</span>
        <span>· Overall: {integration.overallStatus}</span>
      </div>
      <Card>
        <CardHeader><CardTitle>Basic information</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Summary:</strong> {integration.summaryOfChanges || "—"}</p>
          <p><strong>Why:</strong> {integration.whyChangesWereMade || "—"}</p>
          <p><strong>Updated flag:</strong> {integration.contentUpdated ? "Yes" : "No"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Integration steps</CardTitle>
          {!readOnly && a.edit ? (
            <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit"}</Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {editing ? (
            <>
              <IntegrationStepsEditor value={editHtml} onChange={setEditHtml} />
              <Button className="mt-3" onClick={() => patch.mutate()} disabled={patch.isPending}>Save document</Button>
            </>
          ) : (
            <IntegrationStepsEditor value={integration.stepsHtml || ""} onChange={() => undefined} readOnly />
          )}
        </CardContent>
      </Card>
      {!readOnly && (a.submit || a.requestChanges || a.markReviewed || a.approve || a.confirmMintlify || a.assignTech || a.completeFrontend) ? (
        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {a.submit ? <Button onClick={() => window.confirm("Submit for review?") && action.mutate({ path: "/submit" })}>Submit for review</Button> : null}
            {a.requestChanges ? (
              <>
                <Textarea placeholder="Review feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                <Button variant="outline" disabled={!feedback.trim()} onClick={() => action.mutate({ path: "/request-changes", body: { feedback } })}>Request changes</Button>
              </>
            ) : null}
            {a.markReviewed ? (
              <>
                <Textarea placeholder="Review notes (optional)" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                <Button onClick={() => window.confirm("Mark reviewed?") && action.mutate({ path: "/mark-reviewed", body: { reviewNotes } })}>Mark reviewed</Button>
              </>
            ) : null}
            {a.approve ? <Button onClick={() => window.confirm("Approve integration?") && action.mutate({ path: "/approve" })}>Approve</Button> : null}
            {a.confirmMintlify ? (
              <>
                <Input placeholder="Publication notes" value={mintlifyNotes} onChange={(e) => setMintlifyNotes(e.target.value)} />
                <Button onClick={() => window.confirm("Confirm Mintlify publication?") && action.mutate({ path: "/confirm-mintlify", body: { notes: mintlifyNotes } })}>Confirm Mintlify published</Button>
              </>
            ) : null}
            {a.assignTech ? (
              <div className="flex flex-wrap gap-2">
                <Select value={techAgentId} onValueChange={setTechAgentId}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Tech Agent" /></SelectTrigger>
                  <SelectContent>
                    {techAgents.data?.users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button disabled={!techAgentId} onClick={() => action.mutate({ path: "/assign-tech", body: { techAgentId } })}>Assign Tech Agent</Button>
              </div>
            ) : null}
            {a.requestClarification ? (
              <>
                <Textarea placeholder="Clarification comment" value={clarification} onChange={(e) => setClarification(e.target.value)} />
                <Button variant="outline" disabled={!clarification.trim()} onClick={() => action.mutate({ path: "/request-clarification", body: { comment: clarification } })}>Request clarification</Button>
              </>
            ) : null}
            {a.respondClarification ? (
              <>
                <Textarea placeholder="Response" value={clarificationResponse} onChange={(e) => setClarificationResponse(e.target.value)} />
                <Button disabled={!clarificationResponse.trim()} onClick={() => action.mutate({ path: "/respond-clarification", body: { response: clarificationResponse } })}>Respond to clarification</Button>
              </>
            ) : null}
            {a.completeFrontend ? (
              <>
                <Textarea placeholder="Technical notes (optional)" value={techNotes} onChange={(e) => setTechNotes(e.target.value)} />
                <Button onClick={() => window.confirm("Mark frontend completed?") && action.mutate({ path: "/complete-frontend", body: { technicalNotes: techNotes } })}>Mark frontend completed</Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {activity.map((item, i) => (
            <p key={i}><span className="text-slate-500">{formatWhen(item.createdAt)}</span> · {item.actorName} · {item.summary}</p>
          ))}
        </CardContent>
      </Card>
      {versions.length ? (
        <Card>
          <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {versions.map((v) => <p key={v.version}>v{v.version} · {v.savedByName} · {v.summaryNote}</p>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function IntegrationStepsRoutes() {
  return (
    <Routes>
      <Route element={<IntegrationLayout />}>
        <Route path="dashboard" element={<IntegrationStepsDashboardPage />} />
        <Route path="tracker" element={<IntegrationTrackerPage />} />
        <Route path="library" element={<IntegrationLibraryPage />} />
        <Route path="reviews" element={<IntegrationReviewsPage />} />
        <Route path="tasks" element={<IntegrationTasksPage />} />
        <Route index element={<IntegrationStepsDashboardPage />} />
      </Route>
      <Route path="new" element={<IntegrationFormPage />} />
      <Route path=":id" element={<IntegrationDetailPage />} />
    </Routes>
  );
}
