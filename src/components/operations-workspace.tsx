import { Link } from "react-router-dom";
import { SectionHeader } from "@/components/design/page-header";
import type { Metric } from "@/lib/format";
import { LatestSupportUpdatesSection, type SupportUpdateItem } from "@/components/support-updates-feed";
import { motionClass } from "@/components/design/tokens";
import { cn } from "@/lib/utils";
import { ResponsibilitiesBoard } from "@/components/design/responsibilities-board";
import { DashboardGreetingHero } from "@/components/dashboard-greeting-hero";
import { ModuleTasksBoard, type DashboardModuleGroup } from "@/components/module-tasks-board";
import { DashboardNeedsAttentionSection } from "@/components/dashboard-needs-attention-section";
import { QaWorkflowSummaryCards, type QaWorkflowCounter } from "@/components/qa-workflow-summary-cards";

export type WorkspaceAttention = {
  id: string;
  title: string;
  detail: string;
  href: string;
  sourceModule?: string;
  actionLabel?: string;
  priority?: string;
  kind?: string;
};

export type ResponsibilityGroups = {
  daily: { title: string; body: string }[];
  weekly: { title: string; body: string }[];
  asNeeded: { title: string; body: string }[];
};

export type WorkspacePayload = {
  greetingName: string;
  roleName: string;
  layout: "admin" | "senior_agent" | "supervisor" | "default";
  attention: WorkspaceAttention[];
  responsibilities: ResponsibilityGroups | null;
  quickAccess: { label: string; href: string }[];
  latestSupportUpdates?: SupportUpdateItem[];
  moduleTaskGroups?: DashboardModuleGroup[];
  moduleTaskTotal?: number;
  integrationReviewProgress?: { reviewed: number; targetMin: number; targetMax: number; weekStart: string };
  seniorAgentQaProgress?: { reviewed: number; targetMin: number; targetMax: number; weekStart: string };
  qaWorkflowSummary?: QaWorkflowCounter[] | null;
  teamOverview?: {
    weekLabel: string;
    ticketHealth: { sla: Metric; csat: Metric; backlog: Metric };
    attentionFlags: { tone: string; text: string }[];
    lowAgents: { name: string; sla: number | null; csat: number | null }[];
  } | null;
};

export function OperationsWorkspace({ workspace }: { workspace: WorkspacePayload }) {
  const attentionItems = workspace.attention;

  return (
    <div className="space-y-10">
      <DashboardGreetingHero displayName={workspace.greetingName} />

      <DashboardNeedsAttentionSection items={attentionItems} />

      {workspace.moduleTaskGroups && (workspace.moduleTaskTotal ?? 0) > 0 ? (
        <section>
          <SectionHeader
            title="Your pending tasks"
            description="Track and manage your pending work across the Support Hub."
            action={
              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                {workspace.moduleTaskTotal} total
              </span>
            }
          />
          <ModuleTasksBoard groups={workspace.moduleTaskGroups} total={workspace.moduleTaskTotal ?? 0} />
        </section>
      ) : null}

      <QaWorkflowSummaryCards counters={workspace.qaWorkflowSummary} />

      {workspace.latestSupportUpdates && workspace.latestSupportUpdates.length > 0 ? (
        <LatestSupportUpdatesSection items={workspace.latestSupportUpdates} />
      ) : null}

      {workspace.responsibilities ? (
        <section>
          <SectionHeader title="Your responsibilities" description="Reference guide — not a daily checklist." />
          <ResponsibilitiesBoard groups={workspace.responsibilities} />
        </section>
      ) : null}

      {workspace.quickAccess.length ? (
        <section>
          <SectionHeader title="Quick access" />
          <div className="flex flex-wrap gap-2">
            {workspace.quickAccess.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-sm text-foreground shadow-[var(--shadow-card)]",
                  motionClass,
                  "hover:border-primary/25 hover:text-primary",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
