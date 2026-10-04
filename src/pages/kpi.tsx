import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorBlock, LoadingBlock, PageHeader, SourceBadge } from "@/components/bits";
import { api, download } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatNumber, formatWeek, recentWeeks, type Metric } from "@/lib/format";

type RecordRow = {
  id: string;
  agentName: string;
  weekStart: string;
  ticketsHandled: Metric;
  firstResponseHours: Metric;
  resolutionHours: Metric;
  csatPercent: Metric;
  slaPercent: Metric;
  reopened: Metric;
  coachingHours: Metric;
  scheduleAdherencePercent: Metric;
  notes: string;
};

const automated = [
  ["ticketsHandled", "Tickets"],
  ["firstResponseHours", "FRT hours"],
  ["resolutionHours", "Resolution hours"],
  ["csatPercent", "CSAT"],
  ["slaPercent", "SLA"],
  ["reopened", "Reopened"],
] as const;

export function KpiPage() {
  const { can, canMutate } = useAuth();
  const [week, setWeek] = useState(recentWeeks()[0]);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const query = useQuery({
    queryKey: ["kpi", week],
    queryFn: () => api<{ label: string; partial: boolean; goals: Record<string, number>; records: RecordRow[] }>(`/api/kpi?week=${week}`),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Performance"
        title="KPI"
        action={
          <div className="flex gap-2">
            {can("kpi.view_team") ? (
              <Button variant="outline" onClick={() => download(`/api/kpi/export?week=${week}`, `kpi-${week}.csv`).catch((error) => toast.error(error.message))}>
                Export CSV
              </Button>
            ) : null}
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {recentWeeks().map((item) => <SelectItem key={item} value={item}>{formatWeek(item)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />
      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? <ErrorBlock message={query.error.message} /> : null}
      {query.data ? (
        <div className="space-y-4">
          {query.data.partial ? <p className="text-sm text-muted-foreground">This week is still open. Freshdesk numbers will keep moving until Monday.</p> : null}
          {can("kpi.view_team") ? (
            <Card>
              <CardHeader><CardTitle>SLA against the {query.data.goals.slaPercent}% goal</CardTitle></CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={query.data.records.map((row) => ({ name: row.agentName.split(" ")[0], sla: row.slaPercent.value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[70, 100]} />
                    <Tooltip />
                    <ReferenceLine y={query.data.goals.slaPercent} stroke="oklch(0.72 0.13 85)" />
                    <Bar dataKey="sla" fill="oklch(0.45 0.09 158)" radius={6} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : null}
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  {automated.map(([, label]) => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}
                  <th className="px-3 py-3 font-medium">Coaching</th>
                </tr>
              </thead>
              <tbody>
                {query.data.records.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-4 py-3">
                      {canMutate("kpi.edit") ? (
                        <button className="font-medium hover:underline" onClick={() => setEditing(row)}>{row.agentName}</button>
                      ) : row.agentName}
                    </td>
                    {automated.map(([key]) => (
                      <td key={key} className="px-3 py-3">
                        <div>{formatNumber(row[key].value, key === "ticketsHandled" || key === "reopened" ? 0 : 1)}</div>
                        <SourceBadge metric={row[key]} />
                      </td>
                    ))}
                    <td className="px-3 py-3">
                      <div>{formatNumber(row.coachingHours.value, 1)}h</div>
                      <SourceBadge metric={row.coachingHours} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {query.data.records.length === 0 ? <p className="px-4 py-8 text-sm text-muted-foreground">No KPI rows for this week.</p> : null}
          </div>
        </div>
      ) : null}
      {editing ? <KpiEditor record={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function KpiEditor({ record, onClose }: { record: RecordRow; onClose: () => void }) {
  const client = useQueryClient();
  const [coachingHours, setCoachingHours] = useState(String(record.coachingHours.value ?? ""));
  const [adherence, setAdherence] = useState(String(record.scheduleAdherencePercent.value ?? ""));
  const [notes, setNotes] = useState(record.notes);
  const [overrides, setOverrides] = useState<Record<string, string>>(() =>
    Object.fromEntries(automated.filter(([key]) => record[key].source === "admin").map(([key]) => [key, String(record[key].value ?? "")])),
  );
  const save = useMutation({
    mutationFn: () => {
      const revert = automated.map(([key]) => key).filter((key) => record[key].source === "admin" && overrides[key] == null);
      const overridePayload = Object.fromEntries(
        Object.entries(overrides).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]),
      );
      return api(`/api/kpi/${record.id}`, {
        method: "PUT",
        body: JSON.stringify({
          coachingHours: coachingHours === "" ? null : Number(coachingHours),
          scheduleAdherencePercent: adherence === "" ? null : Number(adherence),
          notes,
          overrides: overridePayload,
          revert,
        }),
      });
    },
    onSuccess: () => {
      toast.success("KPI saved");
      void client.invalidateQueries({ queryKey: ["kpi"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{record.agentName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Manual fields save as people input. Automated fields stay Freshdesk-owned unless you explicitly override them.</p>
        <div className="grid gap-3">
          <Label>Coaching hours</Label>
          <Input value={coachingHours} onChange={(event) => setCoachingHours(event.target.value)} />
          <Label>Schedule adherence %</Label>
          <Input value={adherence} onChange={(event) => setAdherence(event.target.value)} />
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <div className="space-y-3">
          {automated.map(([key, label]) => (
            <div key={key} className="rounded-xl border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">{label}: {formatNumber(record[key].freshdeskValue ?? record[key].value, 1)}</span>
                <SourceBadge metric={record[key]} />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={overrides[key] != null}
                  onChange={(event) => {
                    setOverrides((current) => {
                      const next = { ...current };
                      if (event.target.checked) next[key] = String(record[key].value ?? "");
                      else delete next[key];
                      return next;
                    });
                  }}
                />
                Override Freshdesk value
              </label>
              {overrides[key] != null ? (
                <Input className="mt-2" value={overrides[key]} onChange={(event) => setOverrides((current) => ({ ...current, [key]: event.target.value }))} />
              ) : null}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
