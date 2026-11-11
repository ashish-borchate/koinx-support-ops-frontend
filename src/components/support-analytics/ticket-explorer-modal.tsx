import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, ErrorBlock, LoadingBlock } from "@/components/bits";
import { api } from "@/lib/api";
import { formatCalendarDate, formatNumber, formatWhen } from "@/lib/format";

export type SupportAnalyticsTicketRow = {
  freshdeskId: number;
  displayId?: number | null;
  subject: string | null;
  url: string | null;
  statusLabel: string;
  priorityLabel: string;
  assignedAgentName?: string;
  groupName?: string | null;
  createdAt: string;
  updatedAt?: string;
  dueBy?: string | null;
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
};

export type TicketExplorerFilterTab = {
  key: string;
  label: string;
  count: number;
  queryParams: Record<string, string>;
  hint?: string;
};

export type SupportAnalyticsTicketExplorerRequest = {
  source: "live" | "historical";
  title: string;
  subtitle?: string;
  queryParams: Record<string, string>;
  exportFileName?: string;
  filterTabs?: TicketExplorerFilterTab[];
  initialTabKey?: string;
};

type TicketSortField = "created" | "due" | "updated";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 25;

function ticketLabel(t: SupportAnalyticsTicketRow) {
  return t.displayId != null ? String(t.displayId) : String(t.freshdeskId);
}

