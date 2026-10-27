import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { HandbookQaReviewDeadlines } from "@/handbook/components/HandbookAdminLiveSettings";
import {
  HANDBOOK_PAGE_CLASS,
  HandbookAttentionGrid,
  HandbookRoleOverview,
  HandbookSectionActions,
  HandbookSectionNavProvider,
  HandbookAttentionItem,
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
import {
  ClipboardCheck,
  Film,
  Gauge,
  LayoutDashboard,
  Users,
  ListChecks,
  Eye,
  UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RESPONSIBILITY_ROWS: { work: string; role: string }[] = [
  { work: "Employee access and roles", role: "Admin" },
  { work: "KPI targets and weights", role: "Admin" },
  { work: "Weekly KPI reporting", role: "Supervisor" },
  { work: "Agent QA evaluations", role: "Senior Agent" },
  { work: "Initial QA appeals", role: "Assigned reviewer" },
  { work: "Escalated QA appeals", role: "Supervisor" },
  { work: "Daily DSAT Deep Dive", role: "Senior Agent" },
  { work: "Product Guide publishing and accuracy", role: "Supervisor" },
  { work: "Product Feedback review", role: "Supervisor" },
  { work: "Reported Issues triage", role: "Supervisor" },
  { work: "Integration Steps review", role: "Assigned Senior Agent" },
  { work: "Integration frontend tasks", role: "Assigned Tech Agent" },
];

const ADMIN_TOC: HandbookTocItem[] = [
  { id: "overview", label: "Role overview" },
  { id: "people", label: "People & access" },
  { id: "settings", label: "Performance & QA" },
  { id: "dsat", label: "Daily DSAT" },
  { id: "oversight", label: "Operational oversight" },
  { id: "responsibilities", label: "Who handles what?" },
  { id: "attention", label: "Needs attention" },
  { id: "video", label: "Training video" },
];

function PeopleCard({
  title,
  body,
  icon: Icon,
}: {
  title: string;
  body: string;
  icon: typeof Users;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-border/70 bg-card/80 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function OversightCard({
  title,
  body,
  to,
}: {
  title: string;
  body: string;
  to?: string;
}) {
  const inner = (
    <>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {to ? (
        <Button variant="outline" size="sm" className="mt-3 w-fit" asChild>
          <Link to={to}>Open module</Link>
        </Button>
      ) : null}
    </>
  );
  const className =
    "flex h-full min-h-[8.5rem] flex-col rounded-lg border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]";
  if (to) {
    return (
      <div className={cn(className, "motion-safe:transition-colors hover:border-primary/25")}>
        {inner}
      </div>
    );
  }
  return <div className={className}>{inner}</div>;
}

export function AdminLearningDashboard() {
  useEffect(() => {
    markRoleVisited();
  }, []);

  return (
    <HandbookSectionNavProvider items={ADMIN_TOC}>
    <div className={HANDBOOK_PAGE_CLASS}>
      <HandbookRoleOverview>
        <HandbookRoleEyebrow roleLabel="Admin" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Manage the Hub. Support the team.
        </h1>
        <HandbookProse className="max-w-3xl">
          Configure access, performance, and QA settings, and oversee operations. Day-to-day execution stays with the
          roles responsible for each workflow—use Workflow Guides for process detail.
        </HandbookProse>
        <HandbookCapabilityGrid>
          <li>
            <HandbookCapabilityCard icon={Users} title="People & Access" body="Manage employee accounts, roles and access." />
          </li>
          <li>
            <HandbookCapabilityCard icon={Gauge} title="Performance Settings" body="Manage KPI targets and scoring weights." />
          </li>
          <li>
            <HandbookCapabilityCard icon={ClipboardCheck} title="QA Settings" body="Oversee appeal and escalation deadlines." />
          </li>
          <li>
            <HandbookCapabilityCard icon={LayoutDashboard} title="Team Oversight" body="Monitor performance and outstanding work." />
          </li>
        </HandbookCapabilityGrid>
      </HandbookRoleOverview>

      <HandbookOnThisPage items={ADMIN_TOC} />

      <HandbookSectionBlock
        id="people"
        title="People & Access"
        intro="Manage who can use Support Hub and what responsibilities they have."
        first
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/people">Add people</Link>
          </Button>
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          <PeopleCard icon={Users} title="Add employees" body="Create or invite employees and assign the correct role." />
          <PeopleCard
            icon={ListChecks}
            title="Manage access"
            body="Update roles when responsibilities change, and help employees with account access."
          />
          <PeopleCard
            icon={UserMinus}
            title="Deactivate accounts"
            body="Disable access when someone leaves the team. Check their pending assignments before handing work over."
          />
          <PeopleCard
            icon={Eye}
            title="View As"
            body="Preview another employee's experience to check access or help with training. This view is read-only."
          />
        </ul>
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Before deactivating an employee</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Check whether they have outstanding coaching, reported issues, integration reviews or other assigned work.
            Deactivation prevents login but does not automatically reassign existing records.
          </p>
        </div>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="settings" title="Performance & QA Settings">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex h-full flex-col rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-foreground">KPI Settings</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Set the targets and scoring weights used to measure team performance.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Supervisors normally enter weekly KPI results. Admins manage how performance is measured.
            </p>
            <Button variant="outline" size="sm" className="mt-4 w-fit" asChild>
              <Link to="/kpi">Open KPI Performance</Link>
            </Button>
          </div>
          <div className="flex h-full flex-col rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-foreground">QA Settings</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Oversee the deadlines for Agents to appeal QA evaluations and escalate eligible reviewer decisions.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              These deadlines are applied by the Hub when determining whether an appeal or escalation can be submitted.
            </p>
          </div>
        </div>
        <div className="mt-5 border-t border-border/40 pt-5">
          <HandbookQaReviewDeadlines />
        </div>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="dsat"
        title="Daily DSAT Deep Dive"
        action={
          <HandbookSectionActions>
            <Button variant="outline" size="sm" asChild>
              <Link to="/daily-dsat">Open DSAT</Link>
            </Button>
          </HandbookSectionActions>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Senior Agents complete Daily DSAT checks Monday through Saturday. The Hub tracks completed and outstanding
          reporting dates; Admins monitor the process without assigning a separate reporting owner in the handbook.
        </p>
      </HandbookSectionBlock>

      <HandbookSectionBlock
        id="oversight"
        title="Operational Oversight"
        intro="Your role is to ensure the team has the right access, settings and ownership to keep operations moving."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <OversightCard
              title="Dashboard"
              body="See relevant attention items, module tasks and team updates. Some tasks appear only for their assigned owner."
              to="/"
            />
          </li>
          <li>
            <OversightCard
              title="Management Overview"
              body="Review team performance and investigate unusual results through the relevant tracker."
              to="/management"
            />
          </li>
          <li className="sm:col-span-2 lg:col-span-1">
            <OversightCard
              title="Workflow Tracking"
              body="Follow the progress of QA appeals, reported issues, product feedback, documentation and coaching."
            />
          </li>
        </ul>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="responsibilities" title="Who Handles What?">
        <HandbookResponsibilityMatrix rows={RESPONSIBILITY_ROWS} />
      </HandbookSectionBlock>

      <HandbookSectionBlock id="attention" title="When Something Needs Attention">
        <HandbookAttentionGrid>
          <HandbookAttentionItem title="Employee leaves with pending work">
            Coordinate handover before or after deactivating access.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Agent cannot appeal QA">
            Confirm evaluation date and appeal deadline—the Hub blocks late submissions.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Review is overdue">
            Check owner and tracker; not every queue appears on the Admin dashboard.
          </HandbookAttentionItem>
          <HandbookAttentionItem title="Issue closed but problem remains">
            Review resolution and coordinate correction with the responsible employee.
          </HandbookAttentionItem>
        </HandbookAttentionGrid>
      </HandbookSectionBlock>

      <HandbookSectionBlock id="video" title="Admin Training Video">
        <div className="rounded-xl border border-border/70 bg-card px-4 py-4">
          <p className="font-semibold text-foreground">Complete Admin Walkthrough</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            One complete Admin walkthrough will cover employee management, KPI settings, QA deadlines, dashboard
            oversight and the important workflows.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-dashed border-border/80 bg-muted/30 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Film className="size-3.5" aria-hidden />
            Training video coming soon
          </p>
        </div>
      </HandbookSectionBlock>
    </div>
    </HandbookSectionNavProvider>
  );
}
