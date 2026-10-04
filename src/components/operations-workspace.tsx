import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AttentionList } from "@/components/design/attention-list";
import { MetricCard } from "@/components/design/metric-card";
import { SectionHeader } from "@/components/design/page-header";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatNumber, type Metric } from "@/lib/format";
import { LatestSupportUpdatesSection, type SupportUpdateItem } from "@/components/support-updates-feed";
import { surfaceCard, motionClass } from "@/components/design/tokens";
import { cn } from "@/lib/utils";

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
  layout: "senior_agent" | "supervisor" | "default";
  attention: WorkspaceAttention[];
  responsibilities: ResponsibilityGroups | null;
  quickAccess: { label: string; href: string }[];
  latestSupportUpdates?: SupportUpdateItem[];
  integrationReviewProgress?: { reviewed: number; targetMin: number; targetMax: number; weekStart: string };
  qaValidationProgress?: { validated: number; targetMin: number; targetMax: number; weekStart: string };
  pendingQaValidation?: { id: string; ticketRef: string; ticketSubject: string; agentName?: string; href: string }[];
  randomQaAudit?: { id: string; ticketRef: string; ticketSubject: string; href: string; randomAuditDone?: boolean }[];
  teamMeeting?: { id: string; meetingDate: string; notes: string; decisions: string; followUpNotes: string } | null;
  teamOverview?: {
    weekLabel: string;
    ticketHealth: { sla: Metric; csat: Metric; backlog: Metric };
    attentionFlags: { tone: string; text: string }[];
    lowAgents: { name: string; sla: number | null; csat: number | null }[];
  } | null;
};

import { ResponsibilitiesBoard } from "@/components/design/responsibilities-board";

function ProgressLine({ label, current, min, max }: { label: string; current: number; min: number; max: number }) {
  return (
    <MetricCard
      label={label}
      value={
        <>
          {current}{" "}
          <span className="text-base font-normal text-muted-foreground">
            / {max} <span className="text-xs">(target {min}–{max})</span>
          </span>
        </>
      }
      tone={current >= min ? "success" : current > 0 ? "info" : "default"}
    />
  );
}

function TeamMeetingEditor({ initial }: { initial: WorkspacePayload["teamMeeting"] }) {
  const { readOnly } = useAuth();
  const client = useQueryClient();
  const [meetingDate, setMeetingDate] = useState(initial?.meetingDate || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes || "");
  const [decisions, setDecisions] = useState(initial?.decisions || "");
  const [followUpNotes, setFollowUpNotes] = useState(initial?.followUpNotes || "");

  const save = useMutation({
    mutationFn: () =>
      api("/api/team-meeting", {
        method: "PUT",
        body: JSON.stringify({ meetingDate, notes, decisions, followUpNotes }),
      }),
    onSuccess: () => {
      toast.success("Meeting notes saved");
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly team meeting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Meeting date</Label>
          <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} disabled={readOnly} />
        </div>
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} disabled={readOnly} />
        </div>
        <div className="space-y-2">
          <Label>Decisions</Label>
          <Textarea value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={2} disabled={readOnly} />
        </div>
        <div className="space-y-2">
          <Label>Follow-up actions</Label>
          <Textarea value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} rows={2} disabled={readOnly} />
        </div>
        {!readOnly ? (
          <Button size="sm" disabled={save.isPending || !notes.trim()} onClick={() => save.mutate()}>
            Save notes
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function metricText(metric: Metric | undefined, suffix = "") {
  if (!metric || metric.value == null) return "—";
  return `${formatNumber(metric.value, 1)}${suffix}`;
}

function QueueLink({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={href}
      className={cn(surfaceCard, motionClass, "block px-4 py-3 hover:border-primary/20 hover:shadow-[var(--shadow-card-hover)]")}
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
    </Link>
  );
}

export function OperationsWorkspace({ workspace }: { workspace: WorkspacePayload }) {
  const attentionItems =
    workspace.layout === "supervisor" && workspace.pendingQaValidation?.length
      ? workspace.attention.filter((item) => !item.id.startsWith("qa-validate:"))
      : workspace.attention;

  return (
    <div className="space-y-10">
      <div className={cn(surfaceCard, "overflow-hidden border-primary/10 bg-gradient-to-br from-primary/[0.05] via-card to-card px-6 py-6 md:px-8")}>
        <p className="text-xs font-medium text-muted-foreground">Good morning, {workspace.greetingName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-[1.65rem]">
          {workspace.roleName} workspace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Support Operations control centre</p>
      </div>

      <section>
        <SectionHeader title="Needs your attention" description="Action items from live trackers — open a row to work it." />
        <AttentionList items={attentionItems} />
      </section>

      {workspace.latestSupportUpdates ? (
        <LatestSupportUpdatesSection items={workspace.latestSupportUpdates} />
      ) : null}

      {workspace.layout === "supervisor" ? (
        <>
          {workspace.teamOverview ? (
            <section>
              <SectionHeader title={`Team overview · ${workspace.teamOverview.weekLabel}`} />
              <div className="grid gap-3 sm:grid-cols-3">
                <ProgressLine
                  label="Integration reviews"
                  current={workspace.integrationReviewProgress?.reviewed ?? 0}
                  min={workspace.integrationReviewProgress?.targetMin ?? 5}
                  max={workspace.integrationReviewProgress?.targetMax ?? 8}
                />
                <ProgressLine
                  label="QA validation"
                  current={workspace.qaValidationProgress?.validated ?? 0}
                  min={workspace.qaValidationProgress?.targetMin ?? 6}
                  max={workspace.qaValidationProgress?.targetMax ?? 8}
                />
                <MetricCard
                  label="Ticket health"
                  value={
                    <span className="text-base font-semibold">
                      SLA {metricText(workspace.teamOverview.ticketHealth.sla, "%")} · CSAT{" "}
                      {metricText(workspace.teamOverview.ticketHealth.csat, "%")} · Backlog{" "}
                      {metricText(workspace.teamOverview.ticketHealth.backlog, "")}
                    </span>
                  }
                />
              </div>
              {workspace.teamOverview.attentionFlags.length ? (
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {workspace.teamOverview.attentionFlags.map((f, i) => (
                    <li key={i}>{f.text}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          {workspace.pendingQaValidation && workspace.pendingQaValidation.length > 0 ? (
            <section>
              <SectionHeader
                title="Pending QA validation"
                description={`Senior Agent evaluations awaiting validation (target ${workspace.qaValidationProgress?.targetMin ?? 6}–${workspace.qaValidationProgress?.targetMax ?? 8} per week).`}
              />
              <div className="space-y-2">
                {workspace.pendingQaValidation.map((row) => (
                  <QueueLink
                    key={row.id}
                    href={row.href}
                    title={`${row.ticketRef} · ${row.ticketSubject}`}
                    subtitle={`${row.agentName ? `${row.agentName} · ` : ""}Validate evaluation`}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {workspace.randomQaAudit && workspace.randomQaAudit.length > 0 ? (
            <section>
              <SectionHeader title="Random QA audit" description="Independent spot checks — no weekly target." />
              <div className="space-y-2">
                {workspace.randomQaAudit.map((row) => (
                  <QueueLink
                    key={row.id}
                    href={row.href}
                    title={`${row.ticketRef} · ${row.ticketSubject}`}
                    subtitle={row.randomAuditDone ? "Random audit recorded" : "Open for audit"}
                  />
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <TeamMeetingEditor initial={workspace.teamMeeting} />
          </section>
        </>
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
