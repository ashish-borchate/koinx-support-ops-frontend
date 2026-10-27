import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SectionHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import type { WorkflowDef } from "@/handbook/lib/learning-catalog";
import { parseWorkflowMarkdown } from "@/handbook/lib/parse-workflow-md";
import { WorkflowLifecycle } from "./WorkflowLifecycle";
import { WorkflowHandoffMap } from "./WorkflowHandoffMap";
import { WorkflowRelatedNav } from "./WorkflowRelatedNav";
import { HandbookQaReviewDeadlines } from "@/handbook/components/HandbookAdminLiveSettings";
import { useHandbookAudience } from "@/handbook/hooks/useHandbookAudience";
import { isMyWorkflowForRole } from "@/handbook/lib/role-workflows";
import { HandbookProse } from "@/handbook/components/HandbookProse";
import type { WorkflowGuideView } from "@/handbook/lib/role-workflows";

export function WorkflowLearningPage({
  def,
  body,
  relatedWorkflows,
  onVisited,
  guideView = "my",
}: {
  def: WorkflowDef;
  body: string;
  relatedWorkflows: WorkflowDef[];
  onVisited: () => void;
  guideView?: WorkflowGuideView;
}) {
  const parsed = parseWorkflowMarkdown(body);
  const { audienceRole } = useHandbookAudience();

  useEffect(() => {
    onVisited();
  }, [onVisited]);

  const showQaSettings = def.slug === "qa-evaluations-and-appeals" && audienceRole === "admin";
  const inMyWorkflows = isMyWorkflowForRole(def.slug, audienceRole);
  const description = parsed.purpose || def.description;

  return (
    <article className="mx-auto w-full max-w-6xl pb-6">
      <header className="border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{def.title}</h1>
            {audienceRole && inMyWorkflows ? (
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                In your workflows
              </span>
            ) : null}
          </div>
          {def.hubRoute ? (
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link to={def.hubRoute}>Open in Support Hub</Link>
            </Button>
          ) : null}
        </div>
        {description ? (
          <p className="mt-2 max-w-none text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </header>

      <section className="border-b border-border/50 py-6">
        <SectionHeader title="Lifecycle overview" className="mb-3" />
        <WorkflowLifecycle steps={def.lifecycle} variant="compact" />
      </section>

      <div className="divide-y divide-border/50">
        {parsed.when ? (
          <section className="py-6">
            <SectionHeader title="When this applies" className="mb-2" />
            <p className="max-w-none text-sm leading-relaxed text-muted-foreground">{parsed.when}</p>
          </section>
        ) : null}

        {parsed.whoMarkdown ? (
          <section className="py-6">
            <SectionHeader title="Who does what" className="mb-2" />
            <WorkflowHandoffMap markdown={parsed.whoMarkdown} />
          </section>
        ) : null}

        <section className="py-6">
          <SectionHeader title="Each stage in detail" className="mb-3" />
          <WorkflowLifecycle steps={def.lifecycle} variant="vertical" />
        </section>

        {parsed.guidance ? (
          <section className="py-6">
            <SectionHeader title="Practical guidance" className="mb-2" />
            <div className="text-sm leading-relaxed text-muted-foreground">
              <HandbookProse markdown={parsed.guidance} />
            </div>
          </section>
        ) : null}

        {parsed.followUp ? (
          <section className="py-6">
            <SectionHeader title="Manual follow-up" className="mb-2" />
            <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
              <HandbookProse markdown={parsed.followUp} />
            </div>
          </section>
        ) : null}

        {showQaSettings ? (
          <section className="py-6">
            <HandbookQaReviewDeadlines />
          </section>
        ) : null}
      </div>

      <WorkflowRelatedNav workflows={relatedWorkflows} currentSlug={def.slug} guideView={guideView} />
    </article>
  );
}
