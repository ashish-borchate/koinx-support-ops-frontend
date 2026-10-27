import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HandbookSupervisorQaDeadlines } from "@/handbook/components/HandbookAdminLiveSettings";
import {
  HANDBOOK_PAGE_CLASS,
  HandbookAttentionGrid,
  HandbookAttentionItem,
  HandbookBulletList,
  HandbookCapabilityCard,
  HandbookCapabilityGrid,
  HandbookOnThisPage,
  HandbookProse,
  HandbookResponsibilityMatrix,
  HandbookRoleEyebrow,
  HandbookRoleOverview,
  HandbookSectionActions,
  HandbookSectionBlock,
  HandbookSectionNavProvider,
  type HandbookTocItem,
} from "@/handbook/components/handbook-ui";
import { markRoleVisited } from "@/handbook/lib/progress";
import { BookOpen, ClipboardCheck, Film, Gauge, Layers } from "lucide-react";

const RESPONSIBILITY_ROWS: { work: string; role: string }[] = [
  { work: "Weekly KPI reporting", role: "Supervisor" },
  { work: "KPI targets and scoring weights", role: "Admin" },
  { work: "Agent QA evaluations", role: "Senior Agent" },
  { work: "Initial QA appeal decisions", role: "Assigned reviewer" },
  { work: "Escalated QA appeals", role: "Supervisor" },
  { work: "Coaching oversight", role: "Supervisor" },
  { work: "Daily DSAT Deep Dive", role: "Senior Agent" },
  { work: "Product Guide accuracy and publishing", role: "Supervisor" },
  { work: "Integration Steps coordination", role: "Supervisor" },
  { work: "Integration Steps review", role: "Assigned Senior Agent" },
  { work: "Integration frontend tasks", role: "Assigned Tech Agent" },
  { work: "Product Feedback review", role: "Supervisor" },
  { work: "Reported Issues triage", role: "Supervisor" },
  { work: "Support Updates management", role: "Supervisor / Admin" },
];

const SUPERVISOR_TOC: HandbookTocItem[] = [
  { id: "overview", label: "Role overview" },
  { id: "performance", label: "Team performance" },
  { id: "quality", label: "Quality & coaching" },
  { id: "documentation", label: "Documentation" },
  { id: "reviews", label: "Operational reviews" },
  { id: "priorities", label: "Daily priorities" },
  { id: "responsibilities", label: "Who handles what?" },
  { id: "attention", label: "Needs attention" },
  { id: "video", label: "Training video" },
];

function OpsCard({ title, sla, body, to }: { title: string; sla?: string; body: string; to: string }) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border/50 bg-card/80 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {sla ? (
          <span className="shrink-0 rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {sla}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <Button variant="outline" size="sm" className="mt-2.5 w-fit" asChild>
        <Link to={to}>Open module</Link>
      </Button>
    </div>
  );
}

