import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CalendarSettingsSheet } from "@/components/agent-calendar/calendar-settings-sheet";
import { AgentDayLeavePanel, requestKindLabel } from "@/components/agent-calendar/agent-day-leave-panel";
import { MonthYearPicker } from "@/components/agent-calendar/month-year-picker";
import { IstDatePicker } from "@/components/ui/ist-date-picker";
import { DOW_LABELS, statusBadgeClass, statusLabel, TEAM_CALENDAR_ID } from "@/components/agent-calendar/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock, PageHeader, SectionHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatCalendarDate, formatMonth, monthKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { monthGridDateKeys, monthStartEnd, shiftMonthKey } from "@/lib/ist-calendar-grid";

type CalendarDay = {
  dateIst: string;
  isWorkingDay: boolean;
  isWeeklyOff: boolean;
  isHoliday: boolean;
  leaveKind: string;
};

type CalendarPayload = {
  calendar: { days: CalendarDay[]; summary: { workingDays: number; weeklyOffDays: number; holidays: number } };
  weeklyOffs: { effectiveFromIst: string; dayOfWeek: number; note: string }[];
  shifts: { effectiveFromIst: string; startTimeIst: string; endTimeIst: string; name: string }[];
  leave: {
    id: string;
    startDateIst: string;
    endDateIst: string;
    kind: string;
    status: string;
    reason: string;
    cancelledVia?: "agent_request" | "admin_override" | null;
    cancelReason?: string;
    cancelledByName?: string | null;
    cancelledAt?: string | null;
    cancellationRetryBlocked?: boolean;
  }[];
  leaveChangeRequests: {
    id: string;
    leaveId: string;
    requestType: "modification" | "cancellation";
    status: string;
    proposedStartDateIst?: string;
    proposedEndDateIst?: string;
    proposedReason?: string;
    cancellationReason?: string;
    decisionReason?: string;
    decidedByName?: string | null;
    decidedAt?: string | null;
  }[];
  holidays: { dateIst: string; name: string }[];
  canManage: boolean;
  canRequestLeave: boolean;
  currentShiftDisplay: string | null;
  todayIst: string;
};

type TeamDay = {
  dateIst: string;
  isHoliday: boolean;
  holidayName: string | null;
  working: number;
  onApprovedLeave: number;
  weeklyOff: number;
  pendingLeave: number;
};

type PendingLeave = {
  id: string;
  requestKind: "new_leave" | "modification" | "cancellation";
  leaveId: string | null;
  changeRequestId: string | null;
  agentId: string;
  agentName: string;
  startDateIst: string;
  endDateIst: string;
  reason: string;
  kind?: string;
  originalStartDateIst?: string;
  originalEndDateIst?: string;
  proposedStartDateIst?: string;
  proposedEndDateIst?: string;
  proposedReason?: string;
  cancellationReason?: string;
};

function agentDayClasses(
  day: CalendarDay | undefined,
  todayIst: string,
  inMonth: boolean,
  dateIst: string,
  selectedDate: string | null,
) {
  if (!day || !inMonth) return "bg-muted/30 text-muted-foreground";
  let status =
    "border border-transparent bg-muted/20 text-foreground";
  if (day.isHoliday) {
    status = "border border-rose-500/25 bg-rose-500/10 text-rose-950 dark:text-rose-50";
  } else if (day.leaveKind === "full_pending") {
    status = "border border-dashed border-muted-foreground/45 bg-background text-muted-foreground";
  } else if (day.leaveKind !== "none") {
    status = "border border-amber-500/25 bg-amber-500/12 text-amber-950 dark:text-amber-50";
  } else if (day.isWeeklyOff) {
    status = "border border-slate-400/30 bg-slate-200/70 text-slate-900 dark:bg-slate-500/12 dark:text-slate-100";
  } else if (day.isWorkingDay) {
    status = "border border-emerald-600/20 bg-emerald-500/10 text-emerald-950 dark:text-emerald-50";
  }
  const selected = selectedDate === dateIst;
  const today = dateIst === todayIst;
  return cn(
    status,
    selected && "ring-2 ring-inset ring-primary/80",
    today && !selected && "ring-1 ring-inset ring-primary/45",
  );
}

