import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HandbookAgentQaDeadlines } from "@/handbook/components/HandbookAdminLiveSettings";
import {
  HANDBOOK_PAGE_CLASS,
  HandbookAttentionGrid,
  HandbookRoleOverview,
  HandbookSectionActions,
  HandbookSectionNavProvider,
  HandbookAttentionItem,
  HandbookBulletList,
  HandbookCallout,
  HandbookCapabilityCard,
  HandbookCapabilityGrid,
  HandbookOnThisPage,
  HandbookProse,
  HandbookResponsibilityMatrix,
  HandbookRoleEyebrow,
  HandbookSectionBlock,
  type HandbookTocItem,
} from "@/handbook/components/handbook-ui";
import { markRoleVisited } from "@/handbook/lib/progress";
import { BarChart3, ClipboardList, Film, Headphones, LayoutDashboard, MessageSquarePlus } from "lucide-react";

const RESPONSIBILITY_ROWS: { work: string; role: string }[] = [
  { work: "Customer conversations", role: "Agent" },
  { work: "Weekly KPI entry", role: "Supervisor" },
  { work: "KPI targets and weights", role: "Admin" },
  { work: "Agent QA evaluations", role: "Senior Agent" },
  { work: "QA acknowledgement", role: "Agent" },
  { work: "QA appeal submission", role: "Agent" },
  { work: "Initial QA appeal review", role: "Assigned reviewer" },
  { work: "Escalated QA appeal review", role: "Supervisor" },
  { work: "Coaching acknowledgement", role: "Agent" },
  { work: "Product Guide daily review", role: "Assigned Agent" },
  { work: "Product Guide accuracy and publishing", role: "Supervisor" },
  { work: "Product Feedback submission", role: "Agent" },
  { work: "Product Feedback review", role: "Supervisor" },
  { work: "Reported Issues submission", role: "Agent / Relevant employee" },
  { work: "Reported Issues triage", role: "Supervisor" },
  { work: "Negative Review acknowledgement", role: "Assigned Agent" },
  { work: "Daily DSAT Deep Dive", role: "Senior Agent" },
];

const AGENT_TOC: HandbookTocItem[] = [
  { id: "overview", label: "Role overview" },
  { id: "workspace", label: "Tools & workspace" },
  { id: "performance", label: "Performance" },
  { id: "qa-and-appeals", label: "QA & appeals" },
  { id: "coaching", label: "Coaching" },
  { id: "guides", label: "Guides & knowledge" },
  { id: "feedback", label: "Feedback & issues" },
  { id: "negative-reviews", label: "Negative reviews" },
  { id: "priorities", label: "Daily priorities" },
  { id: "responsibilities", label: "Who handles what?" },
  { id: "attention", label: "Needs attention" },
  { id: "video", label: "Training video" },
];

