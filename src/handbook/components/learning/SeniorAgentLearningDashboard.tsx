import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HandbookSeniorAgentQaDeadlines } from "@/handbook/components/HandbookAdminLiveSettings";
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
import { ClipboardCheck, Film, GitBranch, MessageSquare, ScanSearch } from "lucide-react";

const RESPONSIBILITY_ROWS: { work: string; role: string }[] = [
  { work: "Agent QA evaluations", role: "Senior Agent" },
  { work: "Initial QA appeal reviews", role: "Assigned reviewer" },
  { work: "Escalated QA appeals", role: "Supervisor" },
  { work: "Random QA audits", role: "Supervisor" },
  { work: "Daily DSAT Deep Dive", role: "Senior Agent" },
  { work: "Weekly KPI entry", role: "Supervisor" },
  { work: "KPI targets and weights", role: "Admin" },
  { work: "Integration Steps review", role: "Assigned Senior Agent" },
  { work: "Integration Steps coordination", role: "Supervisor" },
  { work: "Integration frontend work", role: "Assigned Tech Agent" },
  { work: "Product Guide publishing", role: "Supervisor" },
  { work: "Agent daily Product Guide review", role: "Assigned Agent" },
  { work: "Coaching oversight", role: "Supervisor" },
  { work: "Negative Reviews follow-up", role: "Relevant assigned employees" },
];

const SENIOR_TOC: HandbookTocItem[] = [
  { id: "overview", label: "Role overview" },
  { id: "qa-and-appeals", label: "QA & appeals" },
  { id: "integrations", label: "Integration reviews" },
  { id: "dsat", label: "Daily DSAT" },
  { id: "negative-reviews", label: "Negative reviews" },
  { id: "priorities", label: "Daily priorities" },
  { id: "responsibilities", label: "Who handles what?" },
  { id: "attention", label: "Needs attention" },
  { id: "video", label: "Training video" },
];

export function SeniorAgentLearningDashboard() {
  useEffect(() => {
    markRoleVisited();
  }, []);

  return (
    <HandbookSectionNavProvider items={SENIOR_TOC}>
    <div className={HANDBOOK_PAGE_CLASS}>
      <HandbookRoleOverview>
        <HandbookRoleEyebrow roleLabel="Senior Agent" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Lead by example. Help the team deliver better support.
        </h1>
        <HandbookProse className="max-w-3xl">
          You evaluate Agent interactions, resolve assigned QA appeals, review Integration Steps, and run Daily DSAT Deep
          Dive.
        </HandbookProse>
        <HandbookCapabilityGrid>
          <li>
            <HandbookCapabilityCard icon={ClipboardCheck} title="Quality Assurance" body="Evaluate Agent interactions and provide clear, actionable feedback." />
          </li>
          <li>
            <HandbookCapabilityCard icon={MessageSquare} title="QA Appeals" body="Review assigned appeals fairly and explain your decisions." />
          </li>
          <li>
            <HandbookCapabilityCard icon={GitBranch} title="Integration Reviews" body="Check Integration Steps for accuracy before they move forward." />
          </li>
          <li>
            <HandbookCapabilityCard icon={ScanSearch} title="Customer Experience" body="Review DSAT cases, negative reviews and recurring support concerns." />
          </li>
        </HandbookCapabilityGrid>
      </HandbookRoleOverview>

      <HandbookOnThisPage items={SENIOR_TOC} />

      <HandbookSectionBlock
        id="qa-and-appeals"
        title="Quality Assurance and Appeal"
        intro="Review full conversations, score against criteria, and give actionable feedback—not only point deductions."
        first
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
          Review assigned appeals by comparing the Agent&apos;s explanation with the original conversation and QA
          criteria. Record a clear decision to accept, partially accept, or reject the appeal. Eligible escalations are
          handled by the Supervisor.
        </HandbookProse>
        <HandbookSeniorAgentQaDeadlines className="mt-4" />
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="integrations"
        title="Integration Steps Review"
        intro="Check accuracy, completeness, and clarity; request changes or advance the review. Supervisors coordinate; Tech Agents handle frontend when ready."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/integration-steps">Integration Steps</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookCallout title="Important">
          Integration review is not Product Guide publishing—Supervisors own guide accuracy and publication.
        </HandbookCallout>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="dsat"
        title="Daily DSAT Deep Dive"
        intro="Complete Monday–Saturday: record DSAT Found or No DSAT Found for each scheduled day; follow up on patterns separately."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/daily-dsat">Open DSAT</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookCallout title="Important reminder">
          Completing DSAT does not auto-create Negative Review records—handle follow-up through the right workflow.
        </HandbookCallout>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="negative-reviews"
        title="Negative Reviews & Agent Support"
        intro="Review negative feedback, confirm pending Agent acknowledgements, and help Agents learn from difficult cases."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/negative-reviews/tracker">Negative Reviews</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/coaching">Coaching Center</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookProse>
          Supervisors oversee coaching completion—you support with examples from QA and customer experience.
        </HandbookProse>
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
            "Dashboard: appeals, integration reviews, updates.",
            "Complete scheduled Daily DSAT.",
            "QA evaluations and appeals within deadlines.",
            "Integration Steps awaiting your review.",
            "Negative feedback and Agent follow-ups.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="responsibilities" title="Who Handles What?">
        <HandbookResponsibilityMatrix rows={RESPONSIBILITY_ROWS} />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="attention" title="When Something Needs Attention">
        <HandbookAttentionGrid>
          <HandbookAttentionItem title="Agent appeals your QA score">
            Review evidence; Supervisor handles eligible escalations.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Integration instructions wrong">
            Request changes before the doc moves forward.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="No DSAT cases today">
            Still record <strong className="font-medium text-foreground">No DSAT Found</strong> for the scheduled day.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Recurring support problem">
            Raise through issue reporting or team follow-up.
          </HandbookAttentionItem>
          <li className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-2.5 sm:col-span-2">
            <p className="text-sm font-semibold text-foreground">Agent needs coaching help</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Use specific QA or customer examples to explain improvements.
            </p>
          </li>
        </HandbookAttentionGrid>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="video" title="Senior Agent Training Video">
        <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground">Complete Senior Agent Walkthrough</p>
          <HandbookProse className="mt-1">QA, appeals, integrations, DSAT, and customer experience—coming soon.</HandbookProse>
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
