import { Link, useNavigate, useParams } from "react-router-dom";
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
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { SimpleMarkdown } from "@/lib/simple-markdown";

export type ProductGuide = {
  id: string;
  title: string;
  productArea: string;
  summary: string;
  content?: string;
  status: string;
  ownerName: string;
  mintlifyUrl?: string;
  nextReviewDate?: string;
  reviewDue?: boolean;
  slaState?: string;
  slaTimer?: string | null;
  reviewFeedback?: string;
  updatedAt?: string;
  actions?: { edit: boolean; submit: boolean; review: boolean; publish: boolean };
};

function StatusPill({ value, sla }: { value: string; sla?: string }) {
  const tone =
    value === "Published"
      ? "bg-emerald-50 text-emerald-800"
      : value === "Pending Review"
        ? "bg-blue-50 text-blue-800"
        : value === "Changes Required"
          ? "bg-amber-50 text-amber-900"
          : value === "Approved — Ready to Publish"
            ? "bg-violet-50 text-violet-900"
            : "bg-slate-100 text-slate-700";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{value}</span>
      {sla && sla !== "Not Applicable" ? <span className="text-xs text-slate-500">SLA · {sla}</span> : null}
    </span>
  );
}

export function ProductGuidesPage() {
  const { can, canMutate } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [slaState, setSlaState] = useState("all");
  const stats = useQuery({ queryKey: ["pg-stats"], queryFn: () => api<{ stats: Record<string, number> }>("/api/product-guides/stats"), enabled: can("guides.view") });
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  if (slaState !== "all") params.set("slaState", slaState);
  const list = useQuery({
    queryKey: ["product-guides", q, status, slaState],
    queryFn: () => api<{ guides: ProductGuide[] }>(`/api/product-guides?${params.toString()}`),
    enabled: can("guides.view"),
    staleTime: STALE.reference,
    placeholderData: (prev) => prev,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Knowledge"
        title="Product Guides"
        action={canMutate("guides.manage") ? <Link to="/product-guides/new" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground">New guide</Link> : null}
      />
      {stats.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total" value={stats.data.stats.total} />
          <StatCard label="Published" value={stats.data.stats.Published || 0} />
          <StatCard label="Pending review" value={stats.data.stats["Pending Review"] || 0} />
          <StatCard label="Ready to publish" value={stats.data.stats["Approved — Ready to Publish"] || 0} />
          <StatCard label="Changes required" value={stats.data.stats["Changes Required"] || 0} />
          <StatCard label="Review due" value={stats.data.stats.reviewDue || 0} />
        </div>
      ) : null}
      <div className="grid gap-2 md:grid-cols-[1fr_180px_180px]">
        <Input placeholder="Search title, product area, content" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Draft", "Pending Review", "Changes Required", "Approved — Ready to Publish", "Published"].map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={slaState} onValueChange={setSlaState}>
          <SelectTrigger className="w-full"><SelectValue placeholder="SLA" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All SLA states</SelectItem>
            {["On Track", "Due Soon", "Overdue", "Not Applicable"].map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {(list.isPending && !list.data) ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {list.data?.guides.length === 0 ? <Empty title="No product guides yet" body="Create your first guide to start building the knowledge library." /> : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Guide</th>
              <th className="px-3 py-3 font-medium">Product / area</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Owner</th>
              <th className="px-3 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.guides.map((guide) => (
              <tr key={guide.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/product-guides/${guide.id}`} className="font-medium text-slate-900 hover:text-blue-700">
                    {guide.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-500">{guide.summary}</p>
                </td>
                <td className="px-3 py-3">{guide.productArea}</td>
                <td className="px-3 py-3"><StatusPill value={guide.status} sla={guide.slaTimer || guide.slaState} /></td>
                <td className="px-3 py-3">{guide.ownerName}</td>
                <td className="px-3 py-3">{formatWhen(guide.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle></CardHeader>
      <CardContent className="text-2xl font-semibold text-slate-900">{value}</CardContent>
    </Card>
  );
}

export function ProductGuideDetailPage() {
  const { id } = useParams();
  const { canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState("");
  const [mintlifyUrl, setMintlifyUrl] = useState("");
  const query = useQuery({
    queryKey: ["product-guide", id],
    queryFn: () =>
      api<{
        guide: ProductGuide;
        activity: { id: string; summary: string; actorName: string; createdAt: string }[];
        revisions: { id: string; note: string; savedByName: string; createdAt: string }[];
        featureImpacts: { id: string; name: string; progress: { published: number; total: number } }[];
      }>(`/api/product-guides/${id}`),
    enabled: Boolean(id),
  });

  const submit = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: object }) =>
      api(`/api/product-guides/${id}${path}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      toast.success("Guide updated");
      void client.invalidateQueries({ queryKey: ["product-guide", id] });
      void client.invalidateQueries({ queryKey: ["product-guides"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(error.message),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) return <ErrorBlock message={query.error?.message || "Guide not found"} />;
  const { guide, activity, revisions, featureImpacts } = query.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow={guide.productArea}
        title={guide.title}
        action={
          canMutate("guides.manage") && guide.actions?.edit ? (
            <Link to={`/product-guides/${guide.id}/edit`} className="text-sm text-blue-700">Edit</Link>
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
        <StatusPill value={guide.status} sla={guide.slaTimer || guide.slaState} />
        <span>Owner · {guide.ownerName}</span>
        <span>Updated · {formatWhen(guide.updatedAt)}</span>
        {guide.nextReviewDate ? <span>Next review · {guide.nextReviewDate}{guide.reviewDue ? " · Review due" : ""}</span> : null}
        <ReportIssueButton
          source={{
            sourceType: "product_guide",
            sourceId: guide.id,
            sourceTypeLabel: "Product Guide",
            sourceLabel: guide.title,
          }}
        />
      </div>
      {guide.reviewFeedback ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">Review feedback: {guide.reviewFeedback}</div> : null}
      {!readOnly && guide.actions?.submit ? <Button onClick={() => submit.mutate({ path: "/submit" })}>Submit for review</Button> : null}
      {!readOnly && guide.actions?.review ? (
        <Card>
          <CardHeader><CardTitle>Review</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="Feedback when requesting changes" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => submit.mutate({ path: "/request-changes", body: { feedback } })} disabled={!feedback.trim()}>Request changes</Button>
              <Button onClick={() => submit.mutate({ path: "/approve" })}>Approve</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {!readOnly && guide.actions?.publish ? (
        <Card>
          <CardHeader><CardTitle>Publish on Mintlify</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-600">Publish manually on Mintlify, then confirm here.</p>
            <Input placeholder="Mintlify URL (optional)" value={mintlifyUrl} onChange={(e) => setMintlifyUrl(e.target.value)} />
            <Button onClick={() => submit.mutate({ path: "/publish", body: { mintlifyUrl } })}>Mark published</Button>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Guide content</CardTitle></CardHeader>
        <CardContent><SimpleMarkdown content={guide.content || guide.summary} /></CardContent>
      </Card>
      {featureImpacts.length ? (
        <Card>
          <CardHeader><CardTitle>Related product changes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {featureImpacts.map((impact) => (
              <Link key={impact.id} to={`/feature-impacts/${impact.id}`} className="block rounded-lg border px-3 py-2 hover:bg-slate-50">
                <p className="font-medium">{impact.name}</p>
                <p className="text-xs text-slate-500">{impact.progress.published}/{impact.progress.total} guides published</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {activity.map((item) => (
            <p key={item.id}><span className="text-slate-500">{formatWhen(item.createdAt)}</span> · {item.actorName} · {item.summary}</p>
          ))}
        </CardContent>
      </Card>
      {revisions.length ? (
        <Card>
          <CardHeader><CardTitle>Revision history</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {revisions.map((rev) => (
              <p key={rev.id}>{formatWhen(rev.createdAt)} · {rev.savedByName} · {rev.note}</p>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Button variant="ghost" onClick={() => navigate("/product-guides")}>Back to library</Button>
    </div>
  );
}

export function ProductGuideFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const existing = useQuery({ queryKey: ["product-guide", id], queryFn: () => api<{ guide: ProductGuide }>(`/api/product-guides/${id}`), enabled: Boolean(id) });
  const [title, setTitle] = useState("");
  const [productArea, setProductArea] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [nextReviewDate, setNextReviewDate] = useState("");

  useEffect(() => {
    if (existing.data?.guide) {
      setTitle(existing.data.guide.title);
      setProductArea(existing.data.guide.productArea);
      setSummary(existing.data.guide.summary);
      setContent(existing.data.guide.content || "");
      setNextReviewDate(existing.data.guide.nextReviewDate || "");
    }
  }, [existing.data]);

  const save = useMutation({
    mutationFn: (): Promise<{ id?: string }> =>
      id
        ? api(`/api/product-guides/${id}`, { method: "PATCH", body: JSON.stringify({ title, productArea, summary, content, nextReviewDate }) })
        : api("/api/product-guides", { method: "POST", body: JSON.stringify({ title, productArea, summary, content, nextReviewDate }) }),
    onSuccess: (data: { id?: string }) => {
      toast.success("Guide saved");
      void client.invalidateQueries({ queryKey: ["product-guides"] });
      navigate(`/product-guides/${id || data.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (existing.isLoading) return <LoadingBlock />;
  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <PageHeader title={id ? "Edit product guide" : "New product guide"} />
      <Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required />
      <Label>Product / area</Label><Input value={productArea} onChange={(e) => setProductArea(e.target.value)} required />
      <Label>Summary</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} />
      <Label>Content (Markdown)</Label><Textarea className="min-h-64 font-mono text-sm" value={content} onChange={(e) => setContent(e.target.value)} />
      <Label>Next review date</Label><Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} />
      <Button type="submit" disabled={save.isPending}>Save</Button>
    </form>
  );
}
