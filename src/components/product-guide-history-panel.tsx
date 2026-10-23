import { useState } from "react";
import { formatGuideActivityLine } from "@/lib/guide-activity-display";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";

type GuideActivity = {
  id: string;
  action?: string;
  summary: string;
  actorName: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

type GuideRevision = {
  id: string;
  note: string;
  savedByName: string;
  createdAt: string;
};

function TimelineList({
  items,
  renderLine,
}: {
  items: { id: string; createdAt: string }[];
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

const ACTIVITY_PREVIEW_COUNT = 3;

export function ProductGuideHistoryPanel({
  activity,
  revisions,
}: {
  activity: GuideActivity[];
  revisions: GuideRevision[];
}) {
  const [tab, setTab] = useState<"activity" | "revisions">("activity");
  const [activityExpanded, setActivityExpanded] = useState(false);
  const visibleActivity =
    activityExpanded || activity.length <= ACTIVITY_PREVIEW_COUNT
      ? activity
      : activity.slice(0, ACTIVITY_PREVIEW_COUNT);

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
            {key}
          </button>
        ))}
      </div>
      <div
        className={cn(
          "overflow-y-auto p-3",
          activityExpanded && tab === "activity"
            ? "max-h-[min(70vh,28rem)]"
            : "max-h-[min(40vh,14rem)]",
        )}
      >
        {tab === "activity" ? (
          <div className="space-y-3">
            <TimelineList
              items={visibleActivity}
              renderLine={(item) => formatGuideActivityLine(item as GuideActivity)}
            />
            {activity.length > ACTIVITY_PREVIEW_COUNT ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setActivityExpanded((v) => !v)}
              >
                {activityExpanded ? "Show less" : `View full history (${activity.length})`}
              </button>
            ) : null}
          </div>
        ) : (
          <TimelineList
            items={revisions}
            renderLine={(item) => {
              const row = item as GuideRevision;
              return {
                title: row.note,
                meta: `${row.savedByName} · ${formatWhen(row.createdAt)}`,
              };
            }}
          />
        )}
      </div>
    </div>
  );
}
