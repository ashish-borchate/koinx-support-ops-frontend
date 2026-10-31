import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/bits";
import { HANDBOOK_META } from "@/handbook/manifest";
import {
  DISCOVER_CHAPTERS,
  ROLE_HANDBOOKS,
  discoverBySlug,
  roleHandbookByKey,
  roleHandbookBySlug,
  workflowBySlug,
} from "@/handbook/lib/learning-catalog";
import { loadRoleDoc, loadWorkflowDoc } from "@/handbook/lib/load-learning-content";
import { HandbookLearningArticle } from "@/handbook/components/HandbookLearningArticle";
import { HandbookLayout } from "@/handbook/components/HandbookLayout";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchHandbook } from "@/handbook/lib/search-index";
import { HandbookBreadcrumbs } from "@/handbook/components/HandbookBreadcrumbs";
import { DISCOVER_SLUG_REDIRECTS } from "@/handbook/lib/legacy-redirects";
import { DiscoverArticleContent, discoverArticleSubtitle } from "@/handbook/components/discover/DiscoverArticleContent";
import { DiscoverPrevNext } from "@/handbook/components/discover/DiscoverPrevNext";
import { AdminRoleHandbook } from "@/handbook/components/AdminRoleHandbook";
import { SupervisorRoleHandbook } from "@/handbook/components/SupervisorRoleHandbook";
import { SeniorAgentRoleHandbook } from "@/handbook/components/SeniorAgentRoleHandbook";
import { AgentRoleHandbook } from "@/handbook/components/AgentRoleHandbook";
import { TechAgentRoleHandbook } from "@/handbook/components/TechAgentRoleHandbook";
import { HandbookWorkflowsIndex } from "@/handbook/components/HandbookWorkflowsIndex";
import { WorkflowLearningPage } from "@/handbook/components/learning/WorkflowLearningPage";
import { ADMIN_WORKFLOW_GROUPS } from "@/handbook/lib/workflow-groups";
import { useHandbookAudience } from "@/handbook/hooks/useHandbookAudience";
import { canViewPlaybookRole } from "@/handbook/lib/visibility";
import { markDiscoverVisited, markRoleVisited, markWorkflowVisited } from "@/handbook/lib/progress";
import { SHARED_SLUG_REDIRECTS, PLAYBOOK_ROLE_REDIRECTS } from "@/handbook/lib/legacy-redirects";
import { parseWorkflowGuideView, workflowGuidesHref } from "@/handbook/lib/role-workflows";

function HandbookSearchForm({ className }: { className?: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    navigate(q ? `/handbook/search?q=${encodeURIComponent(q)}` : "/handbook/search");
  }

  return (
    <form onSubmit={onSubmit} className={cn("flex gap-2", className)} role="search">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search workflows, responsibilities, troubleshooting…"
        className="h-10"
        aria-label="Search Hub Handbook"
      />
      <Button type="submit">Search</Button>
    </form>
  );
}

const HOME_CARDS = [
  {
    title: "Discover the Hub",
    description:
      "Learn how Support Hub works, how to access your workspace, and where to find important information.",
    to: "/handbook/discover",
  },
  {
    title: "My Role",
    description:
      "Understand your responsibilities, daily priorities, important actions, and the tools available to your role.",
    to: "role" as const,
  },
  {
    title: "Workflow Guides",
    description:
      "Follow detailed instructions for Support Hub processes, including responsibilities, review stages, and required actions.",
    to: workflowGuidesHref("my"),
  },
] as const;