function sortTimestamp(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function compareTicketRows(
  a: SupportAnalyticsTicketRow,
  b: SupportAnalyticsTicketRow,
  field: TicketSortField,
  direction: SortDirection,
): number {
  const pick = (row: SupportAnalyticsTicketRow) => {
    if (field === "created") return sortTimestamp(row.createdAt);
    if (field === "due") return sortTimestamp(row.dueBy);
    return sortTimestamp(row.updatedAt);
  };
  const av = pick(a);
  const bv = pick(b);
  const dirMul = direction === "asc" ? 1 : -1;

  if (av === null && bv === null) return a.freshdeskId - b.freshdeskId;
  if (av === null) return 1;
  if (bv === null) return -1;
  if (av !== bv) return (av - bv) * dirMul;
  return a.freshdeskId - b.freshdeskId;
}

function matchesSearch(t: SupportAnalyticsTicketRow, needle: string) {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    ticketLabel(t),
    t.subject ?? "",
    t.assignedAgentName ?? "",
    t.statusLabel,
    t.priorityLabel,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function TicketNoCell({ ticket }: { ticket: SupportAnalyticsTicketRow }) {
  const label = ticketLabel(ticket);
  if (ticket.url) {
    return (
      <a
        href={ticket.url}
        target="_blank"
        rel="noreferrer"
        className="font-medium tabular-nums text-primary hover:underline"
      >
        {label}
      </a>
    );
  }
  return <span className="font-medium tabular-nums">{label}</span>;
}

function toCsv(rows: SupportAnalyticsTicketRow[], includeResolved: boolean) {
  const header = [
    "Ticket No",
    "Subject",
    "Assignee",
    "Status",
    "Created (IST)",
    ...(includeResolved ? ["Resolved (IST)"] : []),
    "Due by (IST)",
    "Last modified (IST)",
    "Freshdesk URL",
  ];
  const lines = rows.map((t) =>
    [
      ticketLabel(t),
      (t.subject ?? "").replace(/"/g, '""'),
      (t.assignedAgentName ?? "").replace(/"/g, '""'),
      t.statusLabel,
      t.createdAt ? formatWhen(t.createdAt) : "",
      ...(includeResolved ? [t.resolvedAt ? formatWhen(t.resolvedAt) : ""] : []),
      t.dueBy ? formatWhen(t.dueBy) : "",
      t.updatedAt ? formatWhen(t.updatedAt) : "",
      t.url ?? "",
    ]
      .map((c) => `"${c}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

const SORT_FIELD_LABEL: Record<TicketSortField, string> = {
  created: "Date created",
  due: "Due by time",
  updated: "Last modified",
};

export function SupportAnalyticsTicketExplorerModal({
  request,
  onClose,
}: {
  request: SupportAnalyticsTicketExplorerRequest | null;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
  const [sortField, setSortField] = useState<TicketSortField>("created");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    if (!request) {
      setActiveTabKey(null);
      return;
    }
    const tabs = request.filterTabs;
    if (tabs?.length) {
      const pick = request.initialTabKey && tabs.some((t) => t.key === request.initialTabKey)
        ? request.initialTabKey
        : tabs[0]!.key;
      setActiveTabKey(pick);
    } else {
      setActiveTabKey(null);
    }
    setSearch("");
    setPage(0);
    setSortField("created");
    setSortDirection("desc");
  }, [request]);

  const activeQueryParams = useMemo(() => {
    if (!request) return null;
    if (request.filterTabs?.length && activeTabKey) {
      const tab = request.filterTabs.find((t) => t.key === activeTabKey);
      if (tab) return tab.queryParams;
    }
    return request.queryParams;
  }, [request, activeTabKey]);

  const activeTab = request?.filterTabs?.find((t) => t.key === activeTabKey) ?? null;
  const showResolvedColumn = request?.source === "historical";

  const endpoint =
    request?.source === "historical"
      ? "/api/support-analytics/historical/tickets"
      : "/api/support-analytics/tickets";

  const ticketsQuery = useQuery({
    queryKey: ["support-analytics", "ticket-explorer", request?.source, activeQueryParams],
    enabled: request != null && activeQueryParams != null,
    queryFn: () => {
      const params = new URLSearchParams({
        ...activeQueryParams!,
        limit: activeQueryParams!.limit ?? "500",
      });
      return api<{ tickets: SupportAnalyticsTicketRow[] }>(`${endpoint}?${params}`);
    },
  });

  const filtered = useMemo(() => {
    const rows = ticketsQuery.data?.tickets ?? [];
    const searched = rows.filter((t) => matchesSearch(t, search));
    return [...searched].sort((a, b) => compareTicketRows(a, b, sortField, sortDirection));
  }, [ticketsQuery.data?.tickets, search, sortField, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function handleOpenChange(open: boolean) {
    if (!open) {
      setSearch("");
      setPage(0);
      onClose();
    }
  }

  function exportCsv() {
    const blob = new Blob([toCsv(filtered, showResolvedColumn)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const tabSlug = activeTabKey ? `-${activeTabKey}` : "";
    a.download = request?.exportFileName?.replace(/\.csv$/, `${tabSlug}.csv`) ?? `support-analytics-tickets${tabSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={request != null} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="bg-black/45"
        className="flex max-h-[min(85vh,48rem)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        aria-describedby={request ? "ticket-explorer-desc" : undefined}
      >
        {request ? (
          <>
            <DialogHeader className="shrink-0 border-b border-border bg-background px-4 py-3 pr-12 text-left">
              <DialogTitle>{request.title}</DialogTitle>
              <DialogDescription id="ticket-explorer-desc">
                {request.subtitle ?? "Matching tickets"}
                {activeTab?.hint ? (
                  <span className="mt-1 block text-xs">{activeTab.hint}</span>
                ) : null}
                <span className="mt-1 block tabular-nums text-foreground">
                  {activeTab ? `${activeTab.label}: ` : ""}
                  {ticketsQuery.isLoading
                    ? "Loading…"
                    : `${formatNumber(filtered.length)} ticket${filtered.length === 1 ? "" : "s"} shown`}
                </span>
              </DialogDescription>
            </DialogHeader>

            {request.filterTabs?.length ? (
              <div
                className="flex shrink-0 flex-wrap gap-1 border-b border-border bg-background px-4 py-2"
                role="tablist"
                aria-label="Workload filters"
              >
                {request.filterTabs.map((tab) => (
                  <Button
                    key={tab.key}
                    type="button"
                    size="sm"
                    variant={tab.key === activeTabKey ? "default" : "outline"}
                    className="h-8 text-xs"
                    role="tab"
                    aria-selected={tab.key === activeTabKey}
                    onClick={() => {
                      setActiveTabKey(tab.key);
                      setPage(0);
                      setSearch("");
                    }}
                  >
                    {tab.label} ({formatNumber(tab.count)})
                  </Button>
                ))}
              </div>
            ) : null}

            {request.filterTabs?.length ? (
              <p className="shrink-0 bg-background px-4 pt-1 text-[11px] text-muted-foreground">
                Overdue and High/Urgent overlap status tabs — tickets are not double-counted in backlog totals.
              </p>
            ) : null}

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2">
              <div className="relative min-w-[12rem] flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search tickets…"
                  className="h-9 pl-8"
                  aria-label="Search tickets"
                />
              </div>
              <Select
                value={sortField}
                onValueChange={(value) => {
                  setSortField(value as TicketSortField);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-9 w-[9.5rem]" aria-label="Sort field">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Date created</SelectItem>
                  <SelectItem value="due">Due by time</SelectItem>
                  <SelectItem value="updated">Last modified</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortDirection}
                onValueChange={(value) => {
                  setSortDirection(value as SortDirection);
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-9 w-[8.5rem]" aria-label="Sort direction">
                  <span className="flex items-center gap-1.5">
                    {sortDirection === "asc" ? (
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    )}
                    <SelectValue placeholder="Order" />
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {SORT_FIELD_LABEL[sortField]} · {sortDirection === "desc" ? "Newest first" : "Oldest first"}
              </span>
              <Button type="button" variant="outline" size="sm" disabled={!filtered.length} onClick={exportCsv}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
              {ticketsQuery.isLoading ? <LoadingBlock label="Loading tickets…" /> : null}
              {ticketsQuery.isError ? <ErrorBlock message="Could not load tickets." /> : null}
              {!ticketsQuery.isLoading && !ticketsQuery.isError && filtered.length === 0 ? (
                <div className="px-4 py-2">
                  <Empty title="No tickets" body="Nothing matches this filter." />
                </div>
              ) : null}
              {pageRows.length > 0 ? (
                <>
                  <div className="shrink-0 border-b border-border bg-background px-4">
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-[5.25rem]" />
                        <col />
                        <col className="w-[6.5rem]" />
                        <col className="w-[6.75rem]" />
                        <col className="w-[8.25rem]" />
                        {showResolvedColumn ? <col className="w-[8.25rem]" /> : null}
                      </colgroup>
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Ticket No</th>
                          <th className="px-2 py-2 font-medium">Subject</th>
                          <th className="px-2 py-2 font-medium">Assignee</th>
                          <th className="px-2 py-2 font-medium">Status</th>
                          <th className="px-2 py-2 font-medium">Created</th>
                          {showResolvedColumn ? <th className="px-2 py-2 font-medium">Resolved</th> : null}
                        </tr>
                      </thead>
                    </table>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto px-4">
                    <table className="w-full table-fixed text-sm">
                      <colgroup>
                        <col className="w-[5.25rem]" />
                        <col />
                        <col className="w-[6.5rem]" />
                        <col className="w-[6.75rem]" />
                        <col className="w-[8.25rem]" />
                        {showResolvedColumn ? <col className="w-[8.25rem]" /> : null}
                      </colgroup>
                      <tbody>
                        {pageRows.map((t) => (
                          <tr key={t.freshdeskId} className="border-b border-border/60">
                            <td className="px-2 py-2">
                              <TicketNoCell ticket={t} />
                            </td>
                            <td className="truncate px-2 py-2" title={t.subject ?? undefined}>
                              {t.subject || "—"}
                            </td>
                            <td className="px-2 py-2">{t.assignedAgentName || "—"}</td>
                            <td className="px-2 py-2">{t.statusLabel}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-xs">{formatWhen(t.createdAt)}</td>
                            {showResolvedColumn ? (
                              <td className="whitespace-nowrap px-2 py-2 text-xs">
                                {t.resolvedAt ? formatWhen(t.resolvedAt) : "—"}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>

            {filtered.length > PAGE_SIZE ? (
              <div className="flex shrink-0 items-center justify-between border-t border-border bg-background px-4 py-2 text-xs">
                <span className="text-muted-foreground">
                  Page {safePage + 1} of {pageCount}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function historicalDayExplorer(
  dateIst: string,
  kind: "created" | "resolved",
  rangeFrom: string,
  rangeTo: string,
): SupportAnalyticsTicketExplorerRequest {
  return {
    source: "historical",
    title: kind === "created" ? "Tickets created" : "Tickets resolved",
    subtitle: `${formatCalendarDate(dateIst)} (IST) · ${kind === "created" ? "Created" : "Resolved"}`,
    exportFileName: `historical-${kind}-${dateIst}.csv`,
    queryParams: {
      kind,
      dateIst,
      from: rangeFrom,
      to: rangeTo,
      limit: "500",
    },
  };
}
