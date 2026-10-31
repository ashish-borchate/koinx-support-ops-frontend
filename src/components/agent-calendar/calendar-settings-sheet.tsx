import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { DOW_FULL } from "@/components/agent-calendar/constants";
import { Button } from "@/components/ui/button";
import { IstDatePicker } from "@/components/ui/ist-date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { formatCalendarDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Agent = { id: string; name: string };

type Holiday = { id: string; dateIst: string; name: string };

const WEEKDAY_PICKERS: { label: string; dow: number }[] = [
  { label: "Mon", dow: 1 },
  { label: "Tue", dow: 2 },
  { label: "Wed", dow: 3 },
  { label: "Thu", dow: 4 },
  { label: "Fri", dow: 5 },
  { label: "Sat", dow: 6 },
  { label: "Sun", dow: 0 },
];

const TAB_TRIGGER_CLASS =
  "h-10 flex-1 rounded-lg border border-border bg-muted/40 px-2 text-sm whitespace-nowrap shadow-none transition-colors after:!hidden after:!content-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:!border-primary data-[state=active]:!bg-primary/10 data-[state=active]:font-semibold data-[state=active]:!text-foreground data-[state=active]:!shadow-none dark:data-[state=active]:!border-primary dark:data-[state=active]:!bg-primary/10 sm:px-3";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  scheduleAgentId: string;
  onScheduleAgentChange: (id: string) => void;
  weeklyOffs: { effectiveFromIst: string; dayOfWeek: number; note: string }[];
  shifts: { effectiveFromIst: string; startTimeIst: string; endTimeIst: string; name: string }[];
  rangeFrom: string;
  rangeTo: string;
  readOnly: boolean;
};

function latestEffectiveBucket<T extends { effectiveFromIst: string }>(rows: T[]): T[] {
  if (!rows.length) return [];
  const max = rows.reduce((m, r) => (r.effectiveFromIst > m ? r.effectiveFromIst : m), rows[0].effectiveFromIst);
  return rows.filter((r) => r.effectiveFromIst === max);
}

