import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LayoutGrid } from "lucide-react";
import { workflowGuidesHref } from "@/handbook/lib/role-workflows";
import {
  HANDBOOK_SECTION_HIGHLIGHT_CLASS,
  HANDBOOK_SECTION_SCROLL,
  useHandbookSectionHighlight,
} from "@/handbook/components/handbook-ui";
import { cn } from "@/lib/utils";

export function RoleWorkflowGuidesLink() {
  const highlighted = useHandbookSectionHighlight("workflows");
  return (
    <section
      id="workflows"
      className={cn(
        HANDBOOK_SECTION_SCROLL,
        "border-t border-border/50 pt-8 pb-2",
        highlighted && HANDBOOK_SECTION_HIGHLIGHT_CLASS,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutGrid className="size-4 shrink-0 text-primary" aria-hidden />
          <h2 className="text-base font-semibold text-foreground">Workflow guides</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to={workflowGuidesHref("my")}>My workflows</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={workflowGuidesHref("all")}>All workflows</Link>
          </Button>
        </div>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
        Guides for workflows you participate in, or the full library of all Support Hub workflows.
      </p>
    </section>
  );
}
