import { NavLink, Outlet, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";

type MigrationRow = {
  id: string;
  migrationDate: string;
  oldCoin: string;
  newCoin: string;
  ratio: string;
  informedTech: boolean;
  acknowledgedByTech: boolean;
  actions?: { edit: boolean; acknowledge: boolean };
};

function TmLayout() {
  const { can } = useAuth();
  const links = [
    { to: "/token-migration/dashboard", label: "Dashboard", any: ["token_migration.dashboard"] },
    { to: "/token-migration/tracker", label: "Tracker", any: ["token_migration.tracker"] },
  ].filter((l) => can(...l.any));
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Support Operations" title="Token Migration" />
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm ${isActive ? "bg-blue-50 font-medium text-blue-800" : "text-slate-600 hover:bg-slate-50"}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

function YesNoPill({ value, yesLabel = "Yes", noLabel = "No" }: { value: boolean; yesLabel?: string; noLabel?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${value ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
      {value ? yesLabel : noLabel}
    </span>
  );
}

export function TokenMigrationRoutes() {
  return (
    <Routes>
      <Route element={<TmLayout />}>
        <Route path="dashboard" element={<TmDashboardPage />} />
        <Route path="tracker" element={<TmTrackerPage />} />
        <Route index element={<TmDashboardPage />} />
      </Route>
    </Routes>
  );
}

export function TmDashboardPage() {
  const navigate = useNavigate();
  const { canMutate } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const dash = useQuery({
    queryKey: ["tm-dashboard"],
    queryFn: () =>
      api<{
        cards: { total: number; techNotInformed: number; awaitingAck: number; techAcknowledged: number };
        recent: MigrationRow[];
      }>("/api/token-migration/dashboard"),
  });

  if (dash.isLoading) return <LoadingBlock />;
  if (dash.isError) return <ErrorBlock message={dash.error.message} />;
  const { cards, recent } = dash.data!;

  return (
    <div className="space-y-6">
      {canMutate("token_migration.manage") ? (
        <Button type="button" onClick={() => setAddOpen(true)}>
          + Add Migration
        </Button>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CardLink label="Total Migrations" value={cards.total} onClick={() => navigate("/token-migration/tracker")} />
        <CardLink label="Tech Not Informed" value={cards.techNotInformed} onClick={() => navigate("/token-migration/tracker?informed=no")} />
        <CardLink label="Awaiting Tech Acknowledgement" value={cards.awaitingAck} onClick={() => navigate("/token-migration/tracker?ack=pending")} />
        <CardLink label="Tech Acknowledged" value={cards.techAcknowledged} onClick={() => navigate("/token-migration/tracker?ack=yes")} />
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent migrations</h2>
        {recent.length === 0 ? (
          <Empty title="No token migrations yet." body="Add a migration to start tracking token conversions." />
        ) : (
          <div className="divide-y rounded-2xl border border-slate-200 bg-white">
            {recent.map((row) => (
              <button
                key={row.id}
                type="button"
                className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
                onClick={() => navigate(`/token-migration/tracker?id=${row.id}`)}
              >
                <span className="font-medium text-slate-900">
                  {row.oldCoin} → {row.newCoin}
                </span>
                <span className="text-xs text-slate-500">
                  {row.migrationDate} · {row.ratio}
                </span>
                <span className="text-xs text-slate-600">
                  {row.acknowledgedByTech ? "✓ Acknowledged" : row.informedTech ? "Awaiting Tech" : "Not informed"}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
      <MigrationFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function CardLink({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="hover:border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold text-slate-900">{value}</CardContent>
      </Card>
    </button>
  );
}

export function TmTrackerPage() {
  const { canMutate } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [detailId, setDetailId] = useState<string | null>(searchParams.get("id"));
  const [addOpen, setAddOpen] = useState(false);

  const setFilter = (key: string, value: string) => {
    const p = new URLSearchParams(searchParams);
    if (value && value !== "all") p.set(key, value);
    else p.delete(key);
    setSearchParams(p, { replace: true });
  };

  const queryString = useMemo(() => {
    const p = new URLSearchParams(searchParams);
    if (q) p.set("q", q);
    else p.delete("q");
    return p.toString();
  }, [searchParams, q]);

  useEffect(() => {
    const p = new URLSearchParams(queryString);
    if (detailId) p.set("id", detailId);
    setSearchParams(p, { replace: true });
  }, [queryString, detailId, setSearchParams]);

  const list = useQuery({
    queryKey: ["tm-list", queryString],
    queryFn: () => api<{ items: MigrationRow[] }>(`/api/token-migration?${queryString}`),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search coins, ratio, date" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Input
          placeholder="Old coin"
          defaultValue={searchParams.get("oldCoin") || ""}
          onBlur={(e) => setFilter("oldCoin", e.target.value.trim())}
          className="w-28"
        />
        <Input
          placeholder="New coin"
          defaultValue={searchParams.get("newCoin") || ""}
          onBlur={(e) => setFilter("newCoin", e.target.value.trim())}
          className="w-28"
        />
        <Select value={searchParams.get("informed") || "all"} onValueChange={(v) => setFilter("informed", v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Informed Tech" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Informed Tech?</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
        <Select value={searchParams.get("ack") || "all"} onValueChange={(v) => setFilter("ack", v)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Acknowledgement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Acknowledged</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
          </SelectContent>
        </Select>
        {canMutate("token_migration.manage") ? (
          <Button type="button" onClick={() => setAddOpen(true)}>
            + Add Migration
          </Button>
        ) : null}
      </div>
      {list.isLoading ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {list.data?.items.length === 0 ? (
        <Empty title="No token migrations yet." body="Add a migration to start tracking token conversions." />
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Migration Date</th>
              <th className="px-3 py-3 font-medium">Old Coin</th>
              <th className="px-3 py-3 font-medium">New Coin</th>
              <th className="px-3 py-3 font-medium">Ratio</th>
              <th className="px-3 py-3 font-medium">Informed Tech?</th>
              <th className="px-3 py-3 font-medium">Acknowledged by Tech</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">{row.migrationDate}</td>
                <td className="px-3 py-3">{row.oldCoin}</td>
                <td className="px-3 py-3">{row.newCoin}</td>
                <td className="px-3 py-3">{row.ratio}</td>
                <td className="px-3 py-3">
                  <YesNoPill value={row.informedTech} />
                </td>
                <td className="px-3 py-3">
                  <button type="button" className="text-left" onClick={() => setDetailId(row.id)}>
                    <YesNoPill value={row.acknowledgedByTech} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MigrationFormDialog open={addOpen} onOpenChange={setAddOpen} />
      <MigrationDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function MigrationFormDialog({
  open,
  onOpenChange,
  editId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editId?: string;
  initial?: MigrationRow & { informedTech?: boolean };
}) {
  const client = useQueryClient();
  const [migrationDate, setMigrationDate] = useState("");
  const [oldCoin, setOldCoin] = useState("");
  const [newCoin, setNewCoin] = useState("");
  const [ratio, setRatio] = useState("");
  const [informedTech, setInformedTech] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setMigrationDate(initial?.migrationDate || "");
    setOldCoin(initial?.oldCoin || "");
    setNewCoin(initial?.newCoin || "");
    setRatio(initial?.ratio || "");
    setInformedTech(Boolean(initial?.informedTech));
    setDuplicateMsg("");
  }, [open, initial]);

  const save = useMutation({
    mutationFn: (confirmDuplicate: boolean) => {
      const body = {
        migrationDate,
        oldCoin,
        newCoin,
        ratio,
        ...(editId ? { informedTech } : {}),
        confirmDuplicate,
      };
      if (editId) return api(`/api/token-migration/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
      return api("/api/token-migration", { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: () => {
      toast.success(editId ? "Migration updated" : "Migration added");
      onOpenChange(false);
      void client.invalidateQueries({ queryKey: ["tm-list"] });
      void client.invalidateQueries({ queryKey: ["tm-dashboard"] });
      void client.invalidateQueries({ queryKey: ["tm-detail"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      if (err.message.includes("already exists")) {
        setDuplicateMsg(err.message);
        return;
      }
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit migration" : "Add migration"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Migration Date</Label>
            <Input type="date" value={migrationDate} onChange={(e) => setMigrationDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Old Coin</Label>
              <Input value={oldCoin} onChange={(e) => setOldCoin(e.target.value)} placeholder="LEND" required />
            </div>
            <div>
              <Label>New Coin</Label>
              <Input value={newCoin} onChange={(e) => setNewCoin(e.target.value)} placeholder="AAVE" required />
            </div>
          </div>
          <div>
            <Label>Ratio</Label>
            <Input value={ratio} onChange={(e) => setRatio(e.target.value)} placeholder="100:1" required />
          </div>
          {editId ? (
            <div>
              <Label>Informed Tech?</Label>
              <Select value={informedTech ? "yes" : "no"} onValueChange={(v) => setInformedTech(v === "yes")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {duplicateMsg ? <p className="text-sm text-amber-800">{duplicateMsg}</p> : null}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {duplicateMsg ? (
            <Button type="button" onClick={() => save.mutate(true)} disabled={save.isPending}>
              Save anyway
            </Button>
          ) : (
            <Button type="button" onClick={() => save.mutate(false)} disabled={save.isPending}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MigrationDetailDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["tm-detail", id],
    queryFn: () =>
      api<{
        item: MigrationRow;
        activity: { id: string; summary: string; actorName: string; createdAt: string }[];
      }>(`/api/token-migration/${id}`),
    enabled: Boolean(id),
  });

  const acknowledge = useMutation({
    mutationFn: () => api(`/api/token-migration/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Migration acknowledged");
      void client.invalidateQueries({ queryKey: ["tm-detail", id] });
      void client.invalidateQueries({ queryKey: ["tm-list"] });
      void client.invalidateQueries({ queryKey: ["tm-dashboard"] });
      void client.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const item = detail.data?.item;
  const activity = detail.data?.activity ?? [];

  return (
    <>
      <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-lg">
          {detail.isLoading || !item ? (
            <LoadingBlock />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {item.oldCoin} → {item.newCoin}
                </DialogTitle>
                <DialogDescription>
                  Migration date {item.migrationDate} · Ratio {item.ratio}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p>
                  Informed Tech: <YesNoPill value={item.informedTech} />
                </p>
                <p>
                  Acknowledged by Tech:{" "}
                  {item.acknowledgedByTech ? (
                    <span className="font-medium text-emerald-800">Yes ✓</span>
                  ) : (
                    <YesNoPill value={false} />
                  )}
                </p>
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-500">Activity</h3>
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {activity.length === 0 ? <li className="text-slate-500">No activity yet.</li> : null}
                    {activity.map((entry) => (
                      <li key={entry.id} className="rounded border border-slate-100 px-3 py-2">
                        {entry.summary}
                        <p className="text-xs text-slate-500">
                          {entry.actorName} · {formatWhen(entry.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Close
                </Button>
                <div className="flex gap-2">
                  {item.actions?.edit && canMutate("token_migration.manage") && !readOnly ? (
                    <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
                      Edit
                    </Button>
                  ) : null}
                  {item.actions?.acknowledge && !readOnly ? (
                    <Button type="button" onClick={() => acknowledge.mutate()} disabled={acknowledge.isPending}>
                      Acknowledge
                    </Button>
                  ) : null}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {item && editOpen ? (
        <MigrationFormDialog open={editOpen} onOpenChange={setEditOpen} editId={item.id} initial={item} />
      ) : null}
    </>
  );
}
