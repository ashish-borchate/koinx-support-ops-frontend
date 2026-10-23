import { NavLink, Navigate, Outlet, Route, Routes, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { FilterStat, StatCard } from "@/components/filter-stat";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api, download, getToken, getViewAs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatPublicationTimestamp, formatWhen } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { moduleIndexSegment } from "@/lib/module-nav";
import { TruncatedHoverField } from "@/components/truncated-hover-field";
import { cn } from "@/lib/utils";

type SupportedFileRow = {
  id: string;
  exchangeName: string;
  fileName: string;
  verificationStatus: string;
  lastVerifiedAt: string | null;
  verifiedByName: string | null;
  verificationChecklistRecorded: boolean;
  verificationTestImportCompleted: boolean | null;
  verificationBackendSupportConfirmed: boolean | null;
  updatedReason: string;
  attachment: {
    originalName: string;
    contentType: string;
    previewKind: string;
  } | null;
};

const SUPPORTED_FILE_VERIFY_CHECKLIST_MESSAGE =
  "Complete both supported file verification checklist items before confirming verification.";

function SupportedFilesLayout() {
  const { can } = useAuth();
  const links = [
    { to: "/supported-files/dashboard", label: "Dashboard", any: ["supported_files.dashboard"] },
    { to: "/supported-files/tracker", label: "Tracker", any: ["supported_files.tracker"] },
  ].filter((l) => can(...l.any));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Operations" title="Supported Files" />
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `rounded-lg px-3 py-1.5 text-sm ${isActive ? "bg-blue-50 font-medium text-blue-800" : "text-muted-foreground hover:bg-muted/40"}`
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

function StatusPill({ value }: { value: string }) {
  const tone = value === "Verified" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{value}</span>;
}

function lastVerifiedText(at: string | null | undefined) {
  if (!at) return "Never verified";
  return formatWhen(at);
}

function groupSupportedFilesByExchange(items: SupportedFileRow[]) {
  const map = new Map<string, SupportedFileRow[]>();
  for (const row of items) {
    const list = map.get(row.exchangeName) ?? [];
    list.push(row);
    map.set(row.exchangeName, list);
  }
  return Array.from(map.entries())
    .map(([exchangeName, files]) => ({
      exchangeName,
      files: [...files].sort((a, b) => a.fileName.localeCompare(b.fileName)),
    }))
    .sort((a, b) => a.exchangeName.localeCompare(b.exchangeName));
}

function FileTypeChip({
  row,
  selected,
  onSelect,
}: {
  row: SupportedFileRow;
  selected?: boolean;
  onSelect: () => void;
}) {
  const needsReview = row.verificationStatus === "Needs Review";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-left text-xs font-medium transition-colors",
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-muted/40 text-foreground hover:bg-muted",
        needsReview && !selected ? "border-amber-300/80 bg-amber-50/80 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100" : "",
      )}
      title={needsReview ? "Needs review" : row.verificationStatus}
    >
      <span className="truncate">{row.fileName}</span>
      {needsReview ? <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden /> : null}
    </button>
  );
}

async function fileToUploadPayload(file: File) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
  return { originalName: file.name, contentType: file.type || "application/octet-stream", data };
}

function SupportedFilesIndex() {
  const { can } = useAuth();
  const segment = moduleIndexSegment(can, "supported_files.dashboard", "supported_files.tracker");
  return <Navigate to={segment} replace />;
}

export function SupportedFilesRoutes() {
  return (
    <Routes>
      <Route element={<SupportedFilesLayout />}>
        <Route path="dashboard" element={<SupportedFilesDashboardPage />} />
        <Route path="tracker" element={<SupportedFilesTrackerPage />} />
        <Route index element={<SupportedFilesIndex />} />
      </Route>
    </Routes>
  );
}

