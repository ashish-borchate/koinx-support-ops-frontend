import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FeatureImpactCard } from "@/components/design/feature-impact-card";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import type { ProductGuide } from "@/pages/product-guides";

type ImpactProgress = { published: number; total: number; percent: number; status: string };

type FeatureImpactRow = {
  id: string;
  name: string;
  reason: string;
  guideIds?: string[];
  mediaNote?: string;
  createdAt?: string;
  updatedAt?: string;
  progress: ImpactProgress;
  guides?: ProductGuide[];
};

function ProgressBar({ progress }: { progress: ImpactProgress }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-foreground">
        {progress.published} / {progress.total} guides published · {progress.percent}%
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-300" style={{ width: `${progress.percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">Status · {progress.status}</p>
    </div>
  );
}

export function FeatureImpactsPage() {
  const { can, canMutate } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status !== "all") params.set("status", status);
  const list = useQuery({
    queryKey: ["feature-impacts", q, status],
    queryFn: () => api<{ impacts: FeatureImpactRow[] }>(`/api/feature-impacts?${params.toString()}`),
    enabled: can("feature_impact.view", "guides.manage"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Product changes"
        title="Feature impact"
        action={
          canMutate("feature_impact.manage") ? (
            <Link to="/feature-impacts/new" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground">
              New feature impact
            </Link>
          ) : null
        }
      />
      <div className="grid gap-2 md:grid-cols-[1fr_200px]">
        <Input placeholder="Search feature or change name" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Needs Action", "Working", "Complete"].map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {list.isLoading ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {list.data?.impacts.length === 0 ? (
        <Empty title="No feature impacts yet" body="Track which product guides need updates when a release ships." />
      ) : null}
      <div className="grid gap-3 xl:grid-cols-2">
        {list.data?.impacts.map((impact) => (
          <FeatureImpactCard
            key={impact.id}
            id={impact.id}
            name={impact.name}
            reason={impact.reason}
            updatedLabel={formatWhen(impact.updatedAt)}
            progress={impact.progress}
          />
        ))}
      </div>
    </div>
  );
}

export function FeatureImpactDetailPage() {
  const { id } = useParams();
  const { canMutate } = useAuth();
  const query = useQuery({
    queryKey: ["feature-impact", id],
    queryFn: () => api<{ impact: FeatureImpactRow }>(`/api/feature-impacts/${id}`),
    enabled: Boolean(id),
  });

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) return <ErrorBlock message={query.error?.message || "Not found"} />;
  const { impact } = query.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Feature impact"
        title={impact.name}
        action={
          canMutate("feature_impact.manage") ? (
            <Link to={`/feature-impacts/${id}/edit`} className="text-sm text-blue-700">Edit</Link>
          ) : null
        }
      />
      <Card>
        <CardHeader><CardTitle>Reason for guide updates</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">{impact.reason}</CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
        <CardContent><ProgressBar progress={impact.progress} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Affected product guides</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {!impact.guides?.length ? <p className="text-sm text-muted-foreground">No guides linked.</p> : null}
          {impact.guides?.map((guide) => (
            <Link key={guide.id} to={`/product-guides/${guide.id}`} className="flex items-start gap-3 rounded-lg border border-border/60 px-3 py-2 hover:bg-[var(--hover-surface)]">
              <span className="mt-0.5 text-lg leading-none">{guide.status === "Published" ? "✓" : guide.status === "Draft" ? "○" : "◐"}</span>
              <div>
                <p className="font-medium text-foreground">{guide.title}</p>
                <p className="text-xs text-muted-foreground">{guide.productArea} · {guide.status}{guide.slaTimer ? ` · ${guide.slaTimer}` : ""}</p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
      {impact.mediaNote ? (
        <Card>
          <CardHeader><CardTitle>Supporting notes</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{impact.mediaNote}</CardContent>
        </Card>
      ) : null}
      <Link to="/feature-impacts" className="text-sm text-blue-700">Back to feature impacts</Link>
    </div>
  );
}

export function FeatureImpactFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const existing = useQuery({
    queryKey: ["feature-impact", id],
    queryFn: () => api<{ impact: FeatureImpactRow }>(`/api/feature-impacts/${id}`),
    enabled: Boolean(id),
  });
  const guides = useQuery({
    queryKey: ["product-guides-all"],
    queryFn: () => api<{ guides: ProductGuide[] }>("/api/product-guides"),
  });
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [mediaNote, setMediaNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (existing.data?.impact) {
      setName(existing.data.impact.name);
      setReason(existing.data.impact.reason);
      setMediaNote(existing.data.impact.mediaNote || "");
      setSelected(existing.data.impact.guideIds || []);
    }
  }, [existing.data]);

  const toggleGuide = (guideId: string) => {
    setSelected((prev) => (prev.includes(guideId) ? prev.filter((x) => x !== guideId) : [...prev, guideId]));
  };

  const save = useMutation({
    mutationFn: (): Promise<{ id?: string }> => {
      const body = JSON.stringify({ name, reason, guideIds: selected, mediaNote });
      return id
        ? api(`/api/feature-impacts/${id}`, { method: "PATCH", body })
        : api("/api/feature-impacts", { method: "POST", body });
    },
    onSuccess: (data: { id?: string }) => {
      toast.success("Feature impact saved");
      void client.invalidateQueries({ queryKey: ["feature-impacts"] });
      navigate(`/feature-impacts/${id || data.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const guideOptions = useMemo(() => guides.data?.guides || [], [guides.data]);

  if (existing.isLoading || guides.isLoading) return <LoadingBlock />;

  return (
    <form
      className="mx-auto max-w-2xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected.length === 0) {
          toast.error("Select at least one product guide");
          return;
        }
        save.mutate();
      }}
    >
      <PageHeader title={id ? "Edit feature impact" : "New feature impact"} />
      <Label>Feature / change name</Label>
      <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} />
      <Label>Reason for guide update</Label>
      <Textarea className="min-h-28" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} />
      <Label>Related product guides</Label>
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
        {guideOptions.length === 0 ? <p className="text-sm text-slate-500">No guides available.</p> : null}
        {guideOptions.map((guide) => (
          <label key={guide.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <input type="checkbox" className="mt-1" checked={selected.includes(guide.id)} onChange={() => toggleGuide(guide.id)} />
            <span>
              <span className="font-medium text-slate-900">{guide.title}</span>
              <span className="block text-xs text-slate-500">{guide.productArea} · {guide.status}</span>
            </span>
          </label>
        ))}
      </div>
      <Label>Supporting notes (optional)</Label>
      <Textarea value={mediaNote} onChange={(e) => setMediaNote(e.target.value)} placeholder="Links to screenshots or files" />
      <Button type="submit" disabled={save.isPending}>Save</Button>
    </form>
  );
}