export function SupervisorLearningDashboard() {
  useEffect(() => {
    markRoleVisited();
  }, []);

  return (
    <HandbookSectionNavProvider items={SUPERVISOR_TOC}>
    <div className={HANDBOOK_PAGE_CLASS}>
      <HandbookRoleOverview>
        <HandbookRoleEyebrow roleLabel="Supervisor" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Keep the team moving. Keep quality on track.
        </h1>
        <HandbookProse className="max-w-3xl">
          You oversee team performance, operational reviews, and documentation quality. Workflow Guides cover end-to-end
          processes; this page highlights what you own day to day.
        </HandbookProse>
        <HandbookCapabilityGrid>
          <li>
            <HandbookCapabilityCard icon={Gauge} title="Team Performance" body="Track weekly KPIs and identify areas needing improvement." />
          </li>
          <li>
            <HandbookCapabilityCard icon={ClipboardCheck} title="Quality & Coaching" body="Monitor QA outcomes, escalations and coaching progress." />
          </li>
          <li>
            <HandbookCapabilityCard icon={BookOpen} title="Knowledge & Documentation" body="Keep Product Guides and Integration Steps moving." />
          </li>
          <li>
            <HandbookCapabilityCard icon={Layers} title="Operational Reviews" body="Review feedback, reported issues and other pending work." />
          </li>
        </HandbookCapabilityGrid>
      </HandbookRoleOverview>

      <HandbookOnThisPage items={SUPERVISOR_TOC} />

      <HandbookSectionBlock
        id="performance"
        title="Team Performance"
        intro="Enter and review weekly KPI results on the Monday IST reporting cycle."
        first
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/kpi">Open KPI Performance</Link>
          </Button>
        }
      >
        <HandbookBulletList
          items={[
            <>
              Use duration picker for <strong>FRT</strong> and <strong>ART</strong> (e.g. <code>3h 10m 50s</code> from
              Freshdesk); resolution as decimal hours; one weekly team ART with no Agent filter.
            </>,
            "Follow up on missed targets and recurring quality concerns; approved QA appeal adjustments flow into KPI calculations.",
            "Admins set targets and weights—you enter and validate weekly results.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="quality"
        title="Quality Assurance, Appeal & Coaching"
        intro="Senior Agents evaluate tickets and handle initial appeals; you oversee QA quality, random audits, and eligible escalated appeals. Use KPI and QA trends to guide coaching and confirm acknowledgements."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/qa/appeals">QA appeals</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/coaching">Coaching Center</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookSupervisorQaDeadlines divider={false} className="mt-1" />
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="documentation"
        title="Knowledge & Documentation"
        intro="Keep guides, integrations, and knowledge articles accurate and moving through owners."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/product-guides">Product Guides</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/integration-steps">Integration Steps</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/knowledge-base">Knowledge Base</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/feature-impacts">Feature Impact</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookBulletList
          items={[
            "Product Guides: accuracy, corrections, publishing; Agents may have separate daily review tasks.",
            "Integration Steps: coordinate Senior Agent review and Tech Agent frontend work.",
            "Knowledge Base: organize content and follow up on Needs Update items.",
            "Feature Impact: track documentation readiness for product changes.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="reviews" title="Operational Reviews">
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <OpsCard
              title="Product Feedback"
              sla="48-hour review SLA"
              body="Approve or reject submissions; approval records the decision only."
              to="/product-feedback"
            />
          </li>
          <li>
            <OpsCard
              title="Reported Issues"
              body="Triage, assign, and track through resolution or documented no-action."
              to="/reported-issues"
            />
          </li>
          <li>
            <OpsCard
              title="Negative Reviews"
              body="Monitor follow-up and Agent acknowledgements."
              to="/negative-reviews/tracker"
            />
          </li>
          <li>
            <OpsCard
              title="Support Updates"
              body="Publish operational updates and confirm acknowledgements."
              to="/support-updates"
            />
          </li>
        </ul>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="priorities"
        title="Daily priorities"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Open Dashboard</Link>
          </Button>
        }
      >
        <HandbookBulletList
          items={[
            "Start on the Dashboard: attention items, overdue work, updates.",
            "Prioritize Product Feedback, Reported Issues, QA escalations, and documentation queues.",
            "Review team KPI/quality trends; complete weekly KPI entry on reporting day.",
            "Follow up on coaching, guide corrections, and integration handoffs.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="responsibilities" title="Who Handles What?">
        <HandbookResponsibilityMatrix rows={RESPONSIBILITY_ROWS} />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="attention" title="When Something Needs Attention">
        <HandbookAttentionGrid>
          <HandbookAttentionItem title="Product Feedback nearing deadline">
            Complete review within 48 hours; coordinate follow-up separately if needed.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Integration waiting on another owner">
            Check stage and follow up with the Senior Agent or Tech Agent on the next action.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Product Guide flagged inaccurate">
            Coordinate correction and publishing.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Eligible QA escalation submitted">
            Review evidence and resolve through the Supervisor escalation process.
          </HandbookAttentionItem>
        </HandbookAttentionGrid>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="video" title="Supervisor Training Video">
        <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground">Complete Supervisor Walkthrough</p>
          <HandbookProse className="mt-1">KPI reporting, QA oversight, coaching, and operational follow-ups—coming soon.</HandbookProse>
          <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-dashed border-border/80 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Film className="size-3.5" aria-hidden />
            Training video coming soon
          </p>
        </div>
      </HandbookSectionBlock>
    </div>
    </HandbookSectionNavProvider>
  );
}
