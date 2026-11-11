import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const PAGE_SIZE = 25;

function ticketLabel(t: SupportAnalyticsTicketRow) {
  return t.displayId != null ? String(t.displayId) : String(t.freshdeskId);
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

function toCsv(rows: SupportAnalyticsTicketRow[]) {
  const header = [
    "Ticket",
    "Subject",
    "Assignee",
    "Status",
    "Priority",
    "Created (IST)",
    "Resolved",
    "First response",
    "Freshdesk URL",
  ];
  const lines = rows.map((t) =>
    [
      ticketLabel(t),
      (t.subject ?? "").replace(/"/g, '""'),
      (t.assignedAgentName ?? "").replace(/"/g, '""'),
      t.statusLabel,
      t.priorityLabel,
      t.createdAt ? formatWhen(t.createdAt) : "",
      t.resolvedAt ? formatWhen(t.resolvedAt) : "",
      t.firstRespondedAt ? formatWhen(t.firstRespondedAt) : "",
      t.url ?? "",
    ]
      .map((c) => `"${c}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

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
    return rows.filter((t) => matchesSearch(t, search));
  }, [ticketsQuery.data?.tickets, search]);

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
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
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
            <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
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
                className="flex shrink-0 flex-wrap gap-1 border-b border-border px-4 py-2"
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
              <p className="shrink-0 px-4 pt-1 text-[11px] text-muted-foreground">
                Overdue and High/Urgent overlap status tabs — tickets are not double-counted in backlog totals.
              </p>
            ) : null}

            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
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
              <Button type="button" variant="outline" size="sm" disabled={!filtered.length} onClick={exportCsv}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
              {ticketsQuery.isLoading ? <LoadingBlock label="Loading tickets…" /> : null}
              {ticketsQuery.isError ? <ErrorBlock message="Could not load tickets." /> : null}
              {!ticketsQuery.isLoading && !ticketsQuery.isError && filtered.length === 0 ? (
                <Empty title="No tickets" body="Nothing matches this filter." />
              ) : null}
              {pageRows.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-popover">
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Subject</th>
                      <th className="px-2 py-2">Assignee</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Created</th>
                      <th className="px-2 py-2">Resolved</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((t) => (
                      <tr key={t.freshdeskId} className="border-b border-border/60">
                        <td className="px-2 py-2 font-medium tabular-nums">#{ticketLabel(t)}</td>
                        <td className="max-w-[14rem] truncate px-2 py-2" title={t.subject ?? undefined}>
                          {t.subject || "—"}
                        </td>
                        <td className="px-2 py-2">{t.assignedAgentName || "—"}</td>
                        <td className="px-2 py-2">{t.statusLabel}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs">{formatWhen(t.createdAt)}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs">
                          {t.resolvedAt ? formatWhen(t.resolvedAt) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {t.url ? (
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-primary hover:underline"
                            >
                              Freshdesk
                              <ExternalLink className="ml-1 h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>

            {filtered.length > PAGE_SIZE ? (
              <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2 text-xs">
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