function formatIstTime12(time24: string) {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatShiftSummary(start: string, end: string, name?: string) {
  const overnight = start > end;
  const core = `${formatIstTime12(start)}–${formatIstTime12(end)} IST${overnight ? " (overnight)" : ""}`;
  return name?.trim() ? `${core} · ${name.trim()}` : core;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SummaryBlock({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 text-sm">{children}</div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function CalendarSettingsSheet({
  open,
  onOpenChange,
  agents,
  scheduleAgentId,
  onScheduleAgentChange,
  weeklyOffs,
  shifts,
  rangeFrom,
  rangeTo,
  readOnly,
}: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState("weekly-off");
  const [weeklyEditing, setWeeklyEditing] = useState(false);
  const [shiftEditing, setShiftEditing] = useState(false);
  const [holidaysEditing, setHolidaysEditing] = useState(false);

  const [offFrom, setOffFrom] = useState("");
  const [offDays, setOffDays] = useState<number[]>([]);
  const [shiftFrom, setShiftFrom] = useState("");
  const [shiftStart, setShiftStart] = useState("10:00");
  const [shiftEnd, setShiftEnd] = useState("19:00");
  const [shiftName, setShiftName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [editingHolidayDate, setEditingHolidayDate] = useState<string | null>(null);

  const activeWeekly = useMemo(() => latestEffectiveBucket(weeklyOffs), [weeklyOffs]);
  const activeShift = useMemo(() => latestEffectiveBucket(shifts)[0] ?? null, [shifts]);

  const scheduleTab = tab === "weekly-off" || tab === "shift";

  useEffect(() => {
    if (!open) {
      setWeeklyEditing(false);
      setShiftEditing(false);
      setHolidaysEditing(false);
      resetWeeklyForm();
      resetShiftForm();
      resetHolidayForm();
    }
  }, [open]);

  useEffect(() => {
    setWeeklyEditing(false);
    resetWeeklyForm();
    setShiftEditing(false);
    resetShiftForm();
  }, [scheduleAgentId]);

  const holidaysQ = useQuery({
    queryKey: ["agent-calendar-holidays", rangeFrom, rangeTo],
    queryFn: () => api<{ holidays: Holiday[] }>(`/api/agent-calendar/holidays?from=${rangeFrom}&to=${rangeTo}`),
    enabled: open,
  });

  const holidays = useMemo(
    () => [...(holidaysQ.data?.holidays ?? [])].sort((a, b) => a.dateIst.localeCompare(b.dateIst)),
    [holidaysQ.data],
  );

  function resetWeeklyForm() {
    setOffFrom("");
    setOffDays([]);
  }

  function resetShiftForm() {
    setShiftFrom("");
    setShiftStart("10:00");
    setShiftEnd("19:00");
    setShiftName("");
  }

  function resetHolidayForm() {
    setHolidayDate("");
    setHolidayName("");
    setEditingHolidayDate(null);
  }

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ["agent-calendar"] });
    void qc.invalidateQueries({ queryKey: ["team-calendar"] });
    void qc.invalidateQueries({ queryKey: ["agent-calendar-holidays"] });
  };

  const weeklyM = useMutation({
    mutationFn: () =>
      api(`/api/agent-calendar/agents/${scheduleAgentId}/weekly-offs`, {
        method: "POST",
        body: JSON.stringify({ effectiveFromIst: offFrom, daysOfWeek: offDays }),
      }),
    onSuccess: () => {
      toast.success("Weekly off saved");
      invalidateAll();
      setWeeklyEditing(false);
      resetWeeklyForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shiftM = useMutation({
    mutationFn: () =>
      api(`/api/agent-calendar/agents/${scheduleAgentId}/shifts`, {
        method: "POST",
        body: JSON.stringify({
          effectiveFromIst: shiftFrom,
          startTimeIst: shiftStart,
          endTimeIst: shiftEnd,
          name: shiftName,
        }),
      }),
    onSuccess: () => {
      toast.success("Working shift saved");
      invalidateAll();
      setShiftEditing(false);
      resetShiftForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const holidayM = useMutation({
    mutationFn: () => api(`/api/agent-calendar/holidays`, { method: "PUT", body: JSON.stringify({ dateIst: holidayDate, name: holidayName }) }),
    onSuccess: () => {
      toast.success(editingHolidayDate ? "Holiday updated" : "Holiday added");
      resetHolidayForm();
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteHolidayM = useMutation({
    mutationFn: (dateIst: string) => api(`/api/agent-calendar/holidays/${dateIst}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Holiday removed");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleOffDay(dow: number) {
    setOffDays((prev) => (prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]));
  }

  function startEditHoliday(h: Holiday) {
    setEditingHolidayDate(h.dateIst);
    setHolidayDate(h.dateIst);
    setHolidayName(h.name);
    setHolidaysEditing(true);
  }

  const weeklyValid = Boolean(offFrom && offDays.length);
  const shiftValid = Boolean(shiftFrom && shiftStart && shiftEnd);
  const holidayValid = Boolean(holidayDate && holidayName.trim().length >= 2);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-[100vw] flex-col gap-0 p-0 sm:!max-w-2xl" showCloseButton>
        <SheetHeader className="shrink-0 space-y-2 border-b px-6 pb-4 pt-6 pr-14 text-left">
          <SheetTitle className="text-lg">Calendar settings</SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            Manage weekly offs, shifts, and company holidays (IST).
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="shrink-0 px-6 pb-4 pt-4">
            <TabsList variant="line" className="flex h-auto w-full gap-2 border-0 bg-transparent p-0 shadow-none">
              <TabsTrigger value="weekly-off" className={TAB_TRIGGER_CLASS}>
                Weekly off
              </TabsTrigger>
              <TabsTrigger value="shift" className={TAB_TRIGGER_CLASS}>
                Working shift
              </TabsTrigger>
              <TabsTrigger value="holidays" className={TAB_TRIGGER_CLASS}>
                Company holidays
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-t px-6 py-5">
            {scheduleTab ? (
              <Field label="Agent" className="mb-4">
                <Select value={scheduleAgentId} onValueChange={onScheduleAgentChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            <TabsContent value="weekly-off" className="mt-0 space-y-4 focus-visible:outline-none">
              {!weeklyEditing ? (
                <SummaryBlock
                  actions={
                    !readOnly ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => setWeeklyEditing(true)}>
                        {activeWeekly.length ? "Edit Details" : "Configure"}
                      </Button>
                    ) : null
                  }
                >
                  {activeWeekly.length ? (
                    <>
                      <p className="font-medium text-foreground">
                        Current weekly off — {activeWeekly.map((r) => DOW_FULL[r.dayOfWeek]).join(", ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Effective from {formatCalendarDate(activeWeekly[0].effectiveFromIst)}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No weekly off configured for this agent.</p>
                  )}
                </SummaryBlock>
              ) : (
                <form
                  className="space-y-4 rounded-lg border bg-card p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (readOnly || !weeklyValid) return;
                    weeklyM.mutate();
                  }}
                >
                  <Field label="Effective from">
                    <IstDatePicker value={offFrom} onChange={setOffFrom} disabled={readOnly} required aria-label="Weekly off effective from" />
                  </Field>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Weekly off days</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_PICKERS.map(({ label, dow }) => (
                        <Button
                          key={dow}
                          type="button"
                          size="sm"
                          variant={offDays.includes(dow) ? "default" : "outline"}
                          className="h-8 min-w-[2.75rem] px-2"
                          disabled={readOnly}
                          aria-pressed={offDays.includes(dow)}
                          onClick={() => toggleOffDay(dow)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={readOnly || weeklyM.isPending || !weeklyValid}>
                      {weeklyM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setWeeklyEditing(false);
                        resetWeeklyForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>

            <TabsContent value="shift" className="mt-0 space-y-4 focus-visible:outline-none">
              {!shiftEditing ? (
                <SummaryBlock
                  actions={
                    !readOnly ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => setShiftEditing(true)}>
                        {activeShift ? "Edit Details" : "Configure"}
                      </Button>
                    ) : null
                  }
                >
                  {activeShift ? (
                    <>
                      <p className="font-medium text-foreground">
                        Current shift — {formatShiftSummary(activeShift.startTimeIst, activeShift.endTimeIst, activeShift.name)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Effective from {formatCalendarDate(activeShift.effectiveFromIst)}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No shift configured for this agent.</p>
                  )}
                </SummaryBlock>
              ) : (
                <form
                  className="space-y-4 rounded-lg border bg-card p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (readOnly || !shiftValid) return;
                    shiftM.mutate();
                  }}
                >
                  <Field label="Effective from">
                    <IstDatePicker value={shiftFrom} onChange={setShiftFrom} disabled={readOnly} required aria-label="Shift effective from" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start (IST)">
                      <Input type="time" className="h-9" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} disabled={readOnly} required />
                    </Field>
                    <Field label="End (IST)">
                      <Input type="time" className="h-9" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} disabled={readOnly} required />
                    </Field>
                  </div>
                  <Field label="Shift name (optional)">
                    <Input className="h-9" placeholder="Morning, General, Evening…" value={shiftName} onChange={(e) => setShiftName(e.target.value)} disabled={readOnly} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={readOnly || shiftM.isPending || !shiftValid}>
                      {shiftM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShiftEditing(false);
                        resetShiftForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>

            <TabsContent value="holidays" className="mt-0 space-y-4 focus-visible:outline-none">
              {!holidaysEditing ? (
                <SummaryBlock
                  actions={
                    !readOnly ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => setHolidaysEditing(true)}>
                        {holidays.length ? "Edit Details" : "Configure"}
                      </Button>
                    ) : null
                  }
                >
                  <p className="font-medium text-foreground">
                    {holidays.length
                      ? `${holidays.length} company holiday${holidays.length === 1 ? "" : "s"} in view`
                      : "No company holidays in this calendar range"}
                  </p>
                  {holidays.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {holidays.slice(0, 4).map((h) => (
                        <li key={h.dateIst}>
                          {formatCalendarDate(h.dateIst)} · {h.name}
                        </li>
                      ))}
                      {holidays.length > 4 ? <li>+{holidays.length - 4} more</li> : null}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Range: {formatCalendarDate(rangeFrom)} – {formatCalendarDate(rangeTo)}
                  </p>
                </SummaryBlock>
              ) : (
                <div className="space-y-4">
                  {holidaysQ.isLoading ? (
                    <p className="text-sm text-muted-foreground">Loading holidays…</p>
                  ) : holidays.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-4 py-4 text-center text-sm text-muted-foreground">
                      No company holidays in this period.
                    </p>
                  ) : (
                    <ul className="divide-y rounded-lg border text-sm">
                      {holidays.map((h) => (
                        <li key={h.dateIst} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                          <div>
                            <p className="font-medium">{h.name}</p>
                            <p className="text-xs text-muted-foreground">{formatCalendarDate(h.dateIst)}</p>
                          </div>
                          {!readOnly ? (
                            <div className="flex gap-1">
                              <Button type="button" size="sm" variant="ghost" onClick={() => startEditHoliday(h)}>
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                disabled={deleteHolidayM.isPending}
                                onClick={() => deleteHolidayM.mutate(h.dateIst)}
                              >
                                Remove
                              </Button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}

                  {!readOnly ? (
                    <form
                      className="space-y-4 rounded-lg border bg-card p-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!holidayValid) return;
                        holidayM.mutate();
                      }}
                    >
                      <p className="text-sm font-medium">{editingHolidayDate ? "Update holiday" : "Add holiday"}</p>
                      <Field label="Date">
                        <IstDatePicker
                          value={holidayDate}
                          onChange={setHolidayDate}
                          disabled={Boolean(editingHolidayDate) || readOnly}
                          required
                          aria-label="Holiday date"
                        />
                      </Field>
                      <Field label="Name">
                        <Input className="h-9" value={holidayName} onChange={(e) => setHolidayName(e.target.value)} required minLength={2} />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={holidayM.isPending || !holidayValid}>
                          {holidayM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {editingHolidayDate ? "Save changes" : "Add holiday"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setHolidaysEditing(false);
                            resetHolidayForm();
                          }}
                        >
                          Done
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
