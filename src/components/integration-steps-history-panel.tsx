import { useState } from "react";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

type IntegrationActivity = {
  summary: string;
  actorName: string;
  createdAt: string;
};

type IntegrationVersion = {
  version: number;
  summaryNote: string;
  savedByName: string;
  createdAt?: string;
};

function TimelineList({
  items,
  renderLine,
}: {
  items: { id: string }[];
  renderLine: (item: (typeof items)[number]) => { title: string; meta: string };
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
  }
  return (
    <ol className="space-y-4">
      {items.map((item) => {
        const { title, meta } = renderLine(item);
        return (
          <li key={item.id} className="border-l-2 border-border pl-3 dark:border-border/80">
            <p className="text-sm leading-snug text-foreground">{title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
          </li>
        );
      })}
    </ol>
  );
}

const ACTIVITY_PREVIEW_COUNT = 5;

export function IntegrationStepsHistoryPanel({
  activity,
  versions,
}: {
  activity: IntegrationActivity[];
  versions: IntegrationVersion[];
}) {
  const [tab, setTab] = useState<"activity" | "revisions">("activity");
  const [activityExpanded, setActivityExpanded] = useState(false);
  const activityItems = activity.map((row, index) => ({ ...row, id: `activity-${index}-${row.createdAt}` }));
  const visibleActivity =
    activityExpanded || activityItems.length <= ACTIVITY_PREVIEW_COUNT
      ? activityItems
      : activityItems.slice(0, ACTIVITY_PREVIEW_COUNT);
  const revisionItems = versions.map((v) => ({
    id: `v-${v.version}`,
    version: v.version,
    summaryNote: v.summaryNote,
    savedByName: v.savedByName,
    createdAt: v.createdAt,
  }));

  return (
    <div className="rounded-lg border border-border/70 bg-card">
      <div className="flex border-b border-border/60">
        {(["activity", "revisions"] as const).map((key) => (
          <button
            key={key}
            type="button"
            className={cn(
              "flex-1 px-3 py-2 text-xs font-semibold capitalize",
              tab === key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(key)}
          >
            {key === "revisions" ? "Revisions" : "Activity"}
          </button>
        ))}
      </div>
      <div className="max-h-[min(70vh,32rem)] overflow-y-auto p-3">
        {tab === "activity" ? (
          <div className="space-y-3">
            <TimelineList
              items={visibleActivity}
              renderLine={(item) => {
                const row = item as IntegrationActivity & { id: string };
                return { title: row.summary, meta: `${row.actorName} · ${formatWhen(row.createdAt)}` };
              }}
            />
            {activityItems.length > ACTIVITY_PREVIEW_COUNT ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setActivityExpanded((v) => !v)}
              >
                {activityExpanded ? "Show less" : `View full history (${activityItems.length})`}
              </button>
            ) : null}
          </div>
        ) : (
          <TimelineList
            items={revisionItems}
            renderLine={(item) => {
              const row = item as (typeof revisionItems)[number];
              return {
                title: `v${row.version} · ${row.summaryNote}`,
                meta: row.createdAt ? `${row.savedByName} · ${formatWhen(row.createdAt)}` : row.savedByName,
              };
            }}
          />
        )}
      </div>
    </div>
  );
}
