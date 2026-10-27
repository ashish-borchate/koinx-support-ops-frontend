import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { Coins, Film, GitBranch, ListTodo } from "lucide-react";

const RESPONSIBILITY_ROWS: { work: string; role: string }[] = [
  { work: "Integration Steps coordination", role: "Supervisor" },
  { work: "Integration Steps review", role: "Assigned Senior Agent" },
  { work: "Mintlify publishing coordination", role: "Supervisor" },
  { work: "Integration frontend work", role: "Assigned Tech Agent" },
  { work: "Token Migration recording", role: "Responsible manager" },
  { work: "Token Migration acknowledgement", role: "Tech Agent" },
  { work: "Product Guide accuracy and publishing", role: "Supervisor" },
  { work: "Agent QA evaluations", role: "Senior Agent" },
  { work: "Weekly KPI reporting", role: "Supervisor" },
  { work: "KPI targets and weights", role: "Admin" },
];

const TECH_TOC: HandbookTocItem[] = [
  { id: "overview", label: "Role overview" },
  { id: "workspace", label: "Workspace" },
  { id: "integration-follow-ups", label: "Integration follow-ups" },
  { id: "integration-steps", label: "Integration Steps" },
  { id: "token-migration", label: "Token migration" },
  { id: "support-updates", label: "Support updates" },
  { id: "priorities", label: "Daily priorities" },
  { id: "responsibilities", label: "Who handles what?" },
  { id: "attention", label: "Needs attention" },
  { id: "video", label: "Training video" },
];

export function TechAgentLearningDashboard() {
  useEffect(() => {
    markRoleVisited();
  }, []);

  return (
    <HandbookSectionNavProvider items={TECH_TOC}>
    <div className={HANDBOOK_PAGE_CLASS}>
      <HandbookRoleOverview>
        <HandbookRoleEyebrow roleLabel="Tech Agent" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Keep integrations working. Keep information accurate.
        </h1>
        <HandbookProse className="max-w-3xl">
          Complete assigned Integration Steps frontend work, acknowledge token migrations, and stay current on integration
          records. Workflow Guides describe each stage in detail.
        </HandbookProse>
        <HandbookCapabilityGrid>
          <li>
            <HandbookCapabilityCard icon={GitBranch} title="Integration Steps — Frontend Work" body="Complete assigned frontend tasks after the integration documentation reaches the appropriate stage." />
          </li>
          <li>
            <HandbookCapabilityCard icon={Coins} title="Token Migration — Acknowledgement" body="Review and acknowledge relevant token migration updates." />
          </li>
          <li>
            <HandbookCapabilityCard icon={ListTodo} title="Assigned Integration Follow-ups" body="Check assigned integration records, comments and outstanding handoffs." />
          </li>
        </HandbookCapabilityGrid>
      </HandbookRoleOverview>

      <HandbookOnThisPage items={TECH_TOC} />

      <HandbookSectionBlock
        id="workspace"
        title="Your Tech Workspace"
        intro="Start on the Dashboard; open each record for status, owners, and comments before you work."
        first
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Open Dashboard</Link>
          </Button>
        }
      >
        <HandbookCallout title="Important reminder">
          Not every task appears on the Dashboard—open the relevant tracker for assigned work.
        </HandbookCallout>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="integration-follow-ups" title="Assigned Integration Follow-ups">
        <HandbookBulletList
          items={[
            "Open the record: instructions, published docs, and reviewer comments.",
            "Read status updates before building so you know what is blocked.",
            "If documentation looks wrong, raise it with the Supervisor or reviewer before dependent work.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="integration-steps"
        title="Integration Steps"
        intro="When frontend work is assigned, use approved documentation, verify the result, and mark completion in the Hub."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/integration-steps">Integration Steps</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookCallout title="Important reminder">
          Supervisors coordinate the flow; Senior Agents review documentation; you own the assigned frontend stage.
        </HandbookCallout>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="token-migration"
        title="Token Migration"
        intro="Review migration details shared with you and acknowledge in the Hub to confirm you have read the update."
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/token-migration">Token Migration</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <HandbookCallout title="Important reminder">
          Acknowledgement confirms review—it does not mean all related technical work is finished elsewhere.
        </HandbookCallout>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="support-updates"
        title="Support Updates"
        intro="Read operational announcements, acknowledge when required, and re-acknowledge materially revised updates."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/support-updates">Support Updates</Link>
          </Button>
        }
      >
        <HandbookProse>Separate technical tasks still live in their own modules.</HandbookProse>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="priorities" title="Daily priorities">
        <HandbookBulletList
          items={[
            "Dashboard: tasks, updates, pending acknowledgements.",
            "Integration Steps ready for frontend work.",
            "Token Migration records needing acknowledgement.",
            "Comments and handoffs on assigned integrations.",
          ]}
        />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="responsibilities" title="Who Handles What?">
        <HandbookResponsibilityMatrix rows={RESPONSIBILITY_ROWS} />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="attention" title="When Something Needs Attention">
        <HandbookAttentionGrid>
          <HandbookAttentionItem title="Frontend work is ready">
            Review published instructions, complete the task, update the workflow.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Documentation looks incorrect">
            Coordinate with Supervisor or reviewer before building on bad data.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Comments need a response">
            Update the team on progress or open questions on the record.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Token Migration needs acknowledgement">
            Review details and acknowledge in the Hub.
          </HandbookAttentionItem>
        </HandbookAttentionGrid>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="video" title="Tech Agent Training Video">
        <div className="rounded-lg border border-border/50 bg-card/80 px-3.5 py-3">
          <p className="text-sm font-semibold text-foreground">Complete Tech Agent Walkthrough</p>
          <HandbookProse className="mt-1">Integrations, token migration, and Support Updates—coming soon.</HandbookProse>
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
