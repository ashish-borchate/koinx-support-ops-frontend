import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
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
import { Empty, ErrorBlock, FilterToolbar, LoadingBlock, ModuleSubnav, PageHeader } from "@/components/bits";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { moduleIndexSegment } from "@/lib/module-nav";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const { can, canMutate } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [addOpen, setAddOpen] = useState(false);
  const links = [
    { to: "/token-migration/dashboard", label: "Dashboard", any: ["token_migration.dashboard"] },
    { to: "/token-migration/tracker", label: "Tracker", any: ["token_migration.tracker"] },
  ].filter((l) => can(...l.any));

  const onTracker = location.pathname.includes("/token-migration/tracker");
  const hasFilters =
    onTracker &&
    Boolean(
      searchParams.get("q") ||
        searchParams.get("oldCoin") ||
        searchParams.get("newCoin") ||
        (searchParams.get("informed") && searchParams.get("informed") !== "all") ||
        (searchParams.get("ack") && searchParams.get("ack") !== "all"),
    );

  const resetFilters = () => {
    const id = searchParams.get("id");
    setSearchParams(id ? { id } : {}, { replace: true });
  };

  return (
    <div className="space-y-2">
      <PageHeader eyebrow="Support Operations" title="Token Migration" />
      <div className="flex flex-wrap items-center justify-between gap-3 [&_nav]:mb-0">
        <ModuleSubnav links={links.map((l) => ({ to: l.to, label: l.label }))} />
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {hasFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          ) : null}
          {canMutate("token_migration.manage") ? (
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              Add migration
            </Button>
          ) : null}
        </div>
      </div>
      <Outlet />
      <MigrationFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function YesNoPill({ value, yesLabel = "Yes", noLabel = "No" }: { value: boolean; yesLabel?: string; noLabel?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${value ? "bg-emerald-50 text-emerald-800" : "bg-muted text-foreground/90"}`}>
      {value ? yesLabel : noLabel}
    </span>
  );
}

function TechAckStatus({ row }: { row: Pick<MigrationRow, "informedTech" | "acknowledgedByTech"> }) {
  if (row.acknowledgedByTech) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
        Acknowledged
      </span>
    );
  }
  if (row.informedTech) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900">
        Pending
      </span>
    );
  }
  return <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">—</span>;
}

function RecentMigrationStatus({ row }: { row: MigrationRow }) {
  if (row.acknowledgedByTech) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
        Acknowledged
      </span>
    );
  }
  if (row.informedTech) {
    return (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
        Pending
      </span>
    );
  }
  return <span className="shrink-0 text-xs text-muted-foreground">Not informed</span>;
}

function TokenMigrationIndex() {
  const { can } = useAuth();
  const segment = moduleIndexSegment(can, "token_migration.dashboard", "token_migration.tracker");
  return <Navigate to={segment} replace />;
}

export function TokenMigrationRoutes() {
  return (
    <Routes>
      <Route element={<TmLayout />}>
        <Route path="dashboard" element={<TmDashboardPage />} />
        <Route path="tracker" element={<TmTrackerPage />} />
        <Route index element={<TokenMigrationIndex />} />
      </Route>
    </Routes>
  );
}

export function TmDashboardPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const hasDashboard = can("token_migration.dashboard");
  const dash = useQuery({
    queryKey: ["tm-dashboard"],
    enabled: hasDashboard,
    queryFn: () =>
      api<{
        cards: { total: number; techNotInformed: number; awaitingAck: number; techAcknowledged: number };
        recent: MigrationRow[];
      }>("/api/token-migration/dashboard"),
  });

  if (!hasDashboard) return <Navigate to="/token-migration/tracker" replace />;
  if (dash.isLoading) return <LoadingBlock />;
  if (dash.isError) return <ErrorBlock message={dash.error.message} />;
  const { cards, recent } = dash.data!;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CardLink label="Total Migrations" value={cards.total} onClick={() => navigate("/token-migration/tracker")} />
        <CardLink label="Tech Not Informed" value={cards.techNotInformed} onClick={() => navigate("/token-migration/tracker?informed=no")} />
        <CardLink label="Awaiting Tech Acknowledgement" value={cards.awaitingAck} onClick={() => navigate("/token-migration/tracker?ack=pending")} />
        <CardLink label="Acknowledged by Tech" value={cards.techAcknowledged} onClick={() => navigate("/token-migration/tracker?ack=yes")} />
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recent migrations</h2>
        {recent.length === 0 ? (
          <Empty title="No token migrations yet." body="Add a migration to start tracking token conversions." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] shadow-sm">
            <div
              className="hidden border-b border-border/60 px-5 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,1.4fr)] sm:gap-3"
              aria-hidden
            >
              <span>Migration</span>
              <span>Date</span>
              <span>Ratio</span>
              <span className="text-right">Status</span>
            </div>
            {recent.map((row, index) => (
              <button
                key={row.id}
                type="button"
                className={cn(
                  "grid w-full grid-cols-1 gap-1 px-5 py-3.5 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,1.4fr)] sm:items-center sm:gap-3",
                  index > 0 && "border-t border-border/60",
                )}
                onClick={() => navigate(`/token-migration/tracker?id=${row.id}`)}
              >
                <span className="min-w-0 truncate font-semibold text-foreground">
                  {row.oldCoin} → {row.newCoin}
                </span>
                <span className="text-sm text-foreground sm:text-xs sm:font-medium">{row.migrationDate}</span>
                <span className="text-sm text-muted-foreground sm:text-xs">{row.ratio}</span>
                <div className="sm:flex sm:justify-end">
                  <RecentMigrationStatus row={row} />
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CardLink({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="hover:border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold text-foreground">{value}</CardContent>
      </Card>
    </button>
  );
}

export function TmTrackerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [detailId, setDetailId] = useState<string | null>(searchParams.get("id"));

  useEffect(() => {
    setQ(searchParams.get("q") || "");
  }, [searchParams]);

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
      <FilterToolbar
        search={
          <Input
            placeholder="Search coins, ratio, date"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="bg-card"
          />
        }
        filters={
          <>
            <Input
              placeholder="Old coin"
              value={searchParams.get("oldCoin") || ""}
              onChange={(e) => setFilter("oldCoin", e.target.value.trim())}
              className="w-28 bg-card"
            />
            <Input
              placeholder="New coin"
              value={searchParams.get("newCoin") || ""}
              onChange={(e) => setFilter("newCoin", e.target.value.trim())}
              className="w-28 bg-card"
            />
            <Select value={searchParams.get("informed") || "all"} onValueChange={(v) => setFilter("informed", v)}>
              <SelectTrigger className="w-[150px] bg-card">
                <SelectValue placeholder="Informed Tech" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Informed Tech</SelectItem>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
            <Select value={searchParams.get("ack") || "all"} onValueChange={(v) => setFilter("ack", v)}>
              <SelectTrigger className="w-[200px] bg-card">
                <SelectValue placeholder="Acknowledged by Tech" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Acknowledged by Tech</SelectItem>
                <SelectItem value="pending">Awaiting tech</SelectItem>
                <SelectItem value="yes">Acknowledged</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      {list.isLoading ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {list.data?.items.length === 0 ? (
        <Empty title="No token migrations yet." body="Add a migration to start tracking token conversions." />
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Migration Date</th>
              <th className="px-3 py-3 font-medium">Old Coin</th>
              <th className="px-3 py-3 font-medium">New Coin</th>
              <th className="px-3 py-3 font-medium">Ratio</th>
              <th className="px-3 py-3 font-medium">Informed Tech</th>
              <th className="px-3 py-3 font-medium">Acknowledged by Tech</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((row) => (
              <tr key={row.id} className="border-t border-border/60 hover:bg-muted/40">
                <td className="px-4 py-3">{row.migrationDate}</td>
                <td className="px-3 py-3">{row.oldCoin}</td>
                <td className="px-3 py-3">{row.newCoin}</td>
                <td className="px-3 py-3">{row.ratio}</td>
                <td className="px-3 py-3">
                  <YesNoPill value={row.informedTech} />
                </td>
                <td className="px-3 py-3">
                  <button type="button" className="text-left" onClick={() => setDetailId(row.id)}>
                    <TechAckStatus row={row} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

  const fieldLabel = "text-xs font-medium text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="px-6 pt-5 pb-2 text-left">
          <DialogTitle>{editId ? "Edit migration" : "Add migration"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Migration date</Label>
            <Input type="date" value={migrationDate} onChange={(e) => setMigrationDate(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Old coin</Label>
              <Input value={oldCoin} onChange={(e) => setOldCoin(e.target.value)} required autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label className={fieldLabel}>New coin</Label>
              <Input value={newCoin} onChange={(e) => setNewCoin(e.target.value)} required autoComplete="off" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className={fieldLabel}>Ratio</Label>
            <Input value={ratio} onChange={(e) => setRatio(e.target.value)} required autoComplete="off" />
          </div>
          {editId ? (
            <div className="space-y-1.5">
              <Label className={fieldLabel}>Informed tech</Label>
              <Select value={informedTech ? "yes" : "no"} onValueChange={(v) => setInformedTech(v === "yes")}>
                <SelectTrigger className="w-full">
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
        <DialogFooter className="!mx-0 !mb-0 !flex-row items-center justify-end gap-2 border-t bg-muted/50 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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

type MigrationChange = { field: string; label: string; from: string; to: string };

type MigrationActivity = {
  id: string;
  summary: string;
  changes?: MigrationChange[];
  notes?: string[];
  actorName: string;
  createdAt: string;
};

function MigrationActivityList({ activity }: { activity: MigrationActivity[] }) {
  if (activity.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }
  return (
    <ol className="space-y-5">
      {activity.map((entry) => (
        <li key={entry.id} className="border-l-2 border-border pl-4">
          <p className="text-sm font-medium text-foreground">{entry.summary}</p>
          {entry.changes && entry.changes.length > 0 ? (
            <ul className="mt-2 space-y-1.5">
              {entry.changes.map((line) => (
                <li key={`${entry.id}-${line.field}`} className="text-sm leading-relaxed text-muted-foreground">
                  <span className="text-muted-foreground">{line.label}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="text-foreground/90">{line.from}</span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="font-medium text-foreground">{line.to}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {entry.notes && entry.notes.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {entry.notes.map((note) => (
                <li key={note} className="text-sm text-muted-foreground">{note}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {entry.actorName} · {formatWhen(entry.createdAt)}
          </p>
        </li>
      ))}
    </ol>
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
        activity: MigrationActivity[];
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
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {detail.isLoading || !item ? (
            <div className="p-8">
              <LoadingBlock />
            </div>
          ) : (
            <>
              <div className="border-b border-border px-6 py-5">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl tracking-tight">
                    {item.oldCoin}
                    <span className="mx-2 font-normal text-muted-foreground">→</span>
                    {item.newCoin}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-sm">
                    Token migration record
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="grid gap-8 px-6 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <section className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Details</h3>
                  <dl className="divide-y divide-border/60 rounded-xl border border-border bg-muted/40/50">
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Migration date</dt>
                      <dd className="text-sm font-medium text-foreground">{item.migrationDate}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Ratio</dt>
                      <dd className="text-sm font-medium text-foreground">{item.ratio}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="text-sm text-muted-foreground">Informed Tech</dt>
                      <dd><YesNoPill value={item.informedTech} /></dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <dt className="shrink-0 text-sm text-muted-foreground">Acknowledged by Tech</dt>
                      <dd className="m-0 shrink-0 text-right">
                        <TechAckStatus row={item} />
                      </dd>
                    </div>
                  </dl>
                </section>
                <section className="flex min-h-0 flex-col">
                  <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                  <div className="mt-4 max-h-[min(22rem,50vh)] flex-1 overflow-y-auto pr-1">
                    <MigrationActivityList activity={activity} />
                  </div>
                </section>
              </div>
              <DialogFooter className="!mx-0 !mb-0 !flex-row flex-nowrap items-center justify-between gap-3 border-t bg-muted/50 px-6 py-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                <div className="flex shrink-0 items-center gap-2">
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
