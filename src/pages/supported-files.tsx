import { NavLink, Outlet, Route, Routes, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Empty, ErrorBlock, LoadingBlock, PageHeader } from "@/components/bits";
import { api, download, getToken, getViewAs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { STALE } from "@/lib/query-client";
import { cn } from "@/lib/utils";

type SupportedFileRow = {
  id: string;
  exchangeName: string;
  fileName: string;
  verificationStatus: string;
  lastVerifiedAt: string | null;
  verifiedByName: string | null;
  updatedReason: string;
  attachment: {
    originalName: string;
    contentType: string;
    previewKind: string;
  } | null;
};

function SupportedFilesLayout() {
  const { can } = useAuth();
  const links = [
    { to: "/supported-files/dashboard", label: "Dashboard", any: ["supported_files.dashboard"] },
    { to: "/supported-files/tracker", label: "Tracker", any: ["supported_files.tracker"] },
  ].filter((l) => can(...l.any));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Operations" title="Supported Files" />
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

export function SupportedFilesRoutes() {
  return (
    <Routes>
      <Route element={<SupportedFilesLayout />}>
        <Route path="dashboard" element={<SupportedFilesDashboardPage />} />
        <Route path="tracker" element={<SupportedFilesTrackerPage />} />
        <Route index element={<SupportedFilesDashboardPage />} />
      </Route>
    </Routes>
  );
}

export function SupportedFilesDashboardPage() {
  const { canMutate } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const dash = useQuery({
    queryKey: ["supported-files-dashboard"],
    queryFn: () =>
      api<{
        stats: { total: number; verified: number; needsReview: number; recentlyVerified: number };
        recent: SupportedFileRow[];
      }>("/api/supported-files/dashboard"),
    staleTime: STALE.reference,
    placeholderData: (prev) => prev,
  });

  if (dash.isPending && !dash.data) return <LoadingBlock />;
  if (dash.isError) return <ErrorBlock message={dash.error.message} />;
  const data = dash.data!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">Reference files KoinX supports per exchange.</p>
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
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent verification activity</h2>
        {data.recent.length === 0 ? (
          <Empty title="No verification activity yet." body="" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Exchange</th>
                  <th className="px-3 py-3 font-medium">File Name</th>
                  <th className="px-3 py-3 font-medium">Verification Status</th>
                  <th className="px-3 py-3 font-medium">Last Verified</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">{row.exchangeName}</td>
                    <td className="px-3 py-3">
                      <button type="button" className="font-medium text-blue-700" onClick={() => setDetailId(row.id)}>
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
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Verified">Verified</SelectItem>
            <SelectItem value="Needs Review">Needs Review</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filter} onValueChange={setFilter}>
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-slate-900">{value}</CardContent>
    </Card>
  );
}

function AddSupportedFileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const client = useQueryClient();
  const [exchangeName, setExchangeName] = useState("");
  const [fileName, setFileName] = useState("");
  const [updatedReason, setUpdatedReason] = useState("");
  const exchanges = useQuery({
    queryKey: ["supported-files-exchanges"],
    queryFn: () => api<{ exchanges: string[] }>("/api/supported-files/exchanges"),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () =>
      api("/api/supported-files", {
        method: "POST",
        body: JSON.stringify({ exchangeName, fileName, updatedReason }),
      }),
    onSuccess: () => {
      toast.success("Supported file added");
      onOpenChange(false);
      setExchangeName("");
      setFileName("");
      setUpdatedReason("");
      void client.invalidateQueries({ queryKey: ["supported-files-list"] });
      void client.invalidateQueries({ queryKey: ["supported-files-dashboard"] });
      void client.invalidateQueries({ queryKey: ["supported-files-exchanges"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add supported file</DialogTitle>
          <DialogDescription>
            Add a file type for an exchange. Pick an existing exchange from suggestions or enter a new one. Attachment is optional and can be added later.
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
            <Label>Updated reason (optional)</Label>
            <Textarea rows={3} value={updatedReason} onChange={(e) => setUpdatedReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!exchangeName.trim() || !fileName.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

  const detail = useQuery({
    queryKey: ["supported-files-item", id],
    queryFn: () =>
      api<{
        item: SupportedFileRow;
        activity: { id: string; summary: string; actorName: string; createdAt: string }[];
        actions: { manage: boolean };
      }>(`/api/supported-files/${id}`),
    enabled: Boolean(id),
    staleTime: STALE.reference,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!detail.data?.item) return;
    const item = detail.data.item;
    setEditExchange(item.exchangeName);
    setEditFileName(item.fileName);
    setEditStatus(item.verificationStatus);
    setEditReason(item.updatedReason);
  }, [detail.data?.item]);

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["supported-files-item", id] });
    void client.invalidateQueries({ queryKey: ["supported-files-list"] });
    void client.invalidateQueries({ queryKey: ["supported-files-dashboard"] });
  };

  const save = useMutation({
    mutationFn: () =>
      api(`/api/supported-files/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          exchangeName: editExchange,
          fileName: editFileName,
          verificationStatus: editStatus,
          updatedReason: editReason,
        }),
      }),
    onSuccess: () => {
      toast.success("Saved");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: () => api(`/api/supported-files/${id}/verify`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Marked as verified");
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {detail.isPending && !item ? (
            <LoadingBlock />
          ) : !item ? null : (
            <>
              <DialogHeader>
                <DialogTitle>{item.exchangeName}</DialogTitle>
                {exchangeFiles && exchangeFiles.length > 1 ? (
                  <div className="pt-2">
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
              </DialogHeader>
              <div className="space-y-5 text-sm">
                <section>
                  <h3 className="text-base font-semibold text-foreground">{item.fileName}</h3>
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verification</h3>
                  <div className="mt-2 space-y-2">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">Status</span>
                      <StatusPill value={item.verificationStatus} />
                    </p>
                    <p>
                      <span className="text-muted-foreground">Last verified</span>
                      <span className="ml-2">{lastVerifiedText(item.lastVerifiedAt)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Updated reason</span>
                      <span className="ml-2 whitespace-pre-wrap text-foreground">{item.updatedReason || "—"}</span>
                    </p>
                    {item.verifiedByName ? (
                      <p className="text-xs text-muted-foreground">Verified by {item.verifiedByName}</p>
                    ) : null}
                  </div>
                  {manage ? (
                    <Button type="button" className="mt-3" size="sm" onClick={() => verify.mutate()} disabled={verify.isPending}>
                      Mark as Verified
                    </Button>
                  ) : null}
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sample / reference file</h3>
                  {item.attachment ? (
                    <div className="mt-2 space-y-2">
                      <p>
                        📎 <span className="font-medium">{item.attachment.originalName}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
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
                              Replace file
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setDeleteOpen(true)}>
                              Delete attachment
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-slate-500">
                      <p>No reference file attached</p>
                      {manage ? (
                        <Button type="button" size="sm" className="mt-2" onClick={() => fileRef.current?.click()}>
                          + Attach File
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

                {manage ? (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Edit record</h3>
                    <div className="mt-2 space-y-2">
                      <Input value={editExchange} onChange={(e) => setEditExchange(e.target.value)} />
                      <Input value={editFileName} onChange={(e) => setEditFileName(e.target.value)} />
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Verified">Verified</SelectItem>
                          <SelectItem value="Needs Review">Needs Review</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea rows={4} value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="Updated Reason" />
                      <Button type="button" size="sm" variant="secondary" onClick={() => save.mutate()} disabled={save.isPending}>
                        Save changes
                      </Button>
                    </div>
                  </section>
                ) : null}

                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</h3>
                  <ul className="mt-2 space-y-2">
                    {activity.length === 0 ? <li className="text-slate-500">No activity yet.</li> : null}
                    {activity.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-slate-100 px-3 py-2">
                        <p>{entry.summary}</p>
                        <p className="text-xs text-slate-500">
                          {entry.actorName} · {formatWhen(entry.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
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
