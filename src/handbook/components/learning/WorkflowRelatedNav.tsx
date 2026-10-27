import type { WorkflowDef } from "@/handbook/lib/learning-catalog";
import { workflowGuideDetailHref, type WorkflowGuideView } from "@/handbook/lib/role-workflows";
import { LearningCard } from "./LearningCard";

export function WorkflowRelatedNav({
  workflows,
  currentSlug,
  title = "Related workflows",
  guideView = "my",
}: {
  workflows: WorkflowDef[];
  currentSlug: string;
  title?: string;
  guideView?: WorkflowGuideView;
}) {
  const related = workflows.filter((w) => w.slug !== currentSlug).slice(0, 4);
  if (!related.length) return null;

  return (
    <section className="mt-8 border-t border-border/60 pt-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {related.map((w) => (
          <li key={w.slug} className="min-w-0">
            <LearningCard
              title={w.title}
              description={w.description}
              to={workflowGuideDetailHref(w.slug, guideView)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
