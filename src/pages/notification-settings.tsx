import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3">
      <input type="checkbox" className="mt-1" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="font-medium">{label}</span>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </span>
    </label>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="max-w-[120px]"
      />
    </div>
  );
}

export function NotificationSettingsPage() {
  const { can, viewAs } = useAuth();
  const queryClient = useQueryClient();
  const readOnly = Boolean(viewAs);
  const [draft, setDraft] = useState<NotificationCenterConfig | null>(null);

  const configQ = useQuery({
    queryKey: ["notification-center-config"],
    queryFn: () => api<{ config: NotificationCenterConfig }>("/api/notification-center/config"),
    enabled: can("notification_center.manage"),
  });

  useEffect(() => {
    if (configQ.data?.config) setDraft(configQ.data.config);
  }, [configQ.data]);

  const saveM = useMutation({
    mutationFn: (body: NotificationCenterConfig) =>
      api<{ config: NotificationCenterConfig }>("/api/notification-center/config", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notification-center-config"] });
    },
  });

  const runM = useMutation({
    mutationFn: () => api("/api/notification-center/run-processors", { method: "POST" }),
  });

  if (!can("notification_center.manage")) {
    return <ErrorBlock message="Only Admins can manage notification settings." />;
  }
  if (configQ.isLoading || !draft) return <LoadingBlock label="Loading notification settings…" />;
  if (configQ.isError) return <ErrorBlock message={String(configQ.error)} />;

  const c = draft.categories;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Notification settings"
        description="Controls in-app Notification Center processors. Changes apply on the next scheduled run (every 30 minutes) or when you run processors manually."
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Product Guides</h2>
        <ToggleRow
          label="Enable Product Guide notifications"
          checked={c.product_guides.enabled}
          disabled={readOnly}
          onChange={(v) => setDraft({ ...draft, categories: { ...c, product_guides: { ...c.product_guides, enabled: v } } })}
        />
        <ToggleRow
          label="Missed review alerts"
          hint="After an eligible working day ends without a review."
          checked={c.product_guides.missedEnabled}
          disabled={readOnly || !c.product_guides.enabled}
          onChange={(v) => setDraft({ ...draft, categories: { ...c, product_guides: { ...c.product_guides, missedEnabled: v } } })}
        />
        <NumberField
          label="Daily reminder hour (IST, 0–23)"
          value={c.product_guides.reminderHourIst}
          min={0}
          max={23}
          disabled={readOnly || !c.product_guides.enabled}
          onChange={(v) =>
            setDraft({ ...draft, categories: { ...c, product_guides: { ...c.product_guides, reminderHourIst: v } } })
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">QA</h2>
        <ToggleRow
          label="Enable QA notifications"
          checked={c.qa.enabled}
          disabled={readOnly}
          onChange={(v) => setDraft({ ...draft, categories: { ...c, qa: { ...c.qa, enabled: v } } })}
        />
        <NumberField
          label="Working days before appeal deadline reminder"
          value={c.qa.workingDaysBeforeAppeal}
          min={1}
          max={5}
          disabled={readOnly || !c.qa.enabled}
          onChange={(v) => setDraft({ ...draft, categories: { ...c, qa: { ...c.qa, workingDaysBeforeAppeal: v } } })}
        />
        <NumberField
          label="Working days before escalation deadline reminder"
          value={c.qa.workingDaysBeforeEscalation}
          min={1}
          max={5}
          disabled={readOnly || !c.qa.enabled}
          onChange={(v) =>
            setDraft({ ...draft, categories: { ...c, qa: { ...c.qa, workingDaysBeforeEscalation: v } } })
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Reported Issues</h2>
        <ToggleRow
          label="Enable Reported Issue notifications"
          checked={c.reported_issues.enabled}
          disabled={readOnly}
          onChange={(v) => setDraft({ ...draft, categories: { ...c, reported_issues: { ...c.reported_issues, enabled: v } } })}
        />
        <NumberField
          label="Due-soon window (calendar days before effective follow-up)"
          value={c.reported_issues.dueSoonDaysBefore}
          min={0}
          max={14}
          disabled={readOnly || !c.reported_issues.enabled}
          onChange={(v) =>
            setDraft({ ...draft, categories: { ...c, reported_issues: { ...c.reported_issues, dueSoonDaysBefore: v } } })
          }
        />
        <NumberField
          label="Days overdue before counting toward repeated alerts"
          hint="An issue must be overdue at least this many calendar days (by effective follow-up) to count."
          value={c.reported_issues.overdueRepeatDays}
          min={1}
          max={30}
          disabled={readOnly || !c.reported_issues.enabled}
          onChange={(v) =>
            setDraft({ ...draft, categories: { ...c, reported_issues: { ...c.reported_issues, overdueRepeatDays: v } } })
          }
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Coaching</h2>
        <ToggleRow
          label="Enable Coaching notifications"
          checked={c.coaching.enabled}
          disabled={readOnly}
          onChange={(v) => setDraft({ ...draft, categories: { ...c, coaching: { enabled: v } } })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Management routing</h2>
        <ToggleRow
          label="Enable team-level management alerts"
          hint="Routes factual alerts to Senior Agents, Supervisors, and Admins with notification_center.view_team."
          checked={c.management.enabled}
          disabled={readOnly}
          onChange={(v) => setDraft({ ...draft, categories: { ...c, management: { ...c.management, enabled: v } } })}
        />
        <NumberField
          label="Repeated Product Guide miss threshold (eligible working days in lookback)"
          value={c.management.repeatedPgMissThreshold}
          min={2}
          max={14}
          disabled={readOnly || !c.management.enabled}
          onChange={(v) =>
            setDraft({ ...draft, categories: { ...c, management: { ...c.management, repeatedPgMissThreshold: v } } })
          }
        />
        <NumberField
          label="Lookback period (calendar days for PG miss counting)"
          value={c.management.lookbackDays}
          min={3}
          max={30}
          disabled={readOnly || !c.management.enabled}
          onChange={(v) => setDraft({ ...draft, categories: { ...c, management: { ...c.management, lookbackDays: v } } })}
        />
        <NumberField
          label="Repeated overdue issue count (grouped management alert)"
          value={c.management.repeatedRiOverdueThreshold}
          min={2}
          max={14}
          disabled={readOnly || !c.management.enabled}
          onChange={(v) =>
            setDraft({ ...draft, categories: { ...c, management: { ...c.management, repeatedRiOverdueThreshold: v } } })
          }
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Button disabled={readOnly || saveM.isPending} onClick={() => saveM.mutate(draft)}>
          {saveM.isPending ? "Saving…" : "Save settings"}
        </Button>
        <Button variant="outline" disabled={readOnly || runM.isPending} onClick={() => runM.mutate()}>
          Run processors now
        </Button>
        {saveM.isSuccess ? <p className="self-center text-sm text-muted-foreground">Saved.</p> : null}
        {runM.isSuccess ? <p className="self-center text-sm text-muted-foreground">Processor run finished.</p> : null}
      </div>
    </div>
  );
}
