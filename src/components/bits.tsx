import type { ReactNode } from "react";
import { EmptyState } from "@/components/design/empty-state";
import { PageHeader } from "@/components/design/page-header";
import { sourceLabel, type Metric } from "@/lib/format";

export { PageHeader } from "@/components/design/page-header";
export { SectionHeader } from "@/components/design/page-header";
export { EmptyState } from "@/components/design/empty-state";
export { PriorityBadge, StatusBadge } from "@/components/design/status-badge";
export { MetricCard } from "@/components/design/metric-card";
export { AttentionList } from "@/components/design/attention-list";
export { FilterToolbar } from "@/components/design/filter-toolbar";
export { DataTableShell } from "@/components/design/data-table-shell";
export { ModuleSubnav } from "@/components/design/module-subnav";
export { DetailSection } from "@/components/design/detail-section";
export { ActivityTimeline } from "@/components/design/activity-timeline";

export function SourceBadge({ metric }: { metric?: Metric | null }) {
  const label = sourceLabel(metric);
  const tone =
    label === "Freshdesk"
      ? "bg-emerald-100 text-emerald-900"
      : label === "Freshdesk sample"
        ? "bg-sky-100 text-sky-900"
        : label === "Admin override"
          ? "bg-sky-100 text-sky-950"
          : label === "Calculated"
            ? "bg-stone-200 text-stone-800"
            : "bg-orange-100 text-orange-950";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

export function Delta({ value, good }: { value: number | null; good: "up" | "down" }) {
  if (value == null || Math.abs(value) < 0.05) return <span className="text-xs text-muted-foreground">No change</span>;
  const favorable = good === "up" ? value > 0 : value < 0;
  const arrow = value > 0 ? "↑" : "↓";
  return (
    <span className={`text-xs font-medium ${favorable ? "text-emerald-700" : "text-rose-700"}`}>
      {arrow} {Math.abs(value).toLocaleString("en-IN")} vs last week
    </span>
  );
}

/** @deprecated use PageHeader from design — kept for modules not yet migrated */
export function PageHeaderLegacy({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <PageHeader eyebrow={eyebrow} title={title} action={action} />;
}

export function Empty({
  title,
  body,
  bodyClassName,
}: {
  title: string;
  body: string;
  bodyClassName?: string;
}) {
  return <EmptyState title={title} body={body} bodyClassName={bodyClassName} />;
}

export function LoadingBlock() {
  return <div className="h-40 animate-pulse rounded-xl bg-muted/80" />;
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-[var(--shadow-card)]">
      {message}
    </div>
  );
}