export function AgentCalendarPage() {
  const { user, effective, can, readOnly } = useAuth();
  const qc = useQueryClient();
  const canTeam = can("agent_calendar.view_team");
  const canManage = can("agent_calendar.manage");
  /** Effective user id (View As target or signed-in user). */
  const selfId = effective?.id || user?.id || "";
  const pendingRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();

  const [selectedAgent, setSelectedAgent] = useState(canTeam ? TEAM_CALENDAR_ID : selfId);
  const [month, setMonth] = useState(monthKey());
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scheduleAgentId, setScheduleAgentId] = useState("");
  const [focusDateIst, setFocusDateIst] = useState<string | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<PendingLeave | null>(null);

  const isTeamView = canTeam && selectedAgent === TEAM_CALENDAR_ID;
  const individualAgentId = isTeamView ? "" : canTeam ? selectedAgent : selfId;
  const { start, end } = monthStartEnd(month);

  const canManageLeaveOnCalendar = canManage && !isTeamView && Boolean(individualAgentId) && individualAgentId !== selfId;

  useEffect(() => {
    if (searchParams.get("focus") === "pending-leave" && pendingRef.current) {
      pendingRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!canTeam && selfId) setSelectedAgent(selfId);
  }, [canTeam, selfId]);

  const rosterQ = useQuery({
    queryKey: ["agent-calendar-roster"],
    queryFn: () => api<{ agents: { id: string; name: string }[] }>("/api/agent-calendar/roster"),
    enabled: canTeam,
  });

  useEffect(() => {
    const focusDate = searchParams.get("focusDate");
    const agentFromUrl = searchParams.get("agentId");
    if (agentFromUrl && canTeam && rosterQ.data?.agents.some((a) => a.id === agentFromUrl)) {
      setSelectedAgent(agentFromUrl);
    }
    if (focusDate && /^\d{4}-\d{2}-\d{2}$/.test(focusDate)) {
      setMonth(focusDate.slice(0, 7));
      setFocusDateIst(focusDate);
      setDayDialogOpen(true);
    }
  }, [searchParams, canTeam, rosterQ.data?.agents]);

  const teamCalendarQ = useQuery({
    queryKey: ["team-calendar", start, end],
    queryFn: () => api<{ days: TeamDay[]; agentCount: number }>(`/api/agent-calendar/team-calendar?from=${start}&to=${end}`),
    enabled: isTeamView,
  });

  const calendarQ = useQuery({
    queryKey: ["agent-calendar", individualAgentId, start, end],
    queryFn: () => api<CalendarPayload>(`/api/agent-calendar/agents/${individualAgentId}?from=${start}&to=${end}`),
    enabled: Boolean(individualAgentId),
  });

  const scheduleQ = useQuery({
    queryKey: ["agent-calendar", scheduleAgentId, "settings"],
    queryFn: () => api<CalendarPayload>(`/api/agent-calendar/agents/${scheduleAgentId}?from=${start}&to=${end}`),
    enabled: settingsOpen && Boolean(scheduleAgentId),
  });

  const pendingQ = useQuery({
    queryKey: ["pending-leave"],
    queryFn: () => api<{ items: PendingLeave[] }>("/api/agent-calendar/pending-leave"),
    enabled: canManage,
  });

  const teamAvailQ = useQuery({
    queryKey: ["team-availability", focusDateIst],
    queryFn: () =>
      api<{
        agents: { agentId: string; name: string; status: string; shiftDisplay: string | null }[];
      }>(`/api/agent-calendar/team-availability?dateIst=${focusDateIst}`),
    enabled: canTeam && Boolean(focusDateIst) && isTeamView,
  });

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["agent-calendar"] });
    void qc.invalidateQueries({ queryKey: ["team-calendar"] });
    void qc.invalidateQueries({ queryKey: ["team-availability"] });
    void qc.invalidateQueries({ queryKey: ["pending-leave"] });
  };

  const requestLeaveM = useMutation({
    mutationFn: (body: { startDateIst: string; endDateIst: string; reason: string }) =>
      api("/api/agent-calendar/me/leave-requests", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Leave request submitted for approval");
      invalidateAll();
      setDayDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordLeaveM = useMutation({
    mutationFn: (body: { agentId: string; startDateIst: string; endDateIst: string; reason?: string }) =>
      api(`/api/agent-calendar/agents/${body.agentId}/leave`, {
        method: "POST",
        body: JSON.stringify({ ...body, kind: "full", autoApprove: true }),
      }),
    onSuccess: () => {
      toast.success("Approved leave recorded");
      invalidateAll();
      setDayDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decisionM = useMutation({
    mutationFn: ({
      id,
      decision,
      rejectionReason,
    }: {
      id: string;
      decision: "approved" | "rejected";
      rejectionReason?: string;
    }) =>
      api(`/api/agent-calendar/leave/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, rejectionReason }),
      }),
    onSuccess: () => {
      toast.success("Leave decision saved");
      invalidateAll();
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideChangeM = useMutation({
    mutationFn: ({
      changeId,
      decision,
      rejectionReason,
    }: {
      changeId: string;
      decision: "approved" | "rejected";
      rejectionReason?: string;
    }) =>
      api(`/api/agent-calendar/leave-change/${changeId}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, rejectionReason }),
      }),
    onSuccess: () => {
      toast.success("Leave change decision saved");
      invalidateAll();
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const modificationLeaveM = useMutation({
    mutationFn: ({
      leaveId,
      ...body
    }: {
      leaveId: string;
      startDateIst: string;
      endDateIst: string;
      reason: string;
    }) =>
      api(`/api/agent-calendar/me/leave/${leaveId}/modification-request`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Modification submitted for approval");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancellationLeaveM = useMutation({
    mutationFn: ({ leaveId, reason }: { leaveId: string; reason: string }) =>
      api(`/api/agent-calendar/me/leave/${leaveId}/cancellation-request`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast.success("Cancellation request submitted");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adminCancelLeaveM = useMutation({
    mutationFn: ({ leaveId, reason }: { leaveId: string; reason: string }) =>
      api(`/api/agent-calendar/leave/${leaveId}/admin-cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      toast.success("Leave cancelled");
      invalidateAll();
      setDayDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allowCancellationRetryM = useMutation({
    mutationFn: (leaveId: string) =>
      api(`/api/agent-calendar/leave/${leaveId}/allow-cancellation-retry`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Agent can submit a new cancellation request");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewedAgentName = useMemo(() => {
    if (!canTeam) return effective?.name || user?.name || "Agent";
    return rosterQ.data?.agents.find((a) => a.id === individualAgentId)?.name || "Agent";
  }, [canTeam, effective?.name, user?.name, rosterQ.data?.agents, individualAgentId]);

  const submitPendingDecision = (item: PendingLeave, decision: "approved" | "rejected", rejectionReason?: string) => {
    if (item.requestKind === "new_leave" && item.leaveId) {
      decisionM.mutate({ id: item.leaveId, decision, rejectionReason });
      return;
    }
    if (item.changeRequestId) {
      decideChangeM.mutate({ changeId: item.changeRequestId, decision, rejectionReason });
    }
  };

  const openReject = (item: PendingLeave) => {
    setRejectTarget(item);
    setRejectReason("");
    setRejectOpen(true);
  };

  const dayMap = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of calendarQ.data?.calendar.days ?? []) m.set(d.dateIst, d);
    return m;
  }, [calendarQ.data]);

  const teamDayMap = useMemo(() => {
    const m = new Map<string, TeamDay>();
    for (const d of teamCalendarQ.data?.days ?? []) m.set(d.dateIst, d);
    return m;
  }, [teamCalendarQ.data]);

  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    if (isTeamView) {
      for (const d of teamCalendarQ.data?.days ?? []) {
        if (d.holidayName) m.set(d.dateIst, d.holidayName);
      }
    } else {
      for (const h of calendarQ.data?.holidays ?? []) m.set(h.dateIst, h.name);
    }
    return m;
  }, [isTeamView, teamCalendarQ.data, calendarQ.data]);

  const gridDates = useMemo(() => monthGridDateKeys(month), [month]);
  const monthPrefix = `${month}-`;
  const agents = rosterQ.data?.agents ?? [];

  const pendingOnDate = useMemo(() => {
    if (!focusDateIst || !canManage) return [];
    return (pendingQ.data?.items ?? []).filter((p) => {
      const start = p.requestKind !== "new_leave" && p.originalStartDateIst ? p.originalStartDateIst : p.startDateIst;
      const end = p.requestKind !== "new_leave" && p.originalEndDateIst ? p.originalEndDateIst : p.endDateIst;
      return start <= focusDateIst && end >= focusDateIst;
    });
  }, [pendingQ.data, focusDateIst, canManage]);

  const openSettings = () => {
    if (individualAgentId) {
      setScheduleAgentId(individualAgentId);
    } else if (!scheduleAgentId && agents[0]?.id) {
      setScheduleAgentId(agents[0].id);
    }
    setSettingsOpen(true);
  };

  if (!can("agent_calendar.view_own") && !canTeam) {
    return <Empty title="No access" body="You do not have permission to view agent calendars." />;
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="Agent Calendar"
        description="Working days, leave approvals, weekly offs, and holidays (IST)."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {canTeam ? (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
              <span className="sr-only">View</span>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="h-8 min-w-[15rem] max-w-[20rem] border-0 bg-transparent shadow-none focus:ring-0 focus-visible:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TEAM_CALENDAR_ID}>All Agents — Team Calendar</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(shiftMonthKey(month, -1))} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => setMonth(monthKey())}>
              Today
            </Button>
            <Button type="button" variant="ghost" className="h-8 px-3 text-sm font-semibold" onClick={() => setMonthPickerOpen(true)}>
              {formatMonth(month)}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(shiftMonthKey(month, 1))} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isTeamView && calendarQ.data?.currentShiftDisplay ? (
            <p className="self-center text-xs text-muted-foreground">Shift: {calendarQ.data.currentShiftDisplay}</p>
          ) : null}
          {canManage && !readOnly ? (
            <Button variant="secondary" size="sm" onClick={openSettings}>
              Calendar settings
            </Button>
          ) : null}
        </div>
      </div>

      {canManage && (pendingQ.data?.items.length ?? 0) > 0 ? (
        <section ref={pendingRef} className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <SectionHeader
            title="Pending leave requests"
            description="Approve or reject — working days update only after approval."
            action={
              <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-amber-900 dark:text-amber-100">
                {pendingQ.data!.items.length} pending
              </span>
            }
          />
          <ul className="mt-3 space-y-2">
            {pendingQ.data!.items.map((item) => {
              const displayStart =
                item.requestKind === "modification" && item.proposedStartDateIst
                  ? item.proposedStartDateIst
                  : item.startDateIst;
              const displayEnd =
                item.requestKind === "modification" && item.proposedEndDateIst
                  ? item.proposedEndDateIst
                  : item.endDateIst;
              const sameDay = displayStart === displayEnd;
              const rangeLabel = sameDay
                ? formatCalendarDate(displayStart)
                : `${formatCalendarDate(displayStart)} – ${formatCalendarDate(displayEnd)}`;
              const busy = decisionM.isPending || decideChangeM.isPending;
              return (
                <li key={`${item.requestKind}-${item.id}`} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-3 sm:px-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{item.agentName}</p>
                        <span className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {requestKindLabel(item.requestKind)}
                        </span>
                      </div>
                      <p className="text-sm tabular-nums text-muted-foreground">{rangeLabel}</p>
                      {item.requestKind === "modification" && item.originalStartDateIst ? (
                        <p className="text-xs text-muted-foreground">
                          Before: {formatCalendarDate(item.originalStartDateIst)}
                          {item.originalEndDateIst && item.originalEndDateIst !== item.originalStartDateIst
                            ? ` – ${formatCalendarDate(item.originalEndDateIst)}`
                            : ""}
                          {item.originalReason ? ` · ${item.originalReason}` : ""}
                        </p>
                      ) : null}
                      {item.requestKind === "modification" && item.proposedStartDateIst ? (
                        <p className="text-xs text-foreground">
                          After: {formatCalendarDate(item.proposedStartDateIst)}
                          {item.proposedEndDateIst && item.proposedEndDateIst !== item.proposedStartDateIst
                            ? ` – ${formatCalendarDate(item.proposedEndDateIst)}`
                            : ""}
                          {item.proposedReason ? ` · ${item.proposedReason}` : ""}
                        </p>
                      ) : null}
                      {item.requestKind === "cancellation" ? (
                        <p className="text-xs text-muted-foreground">
                          Cancel approved leave · {item.cancellationReason || item.reason}
                        </p>
                      ) : item.reason?.trim() ? (
                        <p className="text-sm leading-snug text-muted-foreground">{item.reason}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">No reason provided</p>
                      )}
                    </div>
                    {!readOnly ? (
                      <div className="flex shrink-0 flex-wrap gap-2 sm:pt-0.5">
                        <Button size="sm" variant="outline" className="min-w-[5.5rem]" disabled={busy} onClick={() => openReject(item)}>
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="min-w-[5.5rem]"
                          disabled={busy}
                          onClick={() => submitPendingDecision(item, "approved")}
                        >
                          Approve
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {(isTeamView ? teamCalendarQ.isLoading : calendarQ.isLoading) ? <LoadingBlock /> : null}
      {(isTeamView ? teamCalendarQ.isError : calendarQ.isError) ? (
        <ErrorBlock
          message={
            (isTeamView ? teamCalendarQ.error : calendarQ.error) instanceof Error
              ? (isTeamView ? teamCalendarQ.error : calendarQ.error)!.message
              : "Could not load calendar. You may not have permission to view this schedule."
          }
        />
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Legend color="border border-emerald-600/25 bg-emerald-500/15" label="Working" />
        <Legend color="border border-slate-400/35 bg-slate-200/80 dark:bg-slate-500/15" label="Weekly off" />
        <Legend color="border border-amber-500/25 bg-amber-500/12" label="Approved leave" />
        <Legend color="border border-dashed bg-background" label="Pending leave" />
        <Legend color="border border-rose-500/25 bg-rose-500/12" label="Company holiday" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <div className="grid min-w-[640px] grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
          {DOW_LABELS.map((d) => (
            <div key={d} className="px-2 py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid min-w-[640px] grid-cols-7">
          {gridDates.map((dateIst) => {
            const inMonth = dateIst.startsWith(monthPrefix);
            const teamDay = teamDayMap.get(dateIst);
            const agentDay = dayMap.get(dateIst);
            return (
              <button
                key={dateIst}
                type="button"
                disabled={!inMonth}
                className={cn(
                  "min-h-[80px] border-b border-r p-2 text-left text-sm transition hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  isTeamView
                    ? teamDay?.isHoliday
                      ? "bg-rose-500/10"
                      : inMonth
                        ? "bg-card"
                        : "bg-muted/20 text-muted-foreground"
                    : agentDayClasses(agentDay, calendarQ.data?.todayIst || "", inMonth, dateIst, focusDateIst),
                  !inMonth && "cursor-default",
                )}
                onClick={() => {
                  if (!inMonth) return;
                  setFocusDateIst(dateIst);
                  setLeaveStart(dateIst);
                  setLeaveEnd(dateIst);
                  setDayDialogOpen(true);
                }}
              >
                <span className="font-medium tabular-nums">{Number(dateIst.slice(8, 10))}</span>
                {inMonth && isTeamView && teamDay ? (
                  <div className="mt-1 space-y-0.5 text-[10px] leading-tight text-muted-foreground">
                    {teamDay.isHoliday ? <p className="line-clamp-2 text-rose-800 dark:text-rose-200">{teamDay.holidayName}</p> : null}
                    {!teamDay.isHoliday ? (
                      <>
                        <p>{teamDay.working} working</p>
                        {teamDay.onApprovedLeave > 0 ? <p>{teamDay.onApprovedLeave} on leave</p> : null}
                        {teamDay.weeklyOff > 0 ? <p>{teamDay.weeklyOff} weekly off</p> : null}
                        {teamDay.pendingLeave > 0 ? <p>{teamDay.pendingLeave} pending</p> : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
                {inMonth && !isTeamView && agentDay ? (
                  <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                    {agentDay.isHoliday ? holidayMap.get(dateIst) || "Holiday" : agentDay.leaveKind.replace(/_/g, " ")}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="max-w-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{focusDateIst ? formatCalendarDate(focusDateIst) : "Day"}</DialogTitle>
          </DialogHeader>

          {isTeamView && focusDateIst && teamDayMap.get(focusDateIst) ? (
            <TeamDayBreakdown
              day={teamDayMap.get(focusDateIst)!}
              agents={teamAvailQ.data?.agents}
              loading={teamAvailQ.isLoading}
            />
          ) : null}

          {!isTeamView && focusDateIst && dayMap.get(focusDateIst) ? (
            <p className="text-sm text-muted-foreground capitalize">{dayMap.get(focusDateIst)!.leaveKind.replace(/_/g, " ")}</p>
          ) : null}

          {pendingOnDate.length > 0 && canManage && !readOnly ? (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/15 p-3">
              <p className="text-sm font-medium">Pending approval on this date</p>
              {pendingOnDate.map((p) => (
                <div key={`${p.requestKind}-${p.id}`} className="space-y-2 border-t border-border/40 pt-2 first:border-0 first:pt-0">
                  <p className="text-sm">
                    <span className="font-medium">{p.agentName}</span>
                    <span className="ml-2 text-xs uppercase text-muted-foreground">{requestKindLabel(p.requestKind)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{p.reason || p.cancellationReason}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openReject(p)}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => submitPendingDecision(p, "approved")}>
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!readOnly && focusDateIst && !isTeamView && calendarQ.data ? (
            <AgentDayLeavePanel
              focusDateIst={focusDateIst}
              leaves={calendarQ.data.leave}
              changeRequests={calendarQ.data.leaveChangeRequests ?? []}
              canRequestLeave={calendarQ.data.canRequestLeave}
              readOnly={readOnly}
              agentDisplayName={viewedAgentName}
              canAdminCancel={canManageLeaveOnCalendar}
              canAllowCancellationRetry={canManageLeaveOnCalendar}
              onSubmitNewLeave={(body) => requestLeaveM.mutate(body)}
              newLeavePending={requestLeaveM.isPending}
              onSubmitModification={(leaveId, body) => modificationLeaveM.mutate({ leaveId, ...body })}
              modificationPending={modificationLeaveM.isPending}
              onSubmitCancellation={(leaveId, reason) => cancellationLeaveM.mutate({ leaveId, reason })}
              cancellationPending={cancellationLeaveM.isPending}
              onAdminCancel={(leaveId, reason) => adminCancelLeaveM.mutate({ leaveId, reason })}
              adminCancelPending={adminCancelLeaveM.isPending}
              onAllowCancellationRetry={(leaveId) => allowCancellationRetryM.mutate(leaveId)}
              allowRetryPending={allowCancellationRetryM.isPending}
            />
          ) : null}

          {!readOnly && focusDateIst && !isTeamView && canManage ? (
            <form
              className="space-y-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                recordLeaveM.mutate({
                  agentId: individualAgentId,
                  startDateIst: leaveStart,
                  endDateIst: leaveEnd,
                  reason: leaveReason,
                });
              }}
            >
              <SectionHeader title="Record approved leave" description="Supervisor/Admin direct entry." />
              <Label>Start</Label>
              <IstDatePicker value={leaveStart} onChange={setLeaveStart} aria-label="Leave start date" required />
              <Label>End</Label>
              <IstDatePicker value={leaveEnd} onChange={setLeaveEnd} aria-label="Leave end date" required />
              <Label>Reason (optional)</Label>
              <Input value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} />
              <Button type="submit" variant="secondary" disabled={recordLeaveM.isPending}>
                Save approved leave
              </Button>
            </form>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDayDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">A reason is required so the agent knows why this was rejected.</p>
          <Label htmlFor="leave-reject-reason">Reason</Label>
          <Textarea
            id="leave-reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            minLength={3}
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={rejectReason.trim().length < 3 || !rejectTarget || decisionM.isPending || decideChangeM.isPending}
              onClick={() => {
                if (!rejectTarget) return;
                submitPendingDecision(rejectTarget, "rejected", rejectReason.trim());
              }}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Jump to month</DialogTitle>
          </DialogHeader>
          <MonthYearPicker value={month} onChange={setMonth} onClose={() => setMonthPickerOpen(false)} />
        </DialogContent>
      </Dialog>

      {canManage ? (
        <CalendarSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          agents={agents}
          scheduleAgentId={scheduleAgentId}
          onScheduleAgentChange={setScheduleAgentId}
          weeklyOffs={scheduleQ.data?.weeklyOffs ?? []}
          shifts={scheduleQ.data?.shifts ?? []}
          rangeFrom={start}
          rangeTo={end}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-3 w-3 rounded-sm", color)} /> {label}
    </span>
  );
}

function TeamDayBreakdown({
  day,
  agents,
  loading,
}: {
  day: TeamDay;
  agents?: { agentId: string; name: string; status: string; shiftDisplay: string | null }[];
  loading?: boolean;
}) {
  if (day.isHoliday) {
    return <p className="text-sm text-muted-foreground">Company holiday · {day.holidayName}</p>;
  }
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-2 text-xs">
        {(["working", "weekly_off", "leave", "pending_leave", "holiday"] as const).map((s) => {
          const count = agents?.filter((a) => a.status === s).length ?? 0;
          if (!count) return null;
          return (
            <span key={s} className={cn("rounded-full border px-2.5 py-0.5 capitalize", statusBadgeClass(s))}>
              {statusLabel(s)} · {count}
            </span>
          );
        })}
      </div>
      <p className="text-muted-foreground">
        {day.working} working · {day.onApprovedLeave} on approved leave · {day.weeklyOff} weekly off
        {day.pendingLeave ? ` · ${day.pendingLeave} pending request(s)` : ""}
      </p>
      {loading ? <LoadingBlock /> : null}
      {agents?.length ? (
        <ul className="max-h-[min(360px,50vh)] divide-y overflow-y-auto rounded-lg border bg-card/80">
          {agents.map((a) => (
            <li key={a.agentId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-[8rem] font-medium leading-snug">{a.name}</span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {a.shiftDisplay ? <span className="text-xs text-muted-foreground">{a.shiftDisplay}</span> : null}
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs capitalize", statusBadgeClass(a.status))}>
                  {statusLabel(a.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p className="text-xs text-muted-foreground">No agent availability data for this date.</p>
      ) : null}
    </div>
  );
}