export function AgentLearningDashboard() {
  useEffect(() => {
    markRoleVisited();
  }, []);

  return (
    <HandbookSectionNavProvider items={AGENT_TOC}>
    <div className={HANDBOOK_PAGE_CLASS}>
      <HandbookRoleOverview>
        <HandbookRoleEyebrow roleLabel="Agent" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Deliver great support. Stay on top of your work.
        </h1>
        <HandbookProse className="max-w-3xl">
          You handle customers in Freshdesk. Support Hub tracks your performance, QA feedback, assigned tasks, and
          internal follow-ups—use Workflow Guides when you need step-by-step process detail.
        </HandbookProse>
        <HandbookCapabilityGrid>
          <li>
            <HandbookCapabilityCard icon={BarChart3} title="My Performance" body="Track your KPIs and understand how you're performing." />
          </li>
          <li>
            <HandbookCapabilityCard icon={ClipboardList} title="My QA Reviews" body="Review evaluations, acknowledge feedback and appeal scores when needed." />
          </li>
          <li>
            <HandbookCapabilityCard icon={LayoutDashboard} title="My Tasks" body="Complete assigned reviews, acknowledgements and follow-ups." />
          </li>
          <li>
            <HandbookCapabilityCard icon={MessageSquarePlus} title="Share Feedback" body="Report problems and suggest improvements based on customer interactions." />
          </li>
        </HandbookCapabilityGrid>
      </HandbookRoleOverview>

      <HandbookOnThisPage items={AGENT_TOC} />

      <HandbookSectionBlock
        id="workspace"
        title="Tools & workspace"
        intro="Freshdesk is customer conversations; Support Hub is internal work tied to your performance."
        first
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Open Dashboard</Link>
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <Headphones className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-semibold text-foreground">Freshdesk</p>
            </div>
            <HandbookProse className="mt-1.5">
              Handle tickets, investigate concerns, and follow team procedures.
            </HandbookProse>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="size-4 text-primary" aria-hidden />
              <p className="text-sm font-semibold text-foreground">Support Hub</p>
            </div>
            <HandbookProse className="mt-1.5">
              Dashboard, KPI results, QA, coaching, and module tasks. Some work appears only inside its tracker.
            </HandbookProse>
          </div>
        </div>
        <HandbookCallout title="Important reminder">
          Closing a Freshdesk ticket does not complete related Hub tasks—check the relevant module when internal follow-up
          is required.
        </HandbookCallout>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="performance"
        title="My Performance"
        intro="Review weekly KPI results after your Supervisor enters them; raise unclear metrics with your Supervisor."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/kpi">Open KPI Performance</Link>
          </Button>
        }
      >
        <HandbookBulletList
          items={[
            <>
              <strong className="font-medium text-foreground">Weekly KPI:</strong> Your scorecard uses your Freshdesk{" "}
              <strong>FRT</strong>, <strong>ART</strong> (average per response in the week), and <strong>resolution</strong>{" "}
              time—team ART on Management Overview is separate.
            </>,
            <>
              <strong className="font-medium text-foreground">QA:</strong> Evaluations feed quality performance; approved
              appeal adjustments update your effective QA score in KPI calculations.
            </>,
            "Admins set targets and weights; Supervisors enter weekly results.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="qa-and-appeals"
        title="Quality Assurance and Appeal"
        intro="Read Senior Agent feedback, acknowledge when required, and appeal within Hub deadlines if you disagree."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/qa">Open QA</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/qa/appeals">QA appeals</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookProse>
          Review each evaluation promptly. For appeals, explain which finding you dispute and why, with conversation
          context; the assigned reviewer decides, and eligible rejections can be escalated to a Supervisor within the
          escalation window.
        </HandbookProse>
        <HandbookAgentQaDeadlines className="mt-4" />
        <HandbookCallout title="Important reminder">
          An appeal does not change your score until a review approves an adjustment.
        </HandbookCallout>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="coaching"
        title="Coaching & Improvement"
        intro="Read assigned coaching, work on agreed actions, and acknowledge—or dispute—when prompted."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/coaching">Open Coaching Center</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookProse>
          Coaching records move through Pending → In Progress → Pending Acknowledgement → Completed, or to Acknowledgement
          Disputed when you disagree. Use feedback to improve future conversations, not only to clear Hub tasks.
        </HandbookProse>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="guides"
        title="Product Guides & Knowledge"
        intro="Complete assigned guide reviews; use the Knowledge Base for answers and report inaccuracies via the right channel."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/product-guides">Product Guides</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/knowledge-base">Knowledge Base</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/support-updates">Support Updates</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookBulletList
          items={[
            "Daily Product Guide reviews: check accuracy and complete the required review action.",
            "Knowledge Base: use articles in tickets; report corrections through issue reporting when needed.",
            "Support Updates: read announcements and acknowledge material changes when required.",
            "Supervisors own publishing and guide accuracy—you review and flag issues.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="feedback"
        title="Product Feedback & Reported Issues"
        intro="Share customer-driven improvements and operational problems with enough context for review."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/product-feedback">Product Feedback</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/reported-issues">Reported Issues</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
            <p className="text-sm font-semibold text-foreground">Product Feedback</p>
            <HandbookProse className="mt-1">
              Suggestions and feature ideas; Supervisors approve or reject. Approval does not auto-create engineering
              work.
            </HandbookProse>
          </div>
          <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
            <p className="text-sm font-semibold text-foreground">Reported Issues</p>
            <HandbookProse className="mt-1">
              Documentation or operational problems needing investigation; Supervisors triage. Closing an issue does not
              auto-fix the source doc.
            </HandbookProse>
          </div>
        </div>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="negative-reviews"
        title="Negative Reviews"
        intro="Read assigned cases, acknowledge when required, and apply learnings—or coordinate with Senior Agent or Supervisor."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/negative-reviews/tracker">Negative Reviews</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookProse>Complete acknowledgements when assigned and apply learnings to future conversations.</HandbookProse>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="priorities" title="Daily priorities">
        <HandbookBulletList
          items={[
            "Work Freshdesk tickets using team procedures.",
            "Check your Hub Dashboard for acknowledgements and tasks.",
            "Review new QA evaluations and appeal deadlines.",
            "Finish assigned guide reviews, coaching acks, and negative review follow-ups.",
            "Submit Product Feedback or Reported Issues when you spot patterns or problems.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="responsibilities" title="Who Handles What?">
        <HandbookResponsibilityMatrix rows={RESPONSIBILITY_ROWS} />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="attention" title="When Something Needs Attention">
        <HandbookAttentionGrid>
          <HandbookAttentionItem title="You disagree with a QA evaluation">
            Submit an appeal with supporting detail within the allowed deadline.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Your appeal was rejected">
            Check whether escalation is available and submit within the permitted window if eligible.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="A Product Guide is wrong">
            Report with enough detail for investigation and correction.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Coaching acknowledgement requested">
            Review the outcome before acknowledging; dispute if you disagree.
          </HandbookAttentionItem>
          <li className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-2.5 sm:col-span-2">
            <p className="text-sm font-semibold text-foreground">Repeated customer problems</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Use Product Feedback for improvements or Reported Issues for defects—pick the fit for the situation.
            </p>
          </li>
        </HandbookAttentionGrid>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="video" title="Agent Training Video">
        <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground">Complete Agent Walkthrough</p>
          <HandbookProse className="mt-1">
            Dashboard, KPI, QA, coaching, reviews, feedback, and reported issues—guided walkthrough coming soon.
          </HandbookProse>
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
