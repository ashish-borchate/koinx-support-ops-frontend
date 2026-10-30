import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  COMPLETED_WORK_CATEGORIES,
  MANAGEMENT_DRILL_MODULES,
  MANAGEMENT_MODULE_LABELS,
  type DrillDownRecord,
  type DrillDownScope,
  type DrillDownTarget,
  type ManagementDrillModule,
} from "@/components/management/management-drill-down.constants";
import { ErrorBlock, LoadingBlock } from "@/components/bits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { formatMonth, formatWeek, formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

type LiveRow = { categoryKey: string; label: string; count: number; tone?: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: DrillDownScope;
  periodType: "weekly" | "monthly";
  week: string;
  month: string;
  target: DrillDownTarget | null;
  liveCounts: Record<string, LiveRow[]>;
  completedCounts: Record<string, Record<string, number | string | undefined>>;
};

function RecordRow({ rec }: { rec: DrillDownRecord }) {
  const secondaryParts: string[] = [];
  if (rec.statusLabel) secondaryParts.push(rec.statusLabel);
  if (rec.deadlineAt) secondaryParts.push(`Deadline: ${formatWhen(rec.deadlineAt)}`);
  else if (rec.eventAt) secondaryParts.push(formatWhen(rec.eventAt));
  if (rec.ownerLabel) secondaryParts.push(rec.ownerLabel);

  const overdue = rec.overdueLabel?.trim();

  return (
    <li className="border-b border-border/40 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">{rec.title}</p>
        {overdue ? (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-800 dark:text-amber-200">
            {overdue}
          </span>
        ) : null}
      </div>
      {secondaryParts.length > 0 ? (
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{secondaryParts.join(" · ")}</p>
      ) : null}
      <Link
        to={rec.detailPath}
        className="mt-1 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        View details
      </Link>
    </li>
  );
}

function CategorySection({
  module,
  categoryKey,
  label,
  count,
  expanded,
  onToggle,
  scope,
  periodType,
  week,
  month,
  tone,
}: {
  module: ManagementDrillModule;
  categoryKey: string;
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  scope: DrillDownScope;
  periodType: "weekly" | "monthly";
  week: string;
  month: string;
  tone?: string;
}) {
  const query = useQuery({
    queryKey: ["management-drill-down", scope, module, categoryKey, periodType, week, month],
    queryFn: () => {
      const params = new URLSearchParams({
        scope,
        module,
        category: categoryKey,
        periodType,
      });
      if (periodType === "monthly") params.set("month", month);
      else params.set("week", week);
      return api<{ count: number; records: DrillDownRecord[] }>(
        `/api/management-overview/drill-down?${params.toString()}`,
      );
    },
    enabled: expanded && count > 0,
  });

  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        type="button"
        className={cn(
          "flex h-11 w-full items-center gap-2 px-1 text-left text-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          expanded && "bg-muted/20",
        )}
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground motion-safe:transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 font-medium text-foreground">{label}</span>
        <span
          className={cn(
            "shrink-0 pr-1 text-sm font-semibold tabular-nums",
            tone === "warning" ? "text-amber-700 dark:text-amber-300" : "text-foreground",
          )}
        >
          {count}
        </span>
      </button>
      {expanded ? (
        <div className="bg-muted/10 px-3 pb-3 pt-1">
          {count === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No records in this category.</p>
          ) : query.isPending ? (
            <div className="py-4">
              <LoadingBlock />
            </div>
          ) : query.isError ? (
            <ErrorBlock message={query.error.message} />
          ) : query.data && query.data.records.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No records returned (count may have changed).</p>
          ) : (
            <ul className="rounded-md bg-card/60 px-2">
              {query.data?.records.map((rec) => (
                <RecordRow key={rec.id} rec={rec} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ManagementOperationalDetailsDialog({
  open,
  onOpenChange,
  scope,
  periodType,
  week,
  month,
  target,
  liveCounts,
  completedCounts,
}: Props) {
  const [tab, setTab] = useState<ManagementDrillModule>("productGuides");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !target) return;
    setTab(target.module);
    setExpandedKey(`${target.module}:${target.category}`);
  }, [open, target]);

  const subtitle = useMemo(() => {
    if (scope === "live") return "Current pending & overdue";
    if (periodType === "monthly") return `Work completed · ${formatMonth(month)}`;
    const year = week.slice(0, 4);
    return `Work completed · ${formatWeek(week)} ${year}`;
  }, [scope, periodType, week, month]);

  const categoriesForModule = (mod: ManagementDrillModule) => {
    if (scope === "live") {
      return (liveCounts[mod] ?? []).map((r) => ({
        categoryKey: r.categoryKey,
        label: r.label,
        count: r.count,
        tone: r.tone,
      }));
    }
    const defs = COMPLETED_WORK_CATEGORIES[mod] ?? [];
    const bucket = completedCounts[mod] ?? {};
    return defs.map((d) => ({
      categoryKey: d.categoryKey,
      label: d.label,
      count: Number(bucket[d.countKey] ?? 0),
      tone: undefined as string | undefined,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[min(92vh,52rem)] w-full max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(calc(100vw-2rem),65rem)]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-3 pt-5 pr-12">
          <DialogTitle className="text-base">Management Details</DialogTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as ManagementDrillModule)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="shrink-0 border-b border-border/60 bg-muted/20 px-3 py-2">
            <TabsList
              variant="line"
              className="h-9 w-full max-w-full flex-nowrap justify-start gap-0 overflow-x-auto rounded-none bg-transparent p-0 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5"
            >
              {MANAGEMENT_DRILL_MODULES.map((mod) => (
                <TabsTrigger
                  key={mod}
                  value={mod}
                  className="h-9 flex-none shrink-0 whitespace-nowrap px-3 text-xs sm:text-sm"
                >
                  {MANAGEMENT_MODULE_LABELS[mod]}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {MANAGEMENT_DRILL_MODULES.map((mod) => (
            <TabsContent
              key={mod}
              value={mod}
              className="mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 data-[state=inactive]:hidden"
            >
              <div className="rounded-lg bg-muted/15">
                {categoriesForModule(mod).map((cat) => {
                  const key = `${mod}:${cat.categoryKey}`;
                  return (
                    <CategorySection
                      key={key}
                      module={mod}
                      categoryKey={cat.categoryKey}
                      label={cat.label}
                      count={cat.count}
                      tone={cat.tone}
                      expanded={expandedKey === key}
                      onToggle={() => setExpandedKey((prev) => (prev === key ? null : key))}
                      scope={scope}
                      periodType={periodType}
                      week={week}
                      month={month}
                    />
                  );
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
