import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader, StatusBadge } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

const statuses = ["Draft", "In Review", "Published", "Needs Update", "Archived"];

type Guide = {
  id: string;
  type: "product" | "integration";
  title: string;
  product: string;
  integration: string;
  status: string;
  summary: string;
  body?: string;
  ownerId?: string;
  owner?: string;
  reviewDate: string;
  updatedAt: string;
};

export function KnowledgePage() {
  const { canMutate } = useAuth();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [type, setType] = useState(searchParams.get("type") || "all");
  const [status, setStatus] = useState("all");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type !== "all") params.set("type", type);
  if (status !== "all") params.set("status", status);
  const query = useQuery({
    queryKey: ["guides", q, type, status],
    queryFn: () => api<{ guides: Guide[] }>(`/api/guides?${params.toString()}`),
  });
  return (
    <div>
      <PageHeader
        eyebrow="Knowledge"
        title="Guides and integrations"
        action={canMutate("guides.edit") ? <Link to="/knowledge/new" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground">New guide</Link> : null}
      />
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_160px_180px]">
        <Input placeholder="Search titles, products, integrations" value={q} onChange={(event) => setQ(event.target.value)} />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="integration">Integration</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.data?.guides.length === 0 ? <Empty title="Nothing matches" body="Try another status, or write the guide that the team keeps asking for." /> : null}
      <div className="grid gap-3">
        {query.data?.guides.map((guide) => (
          <Link key={guide.id} to={`/knowledge/${guide.id}`} className="rounded-2xl border bg-card px-4 py-3 hover:border-primary">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{guide.title}</p>
              <StatusBadge value={guide.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{guide.summary}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {guide.type === "integration" ? guide.integration || "Integration" : guide.product || "Product"} · {guide.owner} · updated {formatWhen(guide.updatedAt)}
              {guide.reviewDate ? ` · review ${guide.reviewDate}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function GuidePage() {
  const { id } = useParams();
  const { canMutate } = useAuth();
  const query = useQuery({ queryKey: ["guide", id], queryFn: () => api<{ guide: Guide }>(`/api/guides/${id}`) });
  if (query.isLoading) return <LoadingBlock />;
  if (query.isError) return <ErrorBlock message={query.error.message} />;
  const guide = query.data!.guide;
  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader eyebrow={guide.type} title={guide.title} action={canMutate("guides.edit") ? <Link to={`/knowledge/${guide.id}/edit`} className="text-sm text-primary">Edit</Link> : null} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
        <StatusBadge value={guide.status} />
        <span>{guide.product}</span>
        {guide.integration ? <span>{guide.integration}</span> : null}
        <span>Owner {guide.owner}</span>
        {guide.reviewDate ? <span>Review {guide.reviewDate}</span> : null}
      </div>
      <p className="text-lg">{guide.summary}</p>
      <div className="mt-6 whitespace-pre-wrap text-sm leading-7">{guide.body}</div>
    </article>
  );
}

export function GuideFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { user } = useAuth();
  const existing = useQuery({ queryKey: ["guide", id], queryFn: () => api<{ guide: Guide }>(`/api/guides/${id}`), enabled: Boolean(id) });
  const guide = existing.data?.guide;
  const [type, setType] = useState<Guide["type"]>(guide?.type || "product");
  const [title, setTitle] = useState(guide?.title || "");
  const [product, setProduct] = useState(guide?.product || "");
  const [integration, setIntegration] = useState(guide?.integration || "");
  const [status, setStatus] = useState(guide?.status || "Draft");
  const [summary, setSummary] = useState(guide?.summary || "");
  const [body, setBody] = useState(guide?.body || "");
  const [reviewDate, setReviewDate] = useState(guide?.reviewDate || "");
  useEffect(() => {
    if (!guide) return;
    setType(guide.type);
    setTitle(guide.title);
    setProduct(guide.product);
    setIntegration(guide.integration);
    setStatus(guide.status);
    setSummary(guide.summary);
    setBody(guide.body || "");
    setReviewDate(guide.reviewDate);
  }, [guide]);
  const save = useMutation({
    mutationFn: () =>
      api<{ id: string }>(id ? `/api/guides/${id}` : "/api/guides", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ type, title, product, integration, status, summary, body, reviewDate, ownerId: guide?.ownerId || user?.id }),
      }),
    onSuccess: (data) => {
      toast.success("Guide saved");
      void client.invalidateQueries({ queryKey: ["guides"] });
      navigate(`/knowledge/${id || data.id}`);
    },
    onError: (error) => toast.error(error.message),
  });
  if (id && existing.isLoading) return <LoadingBlock />;
  if (existing.isError) return <ErrorBlock message={existing.error.message} />;
  return (
    <form className="mx-auto max-w-2xl space-y-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <PageHeader title={id ? "Edit guide" : "New guide"} />
      <Label>Type</Label>
      <Select value={type} onValueChange={(value) => setType(value as Guide["type"])}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="product">Product</SelectItem>
          <SelectItem value="integration">Integration</SelectItem>
        </SelectContent>
      </Select>
      <Label>Title</Label>
      <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Product</Label><Input value={product} onChange={(event) => setProduct(event.target.value)} /></div>
        <div><Label>Integration</Label><Input value={integration} onChange={(event) => setIntegration(event.target.value)} /></div>
      </div>
      <Label>Status</Label>
      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{statuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
      </Select>
      <Label>Review date</Label>
      <Input type="date" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} />
      <Label>Summary</Label>
      <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
      <Label>Body</Label>
      <Textarea className="min-h-48" value={body} onChange={(event) => setBody(event.target.value)} />
      <Button type="submit" disabled={save.isPending}>Save</Button>
    </form>
  );
}
