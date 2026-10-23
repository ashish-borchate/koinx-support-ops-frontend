import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AffectedGuidesList } from "@/components/affected-guide-card";
import { CompactFilterStat, toggleFeatureImpactFilter } from "@/components/compact-filter-stat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FeatureImpactCard } from "@/components/design/feature-impact-card";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useGuideWorkflowViewer } from "@/components/guide-workflow-panel";
import {
  buildFeatureImpactPersonalAttentionBanner,
  countPersonalActions,
  featureImpactFilterLabel,
  filterFeatureImpactGuides,
  formatGuideStatusSummary,
  sortAffectedGuides,
  tallyFeatureImpactFilterCounts,
  type FeatureImpactGuideFilter,
} from "@/lib/guide-workflow";
import { cn } from "@/lib/utils";
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
  statusCounts?: Record<string, number>;
  guides?: ProductGuide[];
};

function GuideProgressSummary({ progress, statusCounts }: { progress: ImpactProgress; statusCounts?: Record<string, number> }) {
  const complete = progress.percent >= 100 && progress.total > 0;
  const summary = statusCounts ? formatGuideStatusSummary(statusCounts) : `${progress.published} Published`;
  return (
    <section className="rounded-lg border border-border/70 bg-card px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Guide progress</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">
        {progress.published} of {progress.total} guides published
        <span className="ml-2 tabular-nums text-muted-foreground">{progress.percent}%</span>
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-300",
              complete ? "bg-emerald-600" : "bg-primary",
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
          />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{summary}{complete ? " · Complete" : ""}</p>
    </section>
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
            progress={impact.progress}
            statusCounts={impact.statusCounts}
            needsAttention={impact.guides ? countPersonalActions(impact.guides) : 0}
          />
        ))}
      </div>
    </div>
  );
}

