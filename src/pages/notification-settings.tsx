import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorBlock, LoadingBlock } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

type NotificationCenterConfig = {
  categories: {
    product_guides: { enabled: boolean; reminderHourIst: number; missedEnabled: boolean };
    qa: { enabled: boolean; workingDaysBeforeAppeal: number; workingDaysBeforeEscalation: number };
    reported_issues: { enabled: boolean; dueSoonDaysBefore: number; overdueRepeatDays: number };
    coaching: { enabled: boolean };
    management: {
      enabled: boolean;
      repeatedPgMissThreshold: number;
      repeatedRiOverdueThreshold: number;
      lookbackDays: number;
    };
  };
};

type ProcessorRunRecord = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "failed";
  stats: Record<string, number>;
  error: string;
};

type ProcessorRunResponse =
  | { skipped: true; reason: string }
  | { skipped: false; failed: false; stats: Record<string, number>; at: string }
  | { skipped: false; failed: true; error: string; at: string; stats: Record<string, number> };

function configSnapshot(config: NotificationCenterConfig) {
  return JSON.stringify(config);
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function validateDraft(config: NotificationCenterConfig): string | null {
  const c = config.categories;
  const pgH = c.product_guides.reminderHourIst;
  if (pgH < 0 || pgH > 23) return "Daily reminder time must be between 12:00 AM and 11:00 PM IST.";
  if (c.qa.workingDaysBeforeAppeal < 1 || c.qa.workingDaysBeforeAppeal > 5) return "Appeal reminder must be 1–5 working days.";
  if (c.qa.workingDaysBeforeEscalation < 1 || c.qa.workingDaysBeforeEscalation > 5) {
    return "Escalation reminder must be 1–5 working days.";
  }
  if (c.reported_issues.dueSoonDaysBefore < 0 || c.reported_issues.dueSoonDaysBefore > 14) {
    return "Due-soon window must be 0–14 calendar days.";
  }
  if (c.reported_issues.overdueRepeatDays < 1 || c.reported_issues.overdueRepeatDays > 30) {
    return "Overdue threshold must be 1–30 calendar days.";
  }
  if (c.management.repeatedPgMissThreshold < 2 || c.management.repeatedPgMissThreshold > 14) {
    return "Product Guide miss threshold must be 2–14 working days.";
  }
  if (c.management.lookbackDays < 3 || c.management.lookbackDays > 30) return "Lookback must be 3–30 calendar days.";
  if (c.management.repeatedRiOverdueThreshold < 2 || c.management.repeatedRiOverdueThreshold > 14) {
    return "Repeated overdue threshold must be 2–14 issues.";
  }
  return null;
}

function formatIstHourLabel(hour: number) {
  const h = clampInt(hour, 0, 23);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:00 ${period} IST`;
}

const IST_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: formatIstHourLabel(hour),
}));

const TIPS = {
  pgMissed:
    "Sent after an eligible IST working day ends without a completed review. Weekly offs, company holidays, and approved full-day leave are excluded from eligible days.",
  pgReminder:
    "One global IST time for all agents (not shift-specific). Reminders apply only on eligible working days. Processors evaluate this hour on each run (about every 30 minutes while the API process is online).",
  qaAppeal:
    "Controls when the reminder appears, not the appeal deadline itself (set in QA workflow settings). Uses Shift Calendar working-day calculations.",
  qaEscalation:
    "Controls when the escalation reminder appears, not the escalation deadline itself (set in QA workflow settings). Uses Shift Calendar working-day calculations.",
  riDueSoon:
    "Calendar-day window before the effective follow-up date. Effective follow-up may already be adjusted for non-working days via Shift Calendar.",
  riRepeatOverdue:
    "An issue must be overdue by at least this many calendar days (by effective follow-up) before it counts toward grouped management overdue alerts.",
  coaching:
    "When enabled, processors maintain persistent Notification Center alerts for coaching acknowledgement and follow-up timing. New coaching assignments and acknowledgement disputes still use the separate Hub notification layer and are not controlled by this toggle.",
  management:
    "Delivered to each active Senior Agent, Supervisor, and Admin whose role includes the notification_center.view_team permission.",
  automationSchedule:
    "Processors run on a 30-minute timer inside the API server process while it is online. This is not a separate guaranteed external cron job.",
  automationStats:
    "Internal processor activity counters from the last run. These are not counts of notifications sent or delivered to users.",
} as const;

function processorRunStatusLabel(run: ProcessorRunRecord | undefined) {
  if (!run) return { text: "No runs yet", tone: "muted" as const };
  if (run.status === "running" && !run.finishedAt) return { text: "Running", tone: "active" as const };
  if (run.status === "success") return { text: "Success", tone: "success" as const };
  if (run.status === "failed") return { text: "Failed", tone: "error" as const };
  return { text: run.status, tone: "muted" as const };
}

function describeProcessorOutcome(result: ProcessorRunResponse) {
  if (result.skipped) {
    return result.reason === "lock_held"
      ? "Another processor run is in progress. Settings were saved; reconciliation will run on the next scheduled cycle."
      : "Processor run was skipped.";
  }
  if (result.failed) return `Processor failed: ${result.error || "Unknown error"}`;
  return "Notifications reconciled with the saved settings.";
}

function SettingSwitch({
  checked,
  disabled,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input dark:bg-muted",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-background shadow-sm ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

function CategoryEnableRow({
  title,
  description,
  checked,
  disabled,
  onChange,
  switchId,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  switchId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4">
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={switchId} className="font-medium text-foreground">
          {title}
        </label>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <SettingSwitch id={switchId} label={`${title} ${checked ? "on" : "off"}`} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function SubSettingRow({
  title,
  hint,
  checked,
  disabled,
  onChange,
  switchId,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  switchId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <label htmlFor={switchId} className="text-sm font-medium text-foreground">
          {title}
        </label>
        {hint ? <InfoTip label={hint} /> : null}
      </div>
      <SettingSwitch id={switchId} label={`${title} ${checked ? "on" : "off"}`} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function InlineNumber({
  value,
  min,
  max,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (v: number) => void;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={Number.isFinite(value) ? value : min}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 w-14 shrink-0 px-1 text-center tabular-nums"
    />
  );
}

function SettingLine({
  children,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-snug text-foreground",
        disabled && "opacity-50",
      )}
    >
      {children}
    </div>
  );
}

export function NotificationSettingsPage() {
  const { can, viewAs } = useAuth();
  const queryClient = useQueryClient();
  const readOnly = Boolean(viewAs);
  const [draft, setDraft] = useState<NotificationCenterConfig | null>(null);
  const savedRef = useRef<string>("");
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const [validationError, setValidationError] = useState("");

  const configQ = useQuery({
    queryKey: ["notification-center-config"],
    queryFn: () => api<{ config: NotificationCenterConfig }>("/api/notification-center/config"),
    enabled: can("notification_center.manage"),
  });

  const runsQ = useQuery({
    queryKey: ["notification-center-processor-runs"],
    queryFn: () => api<{ runs: ProcessorRunRecord[] }>("/api/notification-center/processor-runs"),
    enabled: can("notification_center.manage"),
    refetchInterval: (query) => {
      const latest = query.state.data?.runs?.[0];
      if (latest?.status === "running" && !latest.finishedAt) return 5000;
      return false;
    },
  });

  useEffect(() => {
    if (configQ.data?.config) {
      setDraft(configQ.data.config);
      savedRef.current = configSnapshot(configQ.data.config);
    }
  }, [configQ.data]);

  const dirty = useMemo(() => {
    if (!draft) return false;
    return configSnapshot(draft) !== savedRef.current;
  }, [draft]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const saveM = useMutation({
    mutationFn: (body: NotificationCenterConfig) =>
      api<{ config: NotificationCenterConfig; processorRun: ProcessorRunResponse }>("/api/notification-center/config", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      savedRef.current = configSnapshot(data.config);
      setDraft(data.config);
      setValidationError("");
      void queryClient.invalidateQueries({ queryKey: ["notification-center-config"] });
      void queryClient.invalidateQueries({ queryKey: ["notification-center-processor-runs"] });
      toast.success("Settings saved", { description: describeProcessorOutcome(data.processorRun) });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    },
  });

  const runM = useMutation({
    mutationFn: () => api<ProcessorRunResponse>("/api/notification-center/run-processors", { method: "POST" }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["notification-center-processor-runs"] });
      if (result.skipped) {
        toast.message("Processor skipped", { description: describeProcessorOutcome(result) });
      } else if (result.failed) {
        toast.error("Processor failed", { description: result.error || "Unknown error" });
      } else {
        toast.success("Processor finished", { description: "Open notifications were reconciled with current rules." });
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not run processors");
    },
  });

  const discard = useCallback(() => {
    if (configQ.data?.config) {
      setDraft(configQ.data.config);
      savedRef.current = configSnapshot(configQ.data.config);
      setValidationError("");
    }
  }, [configQ.data?.config]);

  const submitSave = () => {
    if (!draft || readOnly) return;
    const normalized: NotificationCenterConfig = {
      categories: {
        product_guides: {
          ...draft.categories.product_guides,
          reminderHourIst: clampInt(draft.categories.product_guides.reminderHourIst, 0, 23),
        },
        qa: {
          ...draft.categories.qa,
          workingDaysBeforeAppeal: clampInt(draft.categories.qa.workingDaysBeforeAppeal, 1, 5),
          workingDaysBeforeEscalation: clampInt(draft.categories.qa.workingDaysBeforeEscalation, 1, 5),
        },
        reported_issues: {
          ...draft.categories.reported_issues,
          dueSoonDaysBefore: clampInt(draft.categories.reported_issues.dueSoonDaysBefore, 0, 14),
          overdueRepeatDays: clampInt(draft.categories.reported_issues.overdueRepeatDays, 1, 30),
        },
        coaching: { ...draft.categories.coaching },
        management: {
          ...draft.categories.management,
          repeatedPgMissThreshold: clampInt(draft.categories.management.repeatedPgMissThreshold, 2, 14),
          lookbackDays: clampInt(draft.categories.management.lookbackDays, 3, 30),
          repeatedRiOverdueThreshold: clampInt(draft.categories.management.repeatedRiOverdueThreshold, 2, 14),
        },
      },
    };
    const problem = validateDraft(normalized);
    if (problem) {
      setValidationError(problem);
      return;
    }
    setValidationError("");
    saveM.mutate(normalized);
  };

  if (!can("notification_center.manage")) {
    return <ErrorBlock message="Only Admins can manage notification settings." />;
  }
  if (configQ.isLoading || !draft) return <LoadingBlock label="Loading notification settings…" />;
  if (configQ.isError) return <ErrorBlock message={String(configQ.error)} />;

  const c = draft.categories;
  const latestRun = runsQ.data?.runs?.[0];
  const runStatus = processorRunStatusLabel(latestRun);
  const pgDisabled = readOnly || !c.product_guides.enabled;
  const qaDisabled = readOnly || !c.qa.enabled;
  const riDisabled = readOnly || !c.reported_issues.enabled;
  const mgmtDisabled = readOnly || !c.management.enabled;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Notification Settings</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage automated reminders, alerts, and team notifications.
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                runStatus.tone === "success" && "border-emerald-600/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
                runStatus.tone === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
                runStatus.tone === "active" && "border-primary/30 bg-primary/10 text-primary",
                runStatus.tone === "muted" && "border-border bg-muted/50 text-muted-foreground",
              )}
            >
              Processor: {runStatus.text}
              {latestRun?.startedAt ? ` · ${formatWhen(latestRun.startedAt)}` : ""}
            </span>
            <Link to="/notifications" className="text-sm text-primary hover:underline">
              Notification Center
            </Link>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pt-1">
          <Button size="sm" variant="outline" disabled={!dirty || readOnly || saveM.isPending} onClick={discard}>
            Discard
          </Button>
          <Button size="sm" disabled={!dirty || readOnly || saveM.isPending} onClick={submitSave}>
            {saveM.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </header>

      {validationError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          View As is active — settings are read-only.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Product Guides</CardTitle>
            <CardDescription>Daily reviews and missed-day alerts on eligible working days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CategoryEnableRow
              switchId="pg-enabled"
              title="Enable notifications"
              checked={c.product_guides.enabled}
              disabled={readOnly}
              onChange={(v) =>
                setDraft({ ...draft, categories: { ...c, product_guides: { ...c.product_guides, enabled: v } } })
              }
            />
            <SubSettingRow
              switchId="pg-missed"
              title="Missed review alerts"
              hint={TIPS.pgMissed}
              checked={c.product_guides.missedEnabled}
              disabled={pgDisabled}
              onChange={(v) =>
                setDraft({ ...draft, categories: { ...c, product_guides: { ...c.product_guides, missedEnabled: v } } })
              }
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Label htmlFor="pg-reminder-time" className="text-sm font-medium">
                Daily reminder
              </Label>
              <InfoTip label={TIPS.pgReminder} />
              <Select
                value={String(clampInt(c.product_guides.reminderHourIst, 0, 23))}
                disabled={pgDisabled}
                onValueChange={(v) =>
                  setDraft({
                    ...draft,
                    categories: { ...c, product_guides: { ...c.product_guides, reminderHourIst: Number(v) } },
                  })
                }
              >
                <SelectTrigger id="pg-reminder-time" className="h-8 w-[10.5rem]" aria-label="Daily reminder time IST">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IST_HOUR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Quality Assurance</CardTitle>
            <CardDescription>Lead time before appeal and escalation deadlines.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CategoryEnableRow
              switchId="qa-enabled"
              title="Enable notifications"
              checked={c.qa.enabled}
              disabled={readOnly}
              onChange={(v) => setDraft({ ...draft, categories: { ...c, qa: { ...c.qa, enabled: v } } })}
            />
            <SettingLine disabled={qaDisabled}>
              <span>Remind</span>
              <InlineNumber
                value={c.qa.workingDaysBeforeAppeal}
                min={1}
                max={5}
                disabled={qaDisabled}
                ariaLabel="Working days before appeal deadline reminder"
                onChange={(v) =>
                  setDraft({ ...draft, categories: { ...c, qa: { ...c.qa, workingDaysBeforeAppeal: v } } })
                }
              />
              <span>
                working day{c.qa.workingDaysBeforeAppeal === 1 ? "" : "s"} before appeal deadline
              </span>
              <InfoTip label={TIPS.qaAppeal} />
            </SettingLine>
            <SettingLine disabled={qaDisabled}>
              <span>Remind</span>
              <InlineNumber
                value={c.qa.workingDaysBeforeEscalation}
                min={1}
                max={5}
                disabled={qaDisabled}
                ariaLabel="Working days before escalation deadline reminder"
                onChange={(v) =>
                  setDraft({ ...draft, categories: { ...c, qa: { ...c.qa, workingDaysBeforeEscalation: v } } })
                }
              />
              <span>
                working day{c.qa.workingDaysBeforeEscalation === 1 ? "" : "s"} before escalation deadline
              </span>
              <InfoTip label={TIPS.qaEscalation} />
            </SettingLine>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Reported Issues</CardTitle>
            <CardDescription>Follow-up due-soon and overdue alerts for assignees.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CategoryEnableRow
              switchId="ri-enabled"
              title="Enable notifications"
              checked={c.reported_issues.enabled}
              disabled={readOnly}
              onChange={(v) =>
                setDraft({ ...draft, categories: { ...c, reported_issues: { ...c.reported_issues, enabled: v } } })
              }
            />
            <SettingLine disabled={riDisabled}>
              <span>Remind</span>
              <InlineNumber
                value={c.reported_issues.dueSoonDaysBefore}
                min={0}
                max={14}
                disabled={riDisabled}
                ariaLabel="Calendar days before follow-up due-soon reminder"
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    categories: { ...c, reported_issues: { ...c.reported_issues, dueSoonDaysBefore: v } },
                  })
                }
              />
              <span>calendar day{c.reported_issues.dueSoonDaysBefore === 1 ? "" : "s"} before follow-up</span>
              <InfoTip label={TIPS.riDueSoon} />
            </SettingLine>
            <SettingLine disabled={riDisabled}>
              <span>Repeated overdue count after</span>
              <InlineNumber
                value={c.reported_issues.overdueRepeatDays}
                min={1}
                max={30}
                disabled={riDisabled}
                ariaLabel="Calendar days overdue before repeated management count"
                onChange={(v) =>
                  setDraft({
                    ...draft,
                    categories: { ...c, reported_issues: { ...c.reported_issues, overdueRepeatDays: v } },
                  })
                }
              />
              <span>calendar days (management alerts)</span>
              <InfoTip label={TIPS.riRepeatOverdue} />
            </SettingLine>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Coaching</CardTitle>
            <CardDescription>Acknowledgement and follow-up in the Notification Center.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CategoryEnableRow
              switchId="coaching-enabled"
              title="Enable notifications"
              checked={c.coaching.enabled}
              disabled={readOnly}
              onChange={(v) => setDraft({ ...draft, categories: { ...c, coaching: { enabled: v } } })}
            />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Hub assignment and dispute toasts are separate.</span>
              <InfoTip label={TIPS.coaching} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle>Management alerts</CardTitle>
                <CardDescription>Team monitors with notification team access.</CardDescription>
              </div>
              <InfoTip label={TIPS.management} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryEnableRow
              switchId="mgmt-enabled"
              title="Enable team alerts"
              checked={c.management.enabled}
              disabled={readOnly}
              onChange={(v) => setDraft({ ...draft, categories: { ...c, management: { ...c.management, enabled: v } } })}
            />
            <div className="grid gap-4 border-t border-border/60 pt-4 md:grid-cols-3">
              <SettingLine disabled={mgmtDisabled}>
                <span>Miss</span>
                <InlineNumber
                  value={c.management.repeatedPgMissThreshold}
                  min={2}
                  max={14}
                  disabled={mgmtDisabled}
                  ariaLabel="Eligible working days missed threshold"
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      categories: { ...c, management: { ...c.management, repeatedPgMissThreshold: v } },
                    })
                  }
                />
                <span className="text-muted-foreground">working days (PG)</span>
                <InfoTip label="Counts eligible working days without a Product Guide review in the lookback window." />
              </SettingLine>
              <SettingLine disabled={mgmtDisabled}>
                <span>Look back</span>
                <InlineNumber
                  value={c.management.lookbackDays}
                  min={3}
                  max={30}
                  disabled={mgmtDisabled}
                  ariaLabel="Product Guide lookback calendar days"
                  onChange={(v) =>
                    setDraft({ ...draft, categories: { ...c, management: { ...c.management, lookbackDays: v } } })
                  }
                />
                <span className="text-muted-foreground">calendar days</span>
                <InfoTip label="Calendar-day lookback used when counting missed Product Guide working days." />
              </SettingLine>
              <SettingLine disabled={mgmtDisabled}>
                <span>Overdue issues</span>
                <InlineNumber
                  value={c.management.repeatedRiOverdueThreshold}
                  min={2}
                  max={14}
                  disabled={mgmtDisabled}
                  ariaLabel="Repeated overdue reported issues threshold"
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      categories: { ...c, management: { ...c.management, repeatedRiOverdueThreshold: v } },
                    })
                  }
                />
                <span className="text-muted-foreground">count (RI)</span>
                <InfoTip label="Grouped alert when an assignee has at least this many repeatedly overdue issues (see Reported Issues overdue-day rule)." />
              </SettingLine>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-foreground">Automation status</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>
                Last run:{" "}
                <span className="text-foreground">{latestRun?.startedAt ? formatWhen(latestRun.startedAt) : "—"}</span>
                <span className="mx-2 text-border">·</span>
                Status:{" "}
                <span
                  className={cn(
                    runStatus.tone === "success" && "text-emerald-700 dark:text-emerald-300",
                    runStatus.tone === "error" && "text-destructive",
                    runStatus.tone === "active" && "text-primary",
                  )}
                >
                  {runStatus.text}
                </span>
                <span className="mx-2 text-border">·</span>
                Schedule: every 30 min (API process)
              </span>
              <InfoTip label={TIPS.automationSchedule} side="top" />
            </p>
            {latestRun?.status === "failed" && latestRun.error ? (
              <p className="text-xs text-destructive">{latestRun.error}</p>
            ) : null}
            {latestRun?.status === "success" && latestRun.stats && Object.keys(latestRun.stats).length > 0 ? (
              <div className="flex items-start gap-1 text-xs text-muted-foreground">
                <details className="min-w-0 flex-1">
                  <summary className="cursor-pointer select-none hover:text-foreground">Technical run details</summary>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed">
                    {Object.entries(latestRun.stats)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")}
                  </p>
                </details>
                <InfoTip label={TIPS.automationStats} className="size-5" />
              </div>
            ) : null}
          </div>
          <Button size="sm" variant="outline" className="shrink-0" disabled={readOnly || runM.isPending} onClick={() => setConfirmRunOpen(true)}>
            {runM.isPending ? "Running…" : "Run now"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmRunOpen} onOpenChange={setConfirmRunOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run notification processors now?</DialogTitle>
            <DialogDescription>
              This reconciles open Notification Center alerts with the current saved settings. If another run is already in
              progress, this request may be skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRunOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={runM.isPending}
              onClick={() => {
                setConfirmRunOpen(false);
                runM.mutate();
              }}
            >
              Run processors
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
