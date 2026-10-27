import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/bits";
import type { WorkflowDef } from "@/handbook/lib/learning-catalog";
import { useHandbookAudience } from "@/handbook/hooks/useHandbookAudience";
import { LearningCard } from "@/handbook/components/learning/LearningCard";
import {
  parseWorkflowGuideView,
  workflowGuideDetailHref,
  type WorkflowGuideView,
} from "@/handbook/lib/role-workflows";
import { cn } from "@/lib/utils";

function ViewToggle({
  view,
  onChange,
}: {
  view: WorkflowGuideView;
  onChange: (view: WorkflowGuideView) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-border/70 bg-muted/30 p-0.5"
      role="tablist"
      aria-label="Workflow directory view"
    >
      {(
        [
          { id: "my" as const, label: "My workflows" },
          { id: "all" as const, label: "All workflows" },
        ] as const
      ).map((tab) => {
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium motion-safe:transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function WorkflowTile({ w, view }: { w: WorkflowDef; view: WorkflowGuideView }) {
  return (
    <LearningCard
      className="h-full min-h-[9rem]"
      title={w.title}
      description={w.description}
      to={workflowGuideDetailHref(w.slug, view)}
    />
  );
}

export function HandbookWorkflowsIndex() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseWorkflowGuideView(searchParams.get("view"));
  const { allWorkflows, myWorkflows, audienceRole } = useHandbookAudience();
  const workflows = view === "all" ? allWorkflows : myWorkflows;

  function setView(next: WorkflowGuideView) {
    setSearchParams(next === "all" ? { view: "all" } : { view: "my" }, { replace: true });
  }

  const description =
    view === "all"
      ? "All 13 Support Hub workflow guides — learning material only; opening a guide does not change app permissions."
      : audienceRole
        ? `Workflows where you have an operational role — ${workflows.length} guide${workflows.length === 1 ? "" : "s"} for your current handbook view.`
        : "Sign in to see workflows for your role.";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageHeader
          title="Workflow Guides"
          description={description}
          className="mb-0 min-w-0 flex-1 [&>div:first-child]:max-w-none [&>div:first-child_p]:max-w-none [&>div:first-child_p]:lg:whitespace-nowrap"
        />
        <ViewToggle view={view} onChange={setView} />
      </div>

      {view === "my" && workflows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No workflows are mapped to this handbook view.{" "}
          <Link to="/handbook/workflows?view=all" className="font-medium text-primary hover:underline">
            Browse all workflows
          </Link>
        </p>
      ) : (
        <ul className="mt-6 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workflows.map((w) => (
            <li key={w.slug} className="flex min-h-[9rem] min-w-0">
              <WorkflowTile w={w} view={view} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