function HandbookHomePage() {
  const { audienceRole } = useHandbookAudience();
  const roleSlug = audienceRole ? roleHandbookByKey(audienceRole)?.slug : null;
  const rolePath = roleSlug ? `/handbook/role/${roleSlug}` : "/handbook/role";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader title={HANDBOOK_META.title} description={HANDBOOK_META.subtitle} />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HOME_CARDS.map((card) => {
          const to = card.to === "role" ? rolePath : card.to;
          return (
            <li key={card.title}>
              <div className="flex h-full flex-col rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 text-base font-semibold text-foreground">{card.title}</h2>
                  <Button variant="outline" size="sm" className="shrink-0" asChild>
                    <Link to={to}>
                      Explore
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HandbookSearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const { audienceRole, viewerRole } = useHandbookAudience();
  const results = useMemo(() => searchHandbook(q, audienceRole, viewerRole), [q, audienceRole, viewerRole]);

  return (
    <div>
      <PageHeader
        title="Search"
        description="Find workflows, role handbooks and Discover topics. Try searching for DSAT, appeals, KPI entry or Reported Issues."
      />
      <HandbookSearchForm className="mt-4 max-w-xl" />
      {!q.trim() ? null : results.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No results for &ldquo;{q}&rdquo; in your visible content.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                to={r.href}
                className="block rounded-xl border border-border/70 bg-card px-4 py-3 hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {r.kind}{r.roles ? ` · ${r.roles}` : ""}
                </p>
                <p className="font-semibold text-foreground">{r.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.excerpt}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DiscoverIndexPage() {
  return (
    <div className="mx-auto w-full max-w-6xl pb-6">
      <PageHeader title="Discover the Hub" description="Start with orientation before you open trackers." />
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {DISCOVER_CHAPTERS.map((ch) => (
          <li key={ch.slug}>
            <Link
              to={`/handbook/discover/${ch.slug}`}
              className="block h-full rounded-xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-card)] hover:border-primary/25 hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="font-semibold">{ch.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{ch.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiscoverChapterPage() {
  const { slug = "" } = useParams();
  const discoverRedirect = DISCOVER_SLUG_REDIRECTS[slug];
  if (discoverRedirect) return <Navigate to={discoverRedirect} replace />;
  const ref = discoverBySlug(slug);
  if (!ref) return <Navigate to="/handbook/discover" replace />;
  const onVisited = useCallback(() => markDiscoverVisited(slug), [slug]);

  useEffect(() => {
    onVisited();
  }, [onVisited]);

  return (
    <div className="mx-auto w-full max-w-6xl pb-6">
      <HandbookBreadcrumbs
        items={[
          { label: "Hub Handbook", to: "/handbook" },
          { label: "Discover the Hub", to: "/handbook/discover" },
          { label: ref.title },
        ]}
      />
      <PageHeader title={ref.title} description={discoverArticleSubtitle(slug)} className="mb-6" />
      <DiscoverArticleContent slug={slug} />
      <DiscoverPrevNext slug={slug} />
    </div>
  );
}

function RoleIndexPage() {
  const { viewerRole } = useHandbookAudience();
  const visible = ROLE_HANDBOOKS.filter((r) => viewerRole && canViewPlaybookRole(viewerRole, r.roleKey));

  return (
    <div>
      <PageHeader title="My Role" description="What you own in the Hub and how to run your shift." />
      <ul className="mt-6 space-y-3">
        {visible.map((rh) => (
          <li key={rh.slug}>
            <Link
              to={`/handbook/role/${rh.slug}`}
              className="block rounded-xl border border-border/70 bg-card px-5 py-4 hover:border-primary/25"
            >
              <p className="font-semibold">{rh.title}</p>
              <p className="text-sm text-muted-foreground">{rh.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoleHandbookPage() {
  const { roleSlug = "" } = useParams();
  const rh = roleHandbookBySlug(roleSlug);
  const { viewerRole, audienceRole } = useHandbookAudience();
  if (!rh || !viewerRole) return <Navigate to="/handbook/role" replace />;
  if (!canViewPlaybookRole(viewerRole, rh.roleKey)) return <Navigate to="/handbook/role" replace />;

  if (rh.roleKey === "admin") {
    return <AdminRoleHandbook />;
  }

  if (rh.roleKey === "supervisor") {
    return <SupervisorRoleHandbook />;
  }

  if (rh.roleKey === "senior_agent") {
    return <SeniorAgentRoleHandbook />;
  }

  if (rh.roleKey === "agent") {
    return <AgentRoleHandbook />;
  }

  if (rh.roleKey === "tech_agent") {
    return <TechAgentRoleHandbook />;
  }

  const doc = loadRoleDoc(rh.roleKey);
  if (!doc) return <Navigate to="/handbook/role" replace />;
  const onVisited = useCallback(() => {
    if (audienceRole === rh.roleKey) markRoleVisited();
  }, [audienceRole, rh.roleKey]);

  return (
    <HandbookLearningArticle
      doc={{ ...doc, title: `${rh.title} — responsibilities`, description: rh.description }}
      breadcrumbs={[
        { label: "Hub Handbook", to: "/handbook" },
        { label: "My role", to: "/handbook/role" },
        { label: rh.title },
      ]}
      onVisited={onVisited}
    />
  );
}

function WorkflowsIndexPage() {
  return <HandbookWorkflowsIndex />;
}

function WorkflowPage() {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const guideView = parseWorkflowGuideView(searchParams.get("view"));
  const def = workflowBySlug(slug);
  const { audienceRole, myWorkflows, allWorkflows } = useHandbookAudience();
  if (!def || !audienceRole) {
    return <Navigate to={guideView === "all" ? "/handbook/workflows?view=all" : "/handbook/workflows?view=my"} replace />;
  }
  const doc = loadWorkflowDoc(slug);
  if (!doc) {
    return <Navigate to={guideView === "all" ? "/handbook/workflows?view=all" : "/handbook/workflows?view=my"} replace />;
  }
  const onVisited = useCallback(() => markWorkflowVisited(slug), [slug]);
  const pool = guideView === "all" ? allWorkflows : myWorkflows;
  const relatedGroup = ADMIN_WORKFLOW_GROUPS.find((g) => g.slugs.includes(slug));
  const relatedDefs = (
    relatedGroup
      ? relatedGroup.slugs.filter((s) => s !== slug).map((s) => allWorkflows.find((w) => w.slug === s))
      : pool.filter((w) => w.slug !== slug)
  )
    .filter((w): w is NonNullable<typeof w> => Boolean(w))
    .slice(0, 4);

  return (
    <WorkflowLearningPage
      def={def}
      body={doc.body}
      relatedWorkflows={relatedDefs}
      onVisited={onVisited}
      guideView={guideView}
    />
  );
}

function LegacySharedRedirect() {
  const { slug = "" } = useParams();
  const to = SHARED_SLUG_REDIRECTS[slug] ?? "/handbook/discover";
  return <Navigate to={to} replace />;
}

function LegacyPlaybookRedirect() {
  const { roleKey = "" } = useParams();
  const to = PLAYBOOK_ROLE_REDIRECTS[roleKey] ?? "/handbook/role";
  return <Navigate to={to} replace />;
}

function HandbookDownloadsPage() {
  return (
    <div>
      <PageHeader title="Downloads" description="PDF export (future)" />
      <p className="mt-4 text-sm text-muted-foreground">
        PDFs will respect the same role-based handbook visibility as the in-app experience. Not implemented in M3.
      </p>
    </div>
  );
}

export function HandbookRoutes() {
  return (
    <Routes>
      <Route element={<HandbookLayout />}>
        <Route index element={<HandbookHomePage />} />
        <Route path="discover" element={<DiscoverIndexPage />} />
        <Route path="discover/:slug" element={<DiscoverChapterPage />} />
        <Route path="role" element={<RoleIndexPage />} />
        <Route path="role/:roleSlug" element={<RoleHandbookPage />} />
        <Route path="workflows" element={<WorkflowsIndexPage />} />
        <Route path="workflows/:slug" element={<WorkflowPage />} />
        <Route path="reference" element={<Navigate to="/handbook/search" replace />} />
        <Route path="reference/:slug" element={<Navigate to="/handbook/search" replace />} />
        <Route path="search" element={<HandbookSearchPage />} />
        <Route path="downloads" element={<HandbookDownloadsPage />} />
        {/* Legacy M2 URLs */}
        <Route path="shared" element={<Navigate to="/handbook/discover" replace />} />
        <Route path="shared/:slug" element={<LegacySharedRedirect />} />
        <Route path="playbooks" element={<Navigate to="/handbook/role" replace />} />
        <Route path="playbooks/mine" element={<Navigate to="/handbook/role" replace />} />
        <Route path="playbooks/:roleKey" element={<LegacyPlaybookRedirect />} />
        <Route path="playbooks/:roleKey/:chapterSlug" element={<LegacyPlaybookRedirect />} />
        <Route path="guides" element={<Navigate to="/handbook/workflows" replace />} />
        <Route path="guides/:slug" element={<Navigate to="/handbook/workflows" replace />} />
      </Route>
    </Routes>
  );
}
