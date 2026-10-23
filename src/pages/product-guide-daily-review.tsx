import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/filter-stat";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { GuideContentViewer } from "@/components/guide-content-viewer";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { ChevronRight } from "lucide-react";
import {
  PRODUCT_GUIDE_CATEGORY_OPTIONS,
  formatGuideCategoryDetail,
  groupProductGuidesByCategory,
  resolveProductGuideCategoryGroup,
} from "@/lib/product-guide-categories";

type DailyDashboard = {
  todayIst: string;
  todayReview: "pending" | "completed";
  todayReviewGuideTitle?: string | null;
  noPublishedGuides: boolean;
  stats: { guidesRemaining: number; guidesReviewedInRotation: number; rotationProgress: string };
  rotation: { rotationId: string; progressLabel: string };
  guides: {
    id: string;
    title: string;
    productArea: string;
    lastReviewedByAgentAt: string | null;
    availability: "eligible" | "completed_rotation" | "unavailable";
  }[];
};

type ReviewGuidePayload = {
  guide: {
    id: string;
    title: string;
    productArea: string;
    summary: string;
    content: string;
    publishedContentVersionAt: string;
  };
  rotationId: string;
  todayIst: string;
};

function YesNoNa({
  value,
  onChange,
  allowNa,
}: {
  value: string;
  onChange: (v: string) => void;
  allowNa?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {(["yes", "no", ...(allowNa ? ["na"] : [])] as const).map((opt) => (
        <Button
          key={opt}
          type="button"
          size="sm"
          variant={value === opt ? "default" : "outline"}
          onClick={() => onChange(opt)}
        >
          {opt === "na" ? "Not Applicable" : opt === "yes" ? "Yes" : "No"}
        </Button>
      ))}
    </div>
  );
}

