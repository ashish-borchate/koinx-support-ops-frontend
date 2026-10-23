import { formatWhen } from "@/lib/format";

type GuideActivityRow = {
  action?: string;
  summary: string;
  actorName: string;
  createdAt: string;
  meta?: Record<string, unknown>;
};

const ACTION_TITLES: Record<string, string> = {
  "guide.update_started": "Update started",
  "guide.pending_saved": "Changes saved",
  "guide.verification_completed": "Documentation changes verified",
  "guide.pending_ready": "Ready to publish",
  "guide.ready_to_publish": "Ready to publish",
  "guide.ready_after_changes": "Ready to publish",
  "guide.pending_published": "Publication confirmed",
  "guide.pending_discarded": "Update discarded",
  "guide.published": "Publication confirmed",
  "guide.accuracy_review": "Accuracy review completed",
  "guide.created": "Guide created",
  "guide.edited": "Guide updated",
};

export function formatGuideActivityLine(row: GuideActivityRow): { title: string; meta: string } {
  const action = row.action || "";
  const title = ACTION_TITLES[action] || row.summary.replace(/\s*·\s*[^·]+$/, "").trim() || row.summary;

  if (action === "guide.verification_completed" || action === "guide.pending_ready") {
    const count =
      typeof row.meta?.verificationCheckCount === "number"
        ? row.meta.verificationCheckCount
        : row.meta?.checklist && typeof row.meta.checklist === "object"
          ? Object.keys(row.meta.checklist as object).length
          : 4;
    return {
      title,
      meta: `${row.actorName} · ${formatWhen(row.createdAt)} · ${count} verification checks completed`,
    };
  }

  const shortSummary = row.summary.replace(new RegExp(`^${row.actorName}\\s+`, "i"), "").trim();
  const useTitle =
    ACTION_TITLES[action] && shortSummary.toLowerCase() !== title.toLowerCase() ? title : row.summary;
  const displayTitle = ACTION_TITLES[action] ? title : useTitle;

  if (displayTitle === row.summary) {
    return { title: displayTitle, meta: `${formatWhen(row.createdAt)}` };
  }
  return { title: displayTitle, meta: `${row.actorName} · ${formatWhen(row.createdAt)}` };
}
