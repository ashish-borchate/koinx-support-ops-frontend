import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { Pin } from "lucide-react";
import { formatWhen } from "@/lib/format";

export type SupportUpdateItem = {
  id: string;
  title: string;
  category: string;
  description?: string;
  descriptionExcerpt: string;
  importance: string;
  pinned: boolean;
  postedByName: string;
  postedAt: string;
  updatedAt?: string;
  updatedByName?: string;
  actions?: { edit: boolean; delete: boolean; pin: boolean };
};

const importanceTone: Record<string, string> = {
  Normal: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)] ring-1 ring-[var(--status-neutral-border)]",
  Important: "bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] ring-1 ring-[var(--status-warning-border)]",
  Critical: "bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)] ring-1 ring-[var(--status-danger-border)]",
};

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-700 underline break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function ImportanceBadge({ importance }: { importance: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${importanceTone[importance] || importanceTone.Normal}`}>
      {importance}
    </span>
  );
}

export function SupportUpdateCard({
  item,
  compact,
  children,
}: {
  item: SupportUpdateItem;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <article className={`rounded-xl border bg-white ${item.importance === "Critical" ? "border-rose-200" : "border-slate-200"} ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {item.pinned ? (
          <span className="inline-flex items-center gap-1 text-blue-700">
            <Pin className="h-3 w-3" /> Pinned
          </span>
        ) : null}
        <ImportanceBadge importance={item.importance} />
        <span>{item.category}</span>
      </div>
      <h3 className={`mt-2 font-semibold text-slate-900 ${compact ? "text-base" : "text-lg"}`}>{item.title}</h3>
      <p className={`mt-2 whitespace-pre-wrap text-slate-700 ${compact ? "text-sm line-clamp-3" : "text-[15px] leading-relaxed"}`}>
        {linkify(compact ? item.descriptionExcerpt : item.description || item.descriptionExcerpt)}
      </p>
      <p className="mt-3 text-xs text-slate-500">
        {item.postedByName} · {formatWhen(item.postedAt)}
        {item.updatedByName && item.updatedAt && item.updatedAt !== item.postedAt ? (
          <span> · edited {formatWhen(item.updatedAt)}</span>
        ) : null}
      </p>
      {children}
    </article>
  );
}

export function LatestSupportUpdatesSection({
  items,
  showViewAll = true,
}: {
  items: SupportUpdateItem[];
  showViewAll?: boolean;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Latest Support Updates</h2>
        {showViewAll ? (
          <Link to="/support-updates" className="text-xs font-medium text-blue-700">
            View all updates →
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-600">
          No support updates yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} to="/support-updates" className="block">
              <SupportUpdateCard item={item} compact />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