export function ProductGuideDailyReviewPage() {
  const { effective } = useAuth();
  const [q, setQ] = useState("");
  const [categoryGroup, setCategoryGroup] = useState("all");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const dash = useQuery({
    queryKey: ["pg-daily-review"],
    queryFn: () => api<DailyDashboard>("/api/product-guides/daily-review"),
    enabled: effective?.roleKey === "agent",
    staleTime: STALE.operational,
    refetchOnMount: "always",
  });

  const sourceGuides = dash.data?.guides ?? [];

  const filteredGuides = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sourceGuides.filter((guide) => {
      if (categoryGroup !== "all" && resolveProductGuideCategoryGroup(guide.productArea) !== categoryGroup) {
        return false;
      }
      if (!needle) return true;
      const detail = formatGuideCategoryDetail(guide.productArea);
      return (
        guide.title.toLowerCase().includes(needle) ||
        guide.productArea.toLowerCase().includes(needle) ||
        detail.toLowerCase().includes(needle)
      );
    });
  }, [sourceGuides, categoryGroup, q]);

  const guideSections = useMemo(
    () => groupProductGuidesByCategory(filteredGuides, categoryGroup),
    [filteredGuides, categoryGroup],
  );

  const categoryFilterOptions = useMemo(() => {
    const extras = new Set<string>();
    for (const guide of sourceGuides) {
      const group = resolveProductGuideCategoryGroup(guide.productArea);
      if (!(PRODUCT_GUIDE_CATEGORY_OPTIONS as readonly string[]).includes(group)) extras.add(group);
    }
    return [...PRODUCT_GUIDE_CATEGORY_OPTIONS, ...[...extras].sort((a, b) => a.localeCompare(b))];
  }, [sourceGuides]);

  if (effective?.roleKey !== "agent") {
    return <ErrorBlock message="Daily Review is available to Agents only." />;
  }
  if (dash.isLoading) return <LoadingBlock />;
  if (dash.isError || !dash.data) return <ErrorBlock message={dash.error?.message || "Unable to load daily review"} />;

  const data = dash.data;
  const todayDone = data.todayReview === "completed";
  const allSectionsCollapsed =
    guideSections.length > 0 && guideSections.every((section) => collapsedSections[section.label]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Knowledge" title="Daily Review" />
      <p className="text-sm text-muted-foreground md:whitespace-nowrap">
        Review one published product guide per day. Help keep our documentation accurate and clear for the team.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Today's review</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{todayDone ? "Completed" : "Pending"}</CardContent>
        </Card>
        <StatCard label="Guides remaining" value={data.stats.guidesRemaining} />
        <StatCard label="Reviewed this rotation" value={data.stats.guidesReviewedInRotation} />
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Rotation progress</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{data.rotation.progressLabel}</CardContent>
        </Card>
      </div>
      {todayDone ? (
        <Card className="border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="p-4 text-sm">
            You completed today's review{data.todayReviewGuideTitle ? ` for “${data.todayReviewGuideTitle}”` : ""}.
            Your next daily review will be available tomorrow (IST).
          </CardContent>
        </Card>
      ) : null}
      {data.noPublishedGuides ? (
        <Empty title="No published guides" body="There are no published guides to review yet." />
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              className="min-w-0 sm:min-w-[12rem] sm:flex-1"
              placeholder="Search title, category"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select value={categoryGroup} onValueChange={setCategoryGroup}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryFilterOptions.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 whitespace-nowrap"
              disabled={guideSections.length === 0}
              onClick={() => {
                if (allSectionsCollapsed) {
                  setCollapsedSections({});
                  return;
                }
                setCollapsedSections(Object.fromEntries(guideSections.map((section) => [section.label, true])));
              }}
            >
              {allSectionsCollapsed ? "Expand all" : "Collapse all"}
            </Button>
          </div>
          {filteredGuides.length === 0 ? (
            <Empty title="No guides match" body="Try a different search or category filter." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Guide</th>
                    <th className="px-3 py-3 font-medium">Category</th>
                    <th className="px-3 py-3 font-medium">Your last review</th>
                    <th className="px-3 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {guideSections.map((section) => {
                    const collapsed = Boolean(collapsedSections[section.label]);
                    return (
                    <Fragment key={section.label}>
                      <tr
                        className="border-y border-primary/35 bg-primary/10 cursor-pointer select-none hover:bg-primary/15"
                        onClick={() =>
                          setCollapsedSections((prev) => ({ ...prev, [section.label]: !prev[section.label] }))
                        }
                      >
                        <td
                          colSpan={4}
                          className="border-l-4 border-primary px-4 py-2.5 text-sm font-semibold tracking-wide text-primary"
                        >
                          <span className="flex items-center gap-2">
                            <ChevronRight
                              className={`h-4 w-4 shrink-0 transition-transform duration-200 ${collapsed ? "" : "rotate-90"}`}
                              aria-hidden
                            />
                            <span>{section.label}</span>
                            <span className="font-normal text-primary/70">({section.guides.length})</span>
                          </span>
                        </td>
                      </tr>
                      {!collapsed
                        ? section.guides.map((guide) => {
                        const disabled = guide.availability !== "eligible" || todayDone;
                        return (
                          <tr
                            key={guide.id}
                            className={`border-t border-border/60 ${disabled ? "opacity-50" : "hover:bg-muted/40"}`}
                          >
                            <td className="px-4 py-3 font-medium">{guide.title}</td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {formatGuideCategoryDetail(guide.productArea)}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground">
                              {guide.lastReviewedByAgentAt ? formatWhen(guide.lastReviewedByAgentAt) : "—"}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {disabled ? (
                                <span className="text-xs text-muted-foreground">
                                  {guide.availability === "completed_rotation" ? "Reviewed this rotation" : "—"}
                                </span>
                              ) : (
                                <Button type="button" size="sm" asChild>
                                  <Link to={`/product-guides/daily-review/${guide.id}`}>Review</Link>
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                        : null}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function ProductGuideDailyReviewFormPage() {
  const { guideId } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { effective } = useAuth();

  const [q1, setQ1] = useState("");
  const [q1d, setQ1d] = useState("");
  const [q2, setQ2] = useState("");
  const [q2d, setQ2d] = useState("");
  const [q3, setQ3] = useState("");
  const [q3d, setQ3d] = useState("");
  const [q4, setQ4] = useState("");
  const [q4d, setQ4d] = useState("");
  const [q5, setQ5] = useState("");

  const payload = useQuery({
    queryKey: ["pg-daily-review-guide", guideId],
    queryFn: () => api<ReviewGuidePayload>(`/api/product-guides/daily-review/${guideId}`),
    enabled: Boolean(guideId) && effective?.roleKey === "agent",
    refetchOnMount: "always",
  });

  const submit = useMutation({
    mutationFn: (): Promise<{ message?: string }> =>
      api<{ message?: string }>(`/api/product-guides/daily-review/${guideId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          publishedContentVersionAt: payload.data!.guide.publishedContentVersionAt,
          answers: {
            informationCorrect: { answer: q1, details: q1 === "no" ? q1d : undefined },
            screenshotsAccurate: { answer: q2, details: q2 === "no" ? q2d : undefined },
            missingInformation: { answer: q3, details: q3 === "yes" ? q3d : undefined },
            linksWorking: { answer: q4, details: q4 === "no" ? q4d : undefined },
            suggestions: q5.trim() || undefined,
          },
        }),
      }),
    onSuccess: (res: { message?: string }) => {
      toast.success(res.message || "Review submitted");
      void client.invalidateQueries({ queryKey: ["pg-daily-review"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/product-guides/daily-review");
    },
    onError: (e) => toast.error(e.message),
  });

  if (effective?.roleKey !== "agent") return <ErrorBlock message="Daily Review is available to Agents only." />;
  if (payload.isLoading) return <LoadingBlock />;
  if (payload.isError || !payload.data) return <ErrorBlock message={payload.error?.message || "Guide not available"} />;

  const guide = payload.data.guide;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader eyebrow={guide.productArea} title={guide.title} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Published guide content</CardTitle></CardHeader>
          <CardContent>
            <GuideContentViewer content={guide.content || guide.summary} title={guide.title} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Your review</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Is the information in this guide correct and up to date?</Label>
              <YesNoNa value={q1} onChange={setQ1} />
              {q1 === "no" ? (
                <Textarea value={q1d} onChange={(e) => setQ1d(e.target.value)} placeholder="What is incorrect or outdated?" />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Are the screenshots and UI instructions accurate?</Label>
              <YesNoNa value={q2} onChange={setQ2} allowNa />
              {q2 === "no" ? (
                <Textarea value={q2d} onChange={(e) => setQ2d(e.target.value)} placeholder="Which screenshots or steps are outdated?" />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Is any important information missing?</Label>
              <YesNoNa value={q3} onChange={setQ3} />
              {q3 === "yes" ? (
                <Textarea value={q3d} onChange={(e) => setQ3d(e.target.value)} placeholder="What should be added?" />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Are the links and references working?</Label>
              <YesNoNa value={q4} onChange={setQ4} allowNa />
              {q4 === "no" ? (
                <Textarea value={q4d} onChange={(e) => setQ4d(e.target.value)} placeholder="Broken or outdated links" />
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Suggestions to improve this guide (optional)</Label>
              <Textarea value={q5} onChange={(e) => setQ5(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => navigate("/product-guides/daily-review")}>Cancel</Button>
              <Button
                type="button"
                disabled={submit.isPending || !q1 || !q2 || !q3 || !q4}
                onClick={() => submit.mutate()}
              >
                Submit review
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