export function SupportedFilesDashboardPage() {
  const { can, canMutate } = useAuth();
  const hasDashboard = can("supported_files.dashboard");
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const dash = useQuery({
    queryKey: ["supported-files-dashboard"],
    enabled: hasDashboard,
    queryFn: () =>
      api<{
        stats: { total: number; verified: number; needsReview: number; recentlyVerified: number };
        recent: SupportedFileRow[];
      }>("/api/supported-files/dashboard"),
    staleTime: STALE.reference,
    placeholderData: (prev) => prev,
  });

  if (!hasDashboard) return <Navigate to="/supported-files/tracker" replace />;
  if (dash.isPending && !dash.data) return <LoadingBlock />;
  if (dash.isError) return <ErrorBlock message={dash.error.message} />;
  const data = dash.data!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Reference files KoinX supports per exchange.</p>
        {canMutate("supported_files.manage") ? (
          <Button type="button" onClick={() => setAddOpen(true)}>
            + Add Supported File
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Supported Files" value={data.stats.total} />
        <StatCard label="Verified" value={data.stats.verified} />
        <StatCard label="Needs Review" value={data.stats.needsReview} />
        <StatCard label="Recently Verified" value={data.stats.recentlyVerified} />
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recent verification activity</h2>
        {data.recent.length === 0 ? (
          <Empty title="No verification activity yet." body="" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Exchange</th>
                  <th className="px-3 py-3 font-medium">File Name</th>
                  <th className="px-3 py-3 font-medium">Verification Status</th>
                  <th className="px-3 py-3 font-medium">Last Verified</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((row) => (
                  <tr key={row.id} className="border-t border-border/60 hover:bg-muted/40">
                    <td className="px-4 py-3">{row.exchangeName}</td>
                    <td className="px-3 py-3">
                      <button type="button" className="font-medium text-primary" onClick={() => setDetailId(row.id)}>
                        {row.fileName}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill value={row.verificationStatus} />
                    </td>
                    <td className="px-3 py-3">{lastVerifiedText(row.lastVerifiedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <AddSupportedFileDialog open={addOpen} onOpenChange={setAddOpen} />
      <SupportedFileDetailDialog id={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

export function SupportedFilesTrackerPage() {
  const { canMutate } = useAuth();
  const dash = useQuery({
    queryKey: ["supported-files-dashboard"],
    queryFn: () =>
      api<{ stats: { total: number; verified: number; needsReview: number; recentlyVerified: number } }>(
        "/api/supported-files/dashboard",
      ),
    staleTime: STALE.reference,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [exchange, setExchange] = useState(searchParams.get("exchange") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [filter, setFilter] = useState(searchParams.get("filter") || "all");
  const [sort, setSort] = useState(searchParams.get("sort") || "default");
  const [detailId, setDetailId] = useState<string | null>(searchParams.get("id"));
  const [addOpen, setAddOpen] = useState(false);

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (exchange !== "all") p.set("exchange", exchange);
    if (status !== "all") p.set("status", status);
    if (filter !== "all") p.set("filter", filter);
    if (sort !== "default") p.set("sort", sort);
    return p.toString();
  }, [q, exchange, status, filter, sort]);

  useEffect(() => {
    const p = new URLSearchParams(queryString);
    if (detailId) p.set("id", detailId);
    setSearchParams(p, { replace: true });
  }, [queryString, detailId, setSearchParams]);

  const exchanges = useQuery({
    queryKey: ["supported-files-exchanges"],
    queryFn: () => api<{ exchanges: string[] }>("/api/supported-files/exchanges"),
    staleTime: STALE.catalog,
  });

  const list = useQuery({
    queryKey: ["supported-files-list", queryString],
    queryFn: () => api<{ items: SupportedFileRow[] }>(`/api/supported-files?${queryString}`),
    staleTime: STALE.reference,
    placeholderData: (prev) => prev,
  });

  const grouped = useMemo(() => groupSupportedFilesByExchange(list.data?.items ?? []), [list.data?.items]);

  const detailExchangeFiles = useMemo(() => {
    if (!detailId || !list.data?.items) return undefined;
    const row = list.data.items.find((r) => r.id === detailId);
    if (!row) return undefined;
    return list.data.items.filter((r) => r.exchangeName === row.exchangeName);
  }, [detailId, list.data?.items]);

  const showInitialLoad = list.isPending && !list.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Supported file types grouped by exchange. Select a file type for verification details.</p>
        {canMutate("supported_files.manage") ? (
          <Button type="button" onClick={() => setAddOpen(true)}>
            + Add Supported File
          </Button>
        ) : null}
      </div>
      {dash.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterStat
            label="Total Supported Files"
            value={dash.data.stats.total}
            active={status === "all" && filter === "all"}
            onClick={() => {
              if (status === "all" && filter === "all") return;
              setStatus("all");
              setFilter("all");
            }}
          />
          <FilterStat
            label="Verified"
            value={dash.data.stats.verified}
            active={status === "Verified" && filter === "all"}
            onClick={() => {
              if (status === "Verified" && filter === "all") {
                setStatus("all");
              } else {
                setStatus("Verified");
                setFilter("all");
              }
            }}
          />
          <FilterStat
            label="Needs Review"
            value={dash.data.stats.needsReview}
            active={filter === "needsReview" || status === "Needs Review"}
            onClick={() => {
              if (filter === "needsReview" || status === "Needs Review") {
                setStatus("all");
                setFilter("all");
              } else {
                setStatus("Needs Review");
                setFilter("needsReview");
              }
            }}
          />
          <FilterStat
            label="Recently Verified"
            value={dash.data.stats.recentlyVerified}
            active={filter === "recentlyVerified"}
            onClick={() => {
              if (filter === "recentlyVerified") {
                setFilter("all");
              } else {
                setStatus("all");
                setFilter("recentlyVerified");
              }
            }}
          />
        </div>
      ) : null}
      <div className="grid gap-2 lg:grid-cols-[1fr_180px_180px_180px_180px]">
        <Input placeholder="Search exchange or file name" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={exchange} onValueChange={setExchange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Exchange" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All exchanges</SelectItem>
            {exchanges.data?.exchanges.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            if (v !== "Needs Review") setFilter((f) => (f === "needsReview" ? "all" : f));
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Verified">Verified</SelectItem>
            <SelectItem value="Needs Review">Needs Review</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v);
            if (v === "recentlyVerified") setStatus("all");
            if (v === "needsReview") setStatus("Needs Review");
            if (v === "all") setStatus((s) => (s === "Needs Review" ? "all" : s));
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All records</SelectItem>
            <SelectItem value="needsReview">Needs review</SelectItem>
            <SelectItem value="recentlyVerified">Recently verified</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Needs review first</SelectItem>
            <SelectItem value="exchange">Exchange name</SelectItem>
            <SelectItem value="fileName">File name</SelectItem>
            <SelectItem value="lastVerified">Last verified</SelectItem>
            <SelectItem value="status">Verification status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showInitialLoad ? <LoadingBlock /> : null}
      {list.isError ? <ErrorBlock message={list.error.message} /> : null}
      {!showInitialLoad && list.data?.items.length === 0 ? (
        <div className="space-y-3">
          <Empty title="No supported files yet." body="Add a supported file to start building the exchange file library." />
          {canMutate("supported_files.manage") ? (
            <Button type="button" onClick={() => setAddOpen(true)}>
              + Add Supported File
            </Button>
          ) : null}
        </div>
      ) : null}

      {grouped.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[minmax(140px,220px)_1fr_120px] sm:gap-4">
            <span>Exchange</span>
            <span>Supported file types</span>
            <span className="text-right">Review</span>
          </div>
          <ul className="divide-y divide-border/60">
            {grouped.map((group) => {
              const needsReviewCount = group.files.filter((f) => f.verificationStatus === "Needs Review").length;
              return (
                <li
                  key={group.exchangeName}
                  className="flex flex-col gap-3 px-4 py-4 sm:grid sm:grid-cols-[minmax(140px,220px)_1fr_120px] sm:items-start sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{group.exchangeName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:hidden">
                      {group.files.length} file type{group.files.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {group.files.map((row) => (
                      <FileTypeChip
                        key={row.id}
                        row={row}
                        selected={detailId === row.id}
                        onSelect={() => setDetailId(row.id)}
                      />
                    ))}
                  </div>
                  <div className="text-left text-xs sm:text-right">
                    {needsReviewCount > 0 ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                        {needsReviewCount} need review
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <AddSupportedFileDialog open={addOpen} onOpenChange={setAddOpen} />
      <SupportedFileDetailDialog
        id={detailId}
        exchangeFiles={detailExchangeFiles}
        onSelectId={setDetailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

function resetAddSupportedFileForm(
  setters: {
    setExchangeName: (v: string) => void;
    setFileName: (v: string) => void;
    setUpdatedReason: (v: string) => void;
    setPendingFile: (v: File | null) => void;
  },
) {
  setters.setExchangeName("");
  setters.setFileName("");
  setters.setUpdatedReason("");
  setters.setPendingFile(null);
}

function AddSupportedFileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const client = useQueryClient();
  const addFileRef = useRef<HTMLInputElement>(null);
  const [exchangeName, setExchangeName] = useState("");
  const [fileName, setFileName] = useState("");
  const [updatedReason, setUpdatedReason] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const exchanges = useQuery({
    queryKey: ["supported-files-exchanges"],
    queryFn: () => api<{ exchanges: string[] }>("/api/supported-files/exchanges"),
    enabled: open,
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      resetAddSupportedFileForm({
        setExchangeName,
        setFileName,
        setUpdatedReason,
        setPendingFile,
      });
    }
    onOpenChange(next);
  }

  const create = useMutation({
    mutationFn: async () => {
      const created = await api<{ item: { id: string } }>("/api/supported-files", {
        method: "POST",
        body: JSON.stringify({
          exchangeName: exchangeName.trim(),
          fileName: fileName.trim(),
          updatedReason,
        }),
      });
      const newId = created.item.id;
      if (pendingFile) {
        const payload = await fileToUploadPayload(pendingFile);
        await api(`/api/supported-files/${newId}/attachment`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      return newId;
    },
    onSuccess: () => {
      toast.success("Supported file added");
      handleOpenChange(false);
      void client.invalidateQueries({ queryKey: ["supported-files-list"] });
      void client.invalidateQueries({ queryKey: ["supported-files-dashboard"] });
      void client.invalidateQueries({ queryKey: ["supported-files-exchanges"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const canSubmit = Boolean(exchangeName.trim() && fileName.trim());

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
          <>
            <DialogHeader>
              <DialogTitle>Add supported file</DialogTitle>
              <DialogDescription>
                Add a file type for an exchange. You can attach a sample reference file now and complete verification from the tracker when ready.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Exchange</Label>
                <Input list="sf-exchanges" value={exchangeName} onChange={(e) => setExchangeName(e.target.value)} required />
                <datalist id="sf-exchanges">
                  {exchanges.data?.exchanges.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label>Supported file type</Label>
                <Input placeholder="Trade History" value={fileName} onChange={(e) => setFileName(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Sample / reference file (optional)</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => addFileRef.current?.click()}>
                    Choose file
                  </Button>
                  {pendingFile ? (
                    <span className="min-w-0 truncate text-sm text-foreground" title={pendingFile.name}>
                      {pendingFile.name}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">No file selected</span>
                  )}
                  {pendingFile ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPendingFile(null)}>
                      Remove
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={addFileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPendingFile(file ?? null);
                    e.target.value = "";
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Updated reason (optional)</Label>
                <Textarea rows={2} value={updatedReason} onChange={(e) => setUpdatedReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
                Create
              </Button>
            </DialogFooter>
          </>
      </DialogContent>
    </Dialog>
  );
}

type SupportedFileChange = { field: string; label: string; from: string; to: string };

type SupportedFileActivity = {
  id: string;
  summary: string;
  changes?: SupportedFileChange[];
  actorName: string;
  createdAt: string;
};

function SupportedFileActivityList({ activity }: { activity: SupportedFileActivity[] }) {
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
          <p className="mt-2 text-xs text-muted-foreground">
            {entry.actorName} · {formatWhen(entry.createdAt)}
          </p>
        </li>
      ))}
    </ol>
  );
}

const sfFieldLabel = "text-xs font-medium text-muted-foreground";

function SupportedFileDetailDialog({
  id,
  onClose,
  exchangeFiles,
  onSelectId,
}: {
  id: string | null;
  onClose: () => void;
  exchangeFiles?: SupportedFileRow[];
  onSelectId?: (nextId: string) => void;
}) {
  const { canMutate, readOnly } = useAuth();
  const client = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [replaceMode, setReplaceMode] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewKind, setPreviewKind] = useState<string>("none");
  const [editExchange, setEditExchange] = useState("");
  const [editFileName, setEditFileName] = useState("");
  const [editStatus, setEditStatus] = useState("Needs Review");
  const [editReason, setEditReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [testImportChecked, setTestImportChecked] = useState(false);
  const [backendSupportChecked, setBackendSupportChecked] = useState(false);
  const [verifyValidation, setVerifyValidation] = useState(false);

  const detail = useQuery({
    queryKey: ["supported-files-item", id],
    queryFn: () =>
      api<{
        item: SupportedFileRow;
        activity: SupportedFileActivity[];
        actions: { manage: boolean };
      }>(`/api/supported-files/${id}`),
    enabled: Boolean(id),
    staleTime: STALE.reference,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    setEditOpen(false);
    setTestImportChecked(false);
    setBackendSupportChecked(false);
    setVerifyValidation(false);
  }, [id]);

  useEffect(() => {
    if (!detail.data?.item) return;
    const row = detail.data.item;
    setEditExchange(row.exchangeName);
    setEditFileName(row.fileName);
    setEditStatus(row.verificationStatus);
    setEditReason(row.updatedReason);
  }, [detail.data?.item]);

  function cancelEdit() {
    if (!detail.data?.item) return;
    const row = detail.data.item;
    setEditExchange(row.exchangeName);
    setEditFileName(row.fileName);
    setEditStatus(row.verificationStatus);
    setEditReason(row.updatedReason);
    setEditOpen(false);
  }

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["supported-files-item", id] });
    void client.invalidateQueries({ queryKey: ["supported-files-list"] });
    void client.invalidateQueries({ queryKey: ["supported-files-dashboard"] });
  };

  const save = useMutation({
    mutationFn: () => {
      const row = detail.data?.item;
      const payload: Record<string, string> = {
        exchangeName: editExchange,
        fileName: editFileName,
        updatedReason: editReason,
      };
      if (row && editStatus !== row.verificationStatus) {
        payload.verificationStatus = editStatus;
      }
      return api(`/api/supported-files/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      toast.success("Record updated");
      setEditOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: () =>
      api(`/api/supported-files/${id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          testImportCompleted: true,
          backendSupportConfirmed: true,
        }),
      }),
    onSuccess: () => {
      toast.success("Supported file verified");
      setTestImportChecked(false);
      setBackendSupportChecked(false);
      setVerifyValidation(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleConfirmVerification() {
    if (!testImportChecked || !backendSupportChecked) {
      setVerifyValidation(true);
      toast.error(SUPPORTED_FILE_VERIFY_CHECKLIST_MESSAGE);
      return;
    }
    verify.mutate();
  }

  const upload = useMutation({
    mutationFn: (file: File) =>
      fileToUploadPayload(file).then((payload) =>
        api(`/api/supported-files/${id}/attachment${replaceMode ? "?replace=1" : ""}`, {
          method: "POST",
          body: JSON.stringify(payload),
        }),
      ),
    onSuccess: () => {
      toast.success(replaceMode ? "File replaced" : "File attached");
      setReplaceMode(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeFile = useMutation({
    mutationFn: () => api(`/api/supported-files/${id}/attachment`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Attachment deleted");
      setDeleteOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  async function openPreview() {
    if (!id || !detail.data?.item.attachment) return;
    const kind = detail.data.item.attachment.previewKind;
    setPreviewKind(kind);
    if (kind === "text") {
      const res = await api<{ text: string }>(`/api/supported-files/${id}/attachment/preview-text`);
      setPreviewText(res.text);
      setPreviewUrl(null);
      setPreviewOpen(true);
      return;
    }
    if (kind === "image" || kind === "pdf") {
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const viewAs = getViewAs();
      if (viewAs) headers.set("X-View-As", viewAs);
      const response = await fetch(`/api/supported-files/${id}/attachment/download?inline=1`, { headers });
      if (!response.ok) throw new Error("Preview failed");
      const blob = await response.blob();
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewText(null);
      setPreviewOpen(true);
      return;
    }
    toast.message("Preview not available for this format. Use Download.");
  }

  const item = detail.data?.item;
  const activity = detail.data?.activity ?? [];
  const manage = canMutate("supported_files.manage") && !readOnly && detail.data?.actions.manage;

  return (
    <>
      <Dialog open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {detail.isPending && !item ? (
            <div className="p-8">
              <LoadingBlock />
            </div>
          ) : !item ? null : (
            <>
              <div className="border-b border-border px-6 py-5">
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl tracking-tight">{item.exchangeName}</DialogTitle>
                  <DialogDescription className="mt-1">{item.fileName}</DialogDescription>
                </DialogHeader>
                {exchangeFiles && exchangeFiles.length > 1 ? (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground">Supported file types</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {exchangeFiles.map((row) => (
                        <FileTypeChip
                          key={row.id}
                          row={row}
                          selected={row.id === id}
                          onSelect={() => onSelectId?.(row.id)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="grid max-h-[min(70vh,calc(90vh-10rem))] gap-8 overflow-y-auto px-6 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-6">
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Verification</h3>
                    <dl className="min-w-0 divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-muted/40/50 text-sm">
                      <div className="flex items-center justify-between gap-4 px-4 py-3">
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="flex flex-wrap items-center justify-end gap-2">
                          <StatusPill value={item.verificationStatus} />
                          {manage && !editOpen ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                              Edit
                            </Button>
                          ) : null}
                        </dd>
                      </div>
                      {item.verificationStatus === "Verified" ? (
                        <>
                          {item.verificationChecklistRecorded ? (
                            <>
                              <div className="flex items-center justify-between gap-4 px-4 py-3">
                                <dt className="text-muted-foreground">Test import</dt>
                                <dd className="font-medium text-foreground">Completed</dd>
                              </div>
                              <div className="flex items-center justify-between gap-4 px-4 py-3">
                                <dt className="text-muted-foreground">Backend support</dt>
                                <dd className="font-medium text-foreground">Confirmed with Tech</dd>
                              </div>
                            </>
                          ) : (
                            <div className="px-4 py-3 text-sm text-muted-foreground">Checklist details not recorded</div>
                          )}
                          {item.verifiedByName ? (
                            <div className="flex items-center justify-between gap-4 px-4 py-3">
                              <dt className="text-muted-foreground">Verified by</dt>
                              <dd className="font-medium text-foreground">{item.verifiedByName}</dd>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between gap-4 px-4 py-3">
                            <dt className="text-muted-foreground">Verified on</dt>
                            <dd className="text-right font-medium text-foreground">
                              {item.lastVerifiedAt ? formatPublicationTimestamp(item.lastVerifiedAt) : "—"}
                            </dd>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between gap-4 px-4 py-3">
                          <dt className="text-muted-foreground">Last verified</dt>
                          <dd className="text-right font-medium text-foreground">{lastVerifiedText(item.lastVerifiedAt)}</dd>
                        </div>
                      )}
                      <TruncatedHoverField
                        variant="detail"
                        label="Updated reason"
                        popoverTitle="Updated reason"
                        value={item.updatedReason || ""}
                      />
                    </dl>
                    {manage && item.verificationStatus === "Needs Review" ? (
                      <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                        <p className="text-sm font-semibold text-foreground">Supported File Verification</p>
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={testImportChecked}
                            onChange={(e) => {
                              setTestImportChecked(e.target.checked);
                              if (e.target.checked && backendSupportChecked) setVerifyValidation(false);
                            }}
                          />
                          <span className="space-y-1 text-sm">
                            <span className="block font-medium text-foreground">Test import completed</span>
                            <span className="block text-muted-foreground">
                              I confirmed that this file format is supported and successfully tested importing it using my own
                              KoinX account, without encountering an Invalid File or Unsupported Format error.
                            </span>
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2.5">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={backendSupportChecked}
                            onChange={(e) => {
                              setBackendSupportChecked(e.target.checked);
                              if (e.target.checked && testImportChecked) setVerifyValidation(false);
                            }}
                          />
                          <span className="space-y-1 text-sm">
                            <span className="block font-medium text-foreground">Backend support confirmed with Tech</span>
                            <span className="block text-muted-foreground">
                              I confirmed with the Tech team that this file format is supported for the selected exchange and
                              that the required backend changes have been implemented.
                            </span>
                          </span>
                        </label>
                        {verifyValidation ? (
                          <p className="text-sm text-destructive">{SUPPORTED_FILE_VERIFY_CHECKLIST_MESSAGE}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">Sample / reference file</h3>
                    {item.attachment ? (
                      <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)] p-4">
                        <p className="flex min-w-0 items-start gap-2 text-sm text-foreground/90">
                          <Paperclip className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate font-medium" title={item.attachment.originalName}>
                            {item.attachment.originalName}
                          </span>
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => void openPreview()}>
                            Preview
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void download(`/api/supported-files/${id}/attachment/download`, item.attachment!.originalName)}
                          >
                            Download
                          </Button>
                          {manage ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setReplaceMode(true);
                                  fileRef.current?.click();
                                }}
                              >
                                Replace
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
                                Delete
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                        <p>No reference file attached</p>
                        {manage ? (
                          <Button type="button" size="sm" className="mt-3" variant="outline" onClick={() => fileRef.current?.click()}>
                            Attach file
                          </Button>
                        ) : null}
                      </div>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload.mutate(file);
                        e.target.value = "";
                      }}
                    />
                  </section>

                  {manage && editOpen ? (
                    <section className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Update record</h3>
                      <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/30 p-4">
                        <div className="space-y-1.5">
                          <Label className={sfFieldLabel}>Exchange</Label>
                          <Input value={editExchange} onChange={(e) => setEditExchange(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className={sfFieldLabel}>File name</Label>
                          <Input value={editFileName} onChange={(e) => setEditFileName(e.target.value)} />
                        </div>
                        {item.verificationStatus === "Verified" ? (
                          <div className="space-y-1.5">
                            <Label className={sfFieldLabel}>Verification status</Label>
                            <Select value={editStatus} onValueChange={setEditStatus}>
                              <SelectTrigger className="w-full bg-card">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Needs Review">Needs Review</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Use the verification checklist to mark a file as verified. You can move it back to Needs Review
                              here if needed.
                            </p>
                          </div>
                        ) : null}
                        <div className="space-y-1.5">
                          <Label className={sfFieldLabel}>Updated reason</Label>
                          <Textarea rows={3} className="bg-card" value={editReason} onChange={(e) => setEditReason(e.target.value)} />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 pt-1">
                          <Button type="button" variant="outline" onClick={cancelEdit} disabled={save.isPending}>
                            Cancel
                          </Button>
                          <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
                            Update
                          </Button>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </div>

                <section className="flex min-h-0 min-w-0 flex-col md:max-h-[min(28rem,60vh)]">
                  <h3 className="text-sm font-semibold text-foreground">Activity</h3>
                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
                    <SupportedFileActivityList activity={activity} />
                  </div>
                </section>
              </div>

              <DialogFooter className="!mx-0 !mb-0 !flex-row flex-nowrap items-center justify-between gap-3 border-t bg-muted/50 px-6 py-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                {manage && item.verificationStatus === "Needs Review" ? (
                  <Button
                    type="button"
                    onClick={handleConfirmVerification}
                    disabled={verify.isPending || !testImportChecked || !backendSupportChecked}
                  >
                    Confirm Verification
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this attached file?</DialogTitle>
            <DialogDescription>The supported file record will remain. You can attach a new reference file later.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => removeFile.mutate()} disabled={removeFile.isPending}>
              Delete file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open && previewUrl) URL.revokeObjectURL(previewUrl);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-auto">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          {previewKind === "text" && previewText ? (
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">{previewText}</pre>
          ) : null}
          {previewKind === "image" && previewUrl ? <img src={previewUrl} alt="Preview" className="max-h-[60vh] w-full object-contain" /> : null}
          {previewKind === "pdf" && previewUrl ? (
            <iframe title="PDF preview" src={previewUrl} className="h-[60vh] w-full rounded-lg border" />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