export function FeatureImpactDetailPage() {
  const { id } = useParams();
  const { canMutate } = useAuth();
  const viewer = useGuideWorkflowViewer();
  const [guideFilter, setGuideFilter] = useState<FeatureImpactGuideFilter>("all");
  const query = useQuery({
    queryKey: ["feature-impact", id],
    queryFn: () => api<{ impact: FeatureImpactRow }>(`/api/feature-impacts/${id}`),
    enabled: Boolean(id),
  });

  const allGuides = query.data?.impact.guides ?? [];

  const filterCounts = useMemo(() => tallyFeatureImpactFilterCounts(allGuides), [allGuides]);

  const filteredGuides = useMemo(() => {
    const filtered = filterFeatureImpactGuides(allGuides, guideFilter);
    return sortAffectedGuides(filtered, viewer);
  }, [allGuides, guideFilter, viewer]);

  const attention = useMemo(() => {
    if (!allGuides.length) return null;
    return buildFeatureImpactPersonalAttentionBanner(allGuides, viewer);
  }, [allGuides, viewer]);

  const filterHeading = useMemo(() => {
    if (guideFilter === "all") return `${allGuides.length} guide${allGuides.length === 1 ? "" : "s"}`;
    const label = featureImpactFilterLabel(guideFilter);
    const n = filteredGuides.length;
    return `${label} · ${n} guide${n === 1 ? "" : "s"}`;
  }, [guideFilter, allGuides.length, filteredGuides.length]);

  if (query.isLoading) return <LoadingBlock />;
  if (query.isError || !query.data) return <ErrorBlock message={query.error?.message || "Not found"} />;
  const { impact } = query.data;
  const fiContext = { id: impact.id, name: impact.name, reason: impact.reason };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Feature impact</p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{impact.name}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{impact.reason}</p>
        </div>
        {canMutate("feature_impact.manage") ? (
          <Link
            to={`/feature-impacts/${id}/edit`}
            className="inline-flex h-9 shrink-0 items-center rounded-lg border border-border px-3 text-sm font-medium hover:bg-[var(--hover-surface)]"
          >
            Edit
          </Link>
        ) : null}
      </div>

      <GuideProgressSummary progress={impact.progress} statusCounts={impact.statusCounts} />

      {attention ? (
        <button
          type="button"
          className="w-full rounded-lg border border-amber-200/90 bg-amber-50/80 px-3 py-2 text-left transition-colors hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950/35 dark:hover:bg-amber-950/50"
          onClick={() => setGuideFilter((f) => toggleFeatureImpactFilter(f, "your_action") as FeatureImpactGuideFilter)}
        >
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">{attention.title}</p>
          <p className="text-sm text-amber-900/85 dark:text-amber-200/90">{attention.body}</p>
          <p className="mt-1 text-xs font-medium text-amber-800/80 dark:text-amber-300/80">View guides that need your action →</p>
        </button>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <CompactFilterStat
          label="All"
          value={filterCounts.all}
          active={guideFilter === "all"}
          onClick={() => setGuideFilter((f) => toggleFeatureImpactFilter(f, "all") as FeatureImpactGuideFilter)}
        />
        {filterCounts.your_action > 0 ? (
          <CompactFilterStat
            label="Your action"
            value={filterCounts.your_action}
            active={guideFilter === "your_action"}
            accent="amber"
            onClick={() => setGuideFilter((f) => toggleFeatureImpactFilter(f, "your_action") as FeatureImpactGuideFilter)}
          />
        ) : null}
        <CompactFilterStat
          label="Published"
          value={filterCounts.Published}
          active={guideFilter === "Published"}
          accent="emerald"
          disabled={filterCounts.Published === 0}
          onClick={() => setGuideFilter((f) => toggleFeatureImpactFilter(f, "Published") as FeatureImpactGuideFilter)}
        />
        <CompactFilterStat
          label="Ready To Publish"
          value={filterCounts["Ready to Publish"]}
          active={guideFilter === "Ready to Publish"}
          accent="blue"
          disabled={filterCounts["Ready to Publish"] === 0}
          onClick={() =>
            setGuideFilter((f) => toggleFeatureImpactFilter(f, "Ready to Publish") as FeatureImpactGuideFilter)
          }
        />
        <CompactFilterStat
          label="Changes Requested"
          value={filterCounts["Changes Required"]}
          active={guideFilter === "Changes Required"}
          disabled={filterCounts["Changes Required"] === 0}
          onClick={() => setGuideFilter((f) => toggleFeatureImpactFilter(f, "Changes Required") as FeatureImpactGuideFilter)}
        />
        {filterCounts.Draft > 0 ? (
          <CompactFilterStat
            label="Draft"
            value={filterCounts.Draft}
            active={guideFilter === "Draft"}
            disabled={filterCounts.Draft === 0}
            onClick={() => setGuideFilter((f) => toggleFeatureImpactFilter(f, "Draft") as FeatureImpactGuideFilter)}
          />
        ) : null}
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Affected guides</h2>
          <p className="text-xs text-muted-foreground">{filterHeading}</p>
        </div>
        {!allGuides.length ? <p className="text-sm text-muted-foreground">No guides linked.</p> : null}
        <AffectedGuidesList
          guides={filteredGuides}
          viewer={viewer}
          featureImpact={fiContext}
          filterKey={guideFilter}
        />
      </section>

      {impact.mediaNote ? (
        <section className="rounded-xl border border-border/60 px-4 py-3 text-sm text-muted-foreground">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Supporting notes</p>
          <p className="mt-2">{impact.mediaNote}</p>
        </section>
      ) : null}

      <Link to="/feature-impacts" className="inline-block text-sm font-medium text-primary hover:underline">
        ← Back to feature impacts
      </Link>
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
  const [guideSearch, setGuideSearch] = useState("");
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
  const filteredGuides = useMemo(() => {
    const term = guideSearch.trim().toLowerCase();
    if (!term) return guideOptions;
    return guideOptions.filter((guide) => {
      const haystack = [guide.title, guide.productArea, guide.summary, guide.content ?? ""].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [guideOptions, guideSearch]);

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
      <Input
        placeholder="Search guides by title or keywords"
        value={guideSearch}
        onChange={(e) => setGuideSearch(e.target.value)}
        aria-label="Search related product guides"
      />
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border p-3">
        {guideOptions.length === 0 ? <p className="text-sm text-muted-foreground">No guides available.</p> : null}
        {guideOptions.length > 0 && filteredGuides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No guides match your search.</p>
        ) : null}
        {filteredGuides.map((guide) => (
          <label key={guide.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
            <input type="checkbox" className="mt-1" checked={selected.includes(guide.id)} onChange={() => toggleGuide(guide.id)} />
            <span>
              <span className="font-medium text-foreground">{guide.title}</span>
              <span className="block text-xs text-muted-foreground">{guide.productArea} · {guide.status}</span>
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
